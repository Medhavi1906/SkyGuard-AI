import express from "express";
import { createServer } from "http";
import path from "path";
import { promises as fs } from "fs";
import { fileURLToPath } from "url";
import { STATIONS } from "../shared/stations.js";

/**
 * SkyGuard backend
 *
 * Data source order:
 *   1. IMD AWS/ARG when credentials are configured.
 *   2. Open-Meteo (current + 7 days of hourly context) for development/demo.
 *   3. Local replay data if both network sources are unavailable.
 *
 * The anomaly detector is a small dependency-free Isolation Forest implementation
 * so the Node/TypeScript backend can run without a Python service.
 */

type SourceMode = "live" | "open-meteo" | "replay";
type EventClassification = "regional_weather" | "sensor_fault" | "mixed";
type Color = "green" | "amber" | "red";
type Status = "Healthy" | "Warning" | "Critical";

type Observation = {
  station_id: string;
  station_name: string;
  latitude: number;
  longitude: number;
  temperature: number;
  humidity: number;
  pressure: number;
  timestamp: string;
};

type FeatureVector = number[];

type ApiStation = Observation & {
  state: string;
  region: string;
  status: Status;
  health: number;
  anomaly_score: number;
  confidence: number;
  color: Color;
  deviations: { temperature: number; humidity: number; pressure: number };
  affected: string[];
  explanation: string;
  suspected_cause: string;
  recommended_action: string;
};

type WeatherEvent = {
  classification: EventClassification;
  label: string;
  confidence: number;
  evidence: string;
  affected_stations: string[];
};

type DetectorConfig = {
  warning_score: number;
  critical_score: number;
  regional_fraction: number;
};

type RealtimePayload = {
  source: SourceMode;
  source_label: string;
  last_sync: string;
  stations: ApiStation[];
  anomalies: number;
  model: { name: string; version: string; method: string };
  weather_event: WeatherEvent;
  detector_config: DetectorConfig;
  data_quality: { valid: number; expected: number; missing: number; duplicate: number };
};

type TrainingProfile = {
  mean: number[];
  std: number[];
  robustCenter: number[];
  robustSigma: number[];
  forest: IsolationForest;
  samples: number;
};

type StoredRow = Observation & { source: SourceMode; recorded_at: string };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const port = Number(process.env.PORT || (process.env.NODE_ENV === "production" ? 3000 : 3001));
const imdUrl = process.env.IMD_AWS_API_URL?.trim();
const imdToken = process.env.IMD_API_TOKEN?.trim();
const cacheTtlMs = Number(process.env.REALTIME_CACHE_TTL_MS || 5 * 60_000);
const historyPath = path.resolve(__dirname, "..", "data", "runtime", "observations.jsonl");
const historyLimit = Number(process.env.HISTORY_MAX_ROWS || 100_000);

let detectorConfig: DetectorConfig = {
  warning_score: clamp(Number(process.env.ANOMALY_WARNING_THRESHOLD || 0.32), 0.05, 0.95),
  critical_score: clamp(Number(process.env.ANOMALY_CRITICAL_THRESHOLD || 0.62), 0.10, 0.99),
  regional_fraction: clamp(Number(process.env.WEATHER_EVENT_REGIONAL_FRACTION || 0.5), 0.2, 1),
};
let cache: { expiresAt: number; payload: RealtimePayload } | null = null;
let lastGoodOpenMeteo: Observation[] | null = null;
let profiles = new Map<string, TrainingProfile>();

const replayObservations: Observation[] = STATIONS.map((station, index) => ({
  station_id: station.station_id,
  station_name: station.station_name,
  latitude: station.latitude,
  longitude: station.longitude,
  temperature: Number((24 + ((index * 7) % 130) / 10).toFixed(1)),
  humidity: 45 + ((index * 13) % 45),
  pressure: Number((1002 + ((index * 11) % 80) / 10).toFixed(1)),
  timestamp: new Date().toISOString(),
}));

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function asNumber(value: unknown, fallback = NaN): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function mad(values: number[], center: number) {
  return median(values.map((value) => Math.abs(value - center)));
}

function standardize(rows: FeatureVector[]) {
  const width = rows[0]?.length ?? 0;
  const mean = Array.from({ length: width }, (_, j) => rows.reduce((sum, row) => sum + row[j], 0) / rows.length);
  const std = Array.from({ length: width }, (_, j) => {
    const variance = rows.reduce((sum, row) => sum + (row[j] - mean[j]) ** 2, 0) / Math.max(1, rows.length - 1);
    return Math.max(variance ** 0.5, 1e-6);
  });
  return { mean, std };
}

function applyStandardize(row: FeatureVector, stats: { mean: number[]; std: number[] }) {
  return row.map((value, index) => (value - stats.mean[index]) / stats.std[index]);
}

function observationFeatureRows(observations: Observation[]): FeatureVector[] {
  const sorted = [...observations].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  return sorted.map((row, index) => {
    const previous = sorted[Math.max(0, index - 1)];
    return [
      row.temperature,
      row.humidity,
      row.pressure,
      index === 0 ? 0 : row.temperature - previous.temperature,
      index === 0 ? 0 : row.humidity - previous.humidity,
      index === 0 ? 0 : row.pressure - previous.pressure,
    ];
  });
}

function currentFeatures(current: Observation, history: Observation[]) {
  const sorted = [...history].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  const previous = sorted[sorted.length - 1];
  return [
    current.temperature,
    current.humidity,
    current.pressure,
    previous ? current.temperature - previous.temperature : 0,
    previous ? current.humidity - previous.humidity : 0,
    previous ? current.pressure - previous.pressure : 0,
  ];
}

// --- Dependency-free Isolation Forest -------------------------------------
// This follows the standard random isolation-tree idea: observations that are
// easy to isolate have shorter average path lengths and therefore higher scores.

class IsolationTree {
  constructor(
    private readonly leaf: boolean,
    private readonly size: number,
    private readonly feature = -1,
    private readonly split = 0,
    private readonly left: IsolationTree | null = null,
    private readonly right: IsolationTree | null = null,
  ) {}

  static build(rows: FeatureVector[], depth: number, maxDepth: number, random: () => number): IsolationTree {
    if (depth >= maxDepth || rows.length <= 1) return new IsolationTree(true, rows.length);
    const featureCount = rows[0].length;
    const feature = Math.floor(random() * featureCount);
    const values = rows.map((row) => row[feature]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (min === max) return new IsolationTree(true, rows.length);
    const split = min + random() * (max - min);
    const leftRows = rows.filter((row) => row[feature] < split);
    const rightRows = rows.filter((row) => row[feature] >= split);
    if (!leftRows.length || !rightRows.length) return new IsolationTree(true, rows.length);
    return new IsolationTree(false, rows.length, feature, split, IsolationTree.build(leftRows, depth + 1, maxDepth, random), IsolationTree.build(rightRows, depth + 1, maxDepth, random));
  }

  pathLength(row: FeatureVector, depth = 0): number {
    if (this.leaf) return depth + averagePathLength(this.size);
    return row[this.feature] < this.split ? this.left!.pathLength(row, depth + 1) : this.right!.pathLength(row, depth + 1);
  }
}

class IsolationForest {
  private trees: IsolationTree[] = [];
  private sampleSize: number;

  constructor(rows: FeatureVector[], treeCount = 64, sampleSize = 128, seed = 42) {
    this.sampleSize = Math.min(sampleSize, rows.length);
    const random = seededRandom(seed);
    const maxDepth = Math.ceil(Math.log2(Math.max(2, this.sampleSize)));
    for (let i = 0; i < treeCount; i++) {
      const sample = randomSample(rows, this.sampleSize, random);
      this.trees.push(IsolationTree.build(sample, 0, maxDepth, random));
    }
  }

  score(row: FeatureVector) {
    if (!this.trees.length) return 0.5;
    const averagePath = this.trees.reduce((sum, tree) => sum + tree.pathLength(row), 0) / this.trees.length;
    return 2 ** (-averagePath / averagePathLength(this.sampleSize));
  }
}

function averagePathLength(n: number) {
  if (n <= 1) return 0;
  if (n === 2) return 1;
  const harmonic = Math.log(n - 1) + 0.5772156649;
  return 2 * harmonic - (2 * (n - 1)) / n;
}

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function randomSample<T>(items: T[], count: number, random: () => number) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

function buildProfile(history: Observation[]): TrainingProfile | null {
  const rows = observationFeatureRows(history).filter((row) => row.every(Number.isFinite));
  if (rows.length < 24) return null;
  const stats = standardize(rows);
  const robustCenter = Array.from({ length: rows[0].length }, (_, j) => median(rows.map((row) => row[j])));
  const robustSigma = Array.from({ length: rows[0].length }, (_, j) => Math.max(mad(rows.map((row) => row[j]), robustCenter[j]) * 1.4826, 1e-3));
  return { mean: stats.mean, std: stats.std, robustCenter, robustSigma, forest: new IsolationForest(rows.map((row) => applyStandardize(row, stats))), samples: rows.length };
}

function getDeviation(value: number, values: number[]) {
  const center = median(values);
  const robustSigma = Math.max(mad(values, center) * 1.4826, 0.1);
  return (value - center) / robustSigma;
}

function scoreObservation(observation: Observation, history: Observation[]): ApiStation {
  const profile = profiles.get(observation.station_id);
  const historyForStation = history.filter((row) => row.station_id === observation.station_id);
  const temperatureValues = historyForStation.map((row) => row.temperature).filter(Number.isFinite);
  const humidityValues = historyForStation.map((row) => row.humidity).filter(Number.isFinite);
  const pressureValues = historyForStation.map((row) => row.pressure).filter(Number.isFinite);

  const vector = currentFeatures(observation, historyForStation);
  const rawIsolation = profile ? profile.forest.score(applyStandardize(vector, { mean: profile.mean, std: profile.std })) : 0.5;

  const deviations = profile
    ? {
        temperature: (observation.temperature - profile.robustCenter[0]) / profile.robustSigma[0],
        humidity: (observation.humidity - profile.robustCenter[1]) / profile.robustSigma[1],
        pressure: (observation.pressure - profile.robustCenter[2]) / profile.robustSigma[2],
      }
    : {
        temperature: temperatureValues.length ? getDeviation(observation.temperature, temperatureValues) : 0,
        humidity: humidityValues.length ? getDeviation(observation.humidity, humidityValues) : 0,
        pressure: pressureValues.length ? getDeviation(observation.pressure, pressureValues) : 0,
      };

  // Isolation Forest scores depend on the size/shape of the training sample.
  // Blend the forest score with robust multivariate deviation so the dashboard
  // remains stable during the first few hours of a new station.
  const zSignal = clamp(
    (Math.abs(deviations.temperature) / 4 + Math.abs(deviations.humidity) / 4 + Math.abs(deviations.pressure) / 3) / 3,
    0,
    1,
  );
  const isolationSignal = clamp((rawIsolation - 0.35) / 0.5, 0, 1);
  const anomalyScore = Number(clamp(profile ? isolationSignal * 0.7 + zSignal * 0.3 : zSignal, 0.01, 0.99).toFixed(2));
  const status: Status = anomalyScore >= detectorConfig.critical_score ? "Critical" : anomalyScore >= detectorConfig.warning_score ? "Warning" : "Healthy";
  const health = Math.round(100 - anomalyScore * 65);
  const affected = [
    Math.abs(deviations.temperature) >= 2 ? "temperature" : "",
    Math.abs(deviations.humidity) >= 2 ? "humidity" : "",
    Math.abs(deviations.pressure) >= 2 ? "pressure" : "",
  ].filter(Boolean);

  const strongest = [
    ["temperature", Math.abs(deviations.temperature)],
    ["humidity", Math.abs(deviations.humidity)],
    ["pressure", Math.abs(deviations.pressure)],
  ].sort((a, b) => Number(b[1]) - Number(a[1]))[0][0];

  let explanation = "The latest observation is consistent with the station's recent multivariate pattern.";
  let suspectedCause = "Normal observation";
  let action = "Continue monitoring; no action required.";
  if (status === "Warning") {
    explanation = `The Isolation Forest and station-specific robust baseline found a moderate deviation, led by ${strongest}. The reading remains physically plausible but deserves review.`;
    suspectedCause = `Possible gradual drift or transient ${strongest} deviation`;
    action = `Compare the ${strongest} reading with nearby stations and schedule calibration review if the pattern persists.`;
  }
  if (status === "Critical") {
    explanation = `A high anomaly score was driven primarily by ${strongest}, with supporting multivariate evidence from the station's recent temporal pattern. This is a sensor-quality alert, not proof of hardware failure.`;
    suspectedCause = `Possible ${strongest} sensor spike / multivariate inconsistency`;
    action = `Inspect the ${strongest} sensor and communication path; verify against nearby observations before declaring a fault.`;
  }

  const locationMeta = STATIONS.find((station) => station.station_id === observation.station_id);
  return {
    ...observation,
    state: locationMeta?.state ?? "Unknown",
    region: locationMeta?.region ?? "Unknown",
    status,
    health: clamp(health, 20, 100),
    anomaly_score: anomalyScore,
    confidence: Math.round(clamp(50 + anomalyScore * 48, 50, 98)),
    color: status === "Critical" ? "red" : status === "Warning" ? "amber" : "green",
    deviations: {
      temperature: Number(deviations.temperature.toFixed(1)),
      humidity: Number(deviations.humidity.toFixed(1)),
      pressure: Number(deviations.pressure.toFixed(1)),
    },
    affected,
    explanation,
    suspected_cause: suspectedCause,
    recommended_action: action,
  };
}

function normaliseObservation(raw: any, index = 0): Observation | null {
  const stationId = String(raw.station_id ?? raw.stationId ?? raw.CALL_SIGN ?? raw.call_sign ?? raw.id ?? raw.ID ?? raw.station ?? `OPEN-METEO-${index + 1}`).trim();
  if (!stationId) return null;
  const temperature = asNumber(raw.temperature ?? raw.temp ?? raw.air_temperature ?? raw.CURR_TEMP, NaN);
  const humidity = asNumber(raw.humidity ?? raw.relative_humidity ?? raw.rh ?? raw.RH, NaN);
  const pressure = asNumber(raw.pressure ?? raw.air_pressure ?? raw.mslp ?? raw.MSLP ?? raw.surface_pressure, NaN);
  const latitude = asNumber(raw.latitude ?? raw.lat ?? raw.Latitude, NaN);
  const longitude = asNumber(raw.longitude ?? raw.lon ?? raw.lng ?? raw.Longitude, NaN);
  if (![temperature, humidity, pressure, latitude, longitude].every(Number.isFinite)) return null;
  return {
    station_id: stationId,
    station_name: String(raw.station_name ?? raw.name ?? raw.stationName ?? raw.STATION ?? raw.station ?? stationId),
    latitude,
    longitude,
    temperature,
    humidity,
    pressure,
    timestamp: normaliseTimestamp(raw.timestamp ?? raw.observed_at ?? raw.time ?? raw.TIME, raw.DATE),
  };
}

function normaliseTimestamp(value: unknown, dateValue?: unknown) {
  if (dateValue && value && /^\d{1,2}:\d{2}/.test(String(value))) {
    const date = String(dateValue).slice(0, 10);
    return new Date(`${date}T${String(value).slice(0, 8)}+05:30`).toISOString();
  }
  const text = String(value ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(text)) {
    const parsedLocal = Date.parse(`${text}+05:30`);
    if (Number.isFinite(parsedLocal)) return new Date(parsedLocal).toISOString();
  }
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
}

function extractRows(body: any): any[] {
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.stations)) return body.stations;
  if (Array.isArray(body?.observations)) return body.observations;
  if (Array.isArray(body?.data)) return body.data;
  if (Array.isArray(body?.aws_data)) return body.aws_data;
  return [];
}

async function fetchJson(url: string, headers: Record<string, string> = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json", ...headers } });
    if (!response.ok) throw new Error(`Weather source responded ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchImdObservations(): Promise<Observation[]> {
  if (!imdUrl) throw new Error("IMD_AWS_API_URL is not configured");
  const body = await fetchJson(imdUrl, imdToken ? { Authorization: `Bearer ${imdToken}` } : {});
  const rows = extractRows(body).map((raw, index) => normaliseObservation(raw, index)).filter(Boolean) as Observation[];
  if (!rows.length) throw new Error("IMD response contained no valid observations");
  return rows;
}

function getOpenMeteoLocations() {
  const configured = process.env.OPEN_METEO_LOCATIONS_JSON;
  if (configured) {
    try {
      const parsed = JSON.parse(configured);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    } catch (error) {
      console.warn("OPEN_METEO_LOCATIONS_JSON is invalid; using bundled 100-station network.", error);
    }
  }
  return STATIONS;
}

async function fetchOpenMeteoObservations(): Promise<Observation[]> {
  const locations = getOpenMeteoLocations();
  const rows: Observation[] = [];
  const batchSize = 20;
  for (let offset = 0; offset < locations.length; offset += batchSize) {
    const batch = locations.slice(offset, offset + batchSize);
    const query = new URLSearchParams({
      latitude: batch.map((location: any) => location.latitude).join(","),
      longitude: batch.map((location: any) => location.longitude).join(","),
      current: "temperature_2m,relative_humidity_2m,surface_pressure",
      hourly: "temperature_2m,relative_humidity_2m,surface_pressure",
      past_days: "7",
      forecast_days: "1",
      timezone: "Asia/Kolkata",
    });
    const body = await fetchJson(`https://api.open-meteo.com/v1/forecast?${query.toString()}`);
    const items = Array.isArray(body) ? body : [body];
    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      const base = batch[index];
      if (!base) continue;
      const current = item?.current ?? {};
      const observation = normaliseObservation({
        station_id: base.station_id, station_name: base.station_name,
        latitude: item.latitude ?? base.latitude, longitude: item.longitude ?? base.longitude,
        temperature: current.temperature_2m, humidity: current.relative_humidity_2m,
        pressure: current.surface_pressure, timestamp: current.time,
      }, offset + index);
      if (observation) rows.push(observation);

      const hourly = item?.hourly;
      if (hourly?.time?.length) {
        const history: Observation[] = [];
        for (let i = 0; i < hourly.time.length; i++) {
          const hourlyObservation = normaliseObservation({
            station_id: base.station_id, station_name: base.station_name,
            latitude: base.latitude, longitude: base.longitude,
            temperature: hourly.temperature_2m?.[i], humidity: hourly.relative_humidity_2m?.[i],
            pressure: hourly.surface_pressure?.[i], timestamp: hourly.time[i],
          }, i);
          if (hourlyObservation) history.push(hourlyObservation);
        }
        const profile = buildProfile(history);
        if (profile) profiles.set(base.station_id, profile);
      }
    }
  }
  if (rows.length !== locations.length) throw new Error(`Open-Meteo returned ${rows.length}/${locations.length} current stations`);
  lastGoodOpenMeteo = rows;
  return rows;
}

async function readHistory(stationId?: string, hours = 24): Promise<StoredRow[]> {
  try {
    const text = await fs.readFile(historyPath, "utf8");
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    const rows: StoredRow[] = [];
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      try {
        const row = JSON.parse(line) as StoredRow;
        if ((!stationId || row.station_id === stationId) && Date.parse(row.recorded_at) >= cutoff) rows.push(row);
      } catch {
        // Ignore a corrupted individual line instead of taking down the API.
      }
    }
    return rows.slice(-2000);
  } catch {
    return [];
  }
}

async function appendHistory(observations: Observation[], source: SourceMode) {
  await fs.mkdir(path.dirname(historyPath), { recursive: true });
  const existing = await readAllHistory();
  const seen = new Set(existing.map((row) => `${row.station_id}|${row.timestamp}`));
  const now = new Date().toISOString();
  const newRows = observations
    .filter((observation) => !seen.has(`${observation.station_id}|${observation.timestamp}`))
    .map((observation) => JSON.stringify({ ...observation, source, recorded_at: now }));
  if (!newRows.length) return;
  const retained = [...existing, ...newRows.map((line) => JSON.parse(line) as StoredRow)].slice(-historyLimit);
  await fs.writeFile(historyPath, retained.map((row) => JSON.stringify(row)).join("\n") + "\n", "utf8");
}

async function readAllHistory(): Promise<StoredRow[]> {
  try {
    const text = await fs.readFile(historyPath, "utf8");
    return text.split("\n").filter(Boolean).map((line) => JSON.parse(line) as StoredRow).filter((row) => row.station_id && row.timestamp && row.recorded_at);
  } catch {
    return [];
  }
}

function haversineKm(a: Observation, b: Observation) {
  const toRad = (value: number) => value * Math.PI / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const x = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function classifyWeatherEvent(stations: ApiStation[]): WeatherEvent {
  const affected = stations.filter((station) => station.status !== "Healthy");
  const critical = stations.filter((station) => station.status === "Critical");
  if (!affected.length) {
    return { classification: "mixed", label: "Network within learned range", confidence: 86, evidence: "No station currently exceeds the configured anomaly threshold.", affected_stations: [] };
  }

  let supported = 0;
  for (const station of affected) {
    const nearby = stations.filter((candidate) => candidate.station_id !== station.station_id && haversineKm(station, candidate) <= 250);
    const peers = nearby.filter((candidate) => candidate.status !== "Healthy");
    if (peers.length >= 1) supported++;
  }
  const spatialAgreement = affected.length ? supported / affected.length : 0;
  const regional = affected.length >= Math.max(2, Math.ceil(stations.length * detectorConfig.regional_fraction)) && spatialAgreement >= 0.4;

  if (regional) {
    const confidence = Math.round(clamp(68 + affected.length / stations.length * 25 + spatialAgreement * 8, 55, 98));
    return {
      classification: "regional_weather",
      label: "Regional weather event likely",
      confidence,
      evidence: `${affected.length} of ${stations.length} stations are anomalous and ${Math.round(spatialAgreement * 100)}% of affected stations have nearby supporting anomalies. This favors a real regional atmospheric signal over a single sensor fault.`,
      affected_stations: affected.map((station) => station.station_id),
    };
  }

  if (critical.length) {
    const confidence = Math.round(clamp(72 + critical.length * 6 + (1 - spatialAgreement) * 12, 55, 98));
    return {
      classification: "sensor_fault",
      label: "Localized sensor fault likely",
      confidence,
      evidence: `${critical.length} station${critical.length > 1 ? "s" : ""} show high-severity anomalies without broad spatial agreement. Treat this as a sensor-quality investigation until nearby evidence confirms a weather event.`,
      affected_stations: critical.map((station) => station.station_id),
    };
  }

  return {
    classification: "mixed",
    label: "Localized deviation needs review",
    confidence: Math.round(clamp(62 + (1 - spatialAgreement) * 20, 55, 90)),
    evidence: `${affected.length} station${affected.length > 1 ? "s" : ""} exceed the warning threshold, but the network does not yet show enough spatial agreement for a regional-event call.`,
    affected_stations: affected.map((station) => station.station_id),
  };
}

async function buildPayload(): Promise<RealtimePayload> {
  let observations: Observation[];
  let source: SourceMode = "open-meteo";
  try {
    if (imdUrl) {
      observations = await fetchImdObservations();
      source = "live";
    } else {
      observations = await fetchOpenMeteoObservations();
    }
  } catch (error) {
    console.warn("Primary weather source unavailable:", error instanceof Error ? error.message : error);
    if (lastGoodOpenMeteo?.length) {
      observations = lastGoodOpenMeteo.map((row) => ({ ...row }));
      source = "open-meteo";
    } else {
      source = "replay";
      observations = replayObservations.map((item) => ({ ...item, timestamp: new Date().toISOString() }));
    }
  }

  const allHistory = await readAllHistory();
  // Keep a compact in-memory station history for the current scoring pass.
  const recentHistory = allHistory.filter((row) => Date.parse(row.recorded_at) >= Date.now() - 7 * 24 * 60 * 60 * 1000);
  const enriched = observations.map((observation) => scoreObservation(observation, recentHistory));
  await appendHistory(observations, source);

  return {
    source,
    source_label: source === "live" ? "IMD AWS / ARG" : source === "open-meteo" ? "Open-Meteo" : "Replay fallback",
    last_sync: new Date().toISOString(),
    stations: enriched,
    anomalies: enriched.filter((station) => station.status === "Critical").length,
    model: {
      name: "SkyGuard anomaly detector",
      version: "v1.0.0",
      method: "Isolation Forest + robust station baseline + spatial consistency",
    },
    weather_event: classifyWeatherEvent(enriched),
    detector_config: detectorConfig,
    data_quality: {
      valid: observations.length,
      expected: getOpenMeteoLocations().length,
      missing: Math.max(0, getOpenMeteoLocations().length - observations.length),
      duplicate: 0,
    },
  };
}

async function getPayload() {
  if (cache && cache.expiresAt > Date.now()) return cache.payload;
  const payload = await buildPayload();
  cache = { expiresAt: Date.now() + cacheTtlMs, payload };
  return payload;
}

async function analyzeCsv(content: string) {
  const lines = content.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new Error("CSV must contain a header and at least one data row");
  const header = lines[0].split(",").map((item) => item.trim().toLowerCase());
  const aliases: Record<string, string[]> = {
    timestamp: ["timestamp", "time", "datetime", "date_time"],
    station_id: ["station_id", "station", "stationid", "call_sign"],
    temperature: ["temperature", "temp", "curr_temp"],
    pressure: ["pressure", "mslp", "surface_pressure"],
    humidity: ["humidity", "rh", "relative_humidity"],
  };
  const indexOf = (name: string) => header.findIndex((column) => aliases[name].includes(column));
  const indices = Object.fromEntries(Object.keys(aliases).map((name) => [name, indexOf(name)]));
  const missing = Object.entries(indices).filter(([, index]) => index < 0).map(([name]) => name);
  if (missing.length) throw new Error(`Missing required columns: ${missing.join(", ")}`);

  const observations: Observation[] = [];
  const errors: string[] = [];
  for (let rowIndex = 1; rowIndex < lines.length; rowIndex++) {
    const columns = lines[rowIndex].split(",");
    const raw = {
      timestamp: columns[indices.timestamp],
      station_id: columns[indices.station_id],
      temperature: columns[indices.temperature],
      pressure: columns[indices.pressure],
      humidity: columns[indices.humidity],
      latitude: 0,
      longitude: 0,
    };
    const observation = normaliseObservation(raw, rowIndex);
    if (!observation || observation.latitude === 0 || observation.longitude === 0) {
      // CSV analysis does not require coordinates, so construct a validated row separately.
      const temperature = asNumber(raw.temperature);
      const humidity = asNumber(raw.humidity);
      const pressure = asNumber(raw.pressure);
      const timestamp = Date.parse(String(raw.timestamp));
      if (!raw.station_id || !Number.isFinite(temperature) || !Number.isFinite(humidity) || !Number.isFinite(pressure) || !Number.isFinite(timestamp)) {
        errors.push(`Row ${rowIndex + 1}: invalid timestamp/station/measurement value`);
        continue;
      }
      observations.push({ station_id: String(raw.station_id), station_name: String(raw.station_id), latitude: 0, longitude: 0, temperature, humidity, pressure, timestamp: new Date(timestamp).toISOString() });
    } else observations.push(observation);
  }

  const byStation = new Map<string, Observation[]>();
  for (const row of observations) byStation.set(row.station_id, [...(byStation.get(row.station_id) ?? []), row]);
  const results: ApiStation[] = [];
  for (const stationRows of byStation.values()) {
    const profile = buildProfile(stationRows);
    if (profile) profiles.set(stationRows[0].station_id, profile);
    const latest = [...stationRows].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))[0];
    results.push(scoreObservation(latest, stationRows));
  }
  return { rows: observations.length, stations: results, errors, model: "Isolation Forest + robust station baseline" };
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  app.use(express.json({ limit: "12mb" }));

  app.get("/api/health", async (_req, res) => {
    try {
      const payload = await getPayload();
      res.json({ ok: true, backend: "online", source: payload.source, imd_configured: Boolean(imdUrl && imdToken), last_sync: payload.last_sync, stations: payload.stations.length, model: payload.model, weather_event: payload.weather_event.classification });
    } catch (error) {
      res.status(502).json({ ok: false, backend: "online", error: error instanceof Error ? error.message : "Weather source unavailable" });
    }
  });

  app.get("/api/config", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json(detectorConfig);
  });

  app.post("/api/config", (req, res) => {
    const body = req.body ?? {};
    const next = {
      warning_score: clamp(Number(body.warning_score ?? detectorConfig.warning_score), 0.05, 0.95),
      critical_score: clamp(Number(body.critical_score ?? detectorConfig.critical_score), 0.1, 0.99),
      regional_fraction: clamp(Number(body.regional_fraction ?? detectorConfig.regional_fraction), 0.2, 1),
    };
    if (![next.warning_score, next.critical_score, next.regional_fraction].every(Number.isFinite)) return res.status(400).json({ ok: false, error: "Detector values must be numeric" });
    if (next.critical_score <= next.warning_score) return res.status(400).json({ ok: false, error: "critical_score must be greater than warning_score" });
    detectorConfig = next;
    cache = null;
    res.json({ ok: true, detector_config: detectorConfig });
  });

  app.get("/api/history", async (req, res) => {
    const hours = clamp(Number(req.query.hours || 24), 1, 168);
    const stationId = typeof req.query.station_id === "string" ? req.query.station_id : undefined;
    res.setHeader("Cache-Control", "no-store");
    res.json({ station_id: stationId ?? "all", hours, readings: await readHistory(stationId, hours) });
  });

  app.post("/api/analyze", async (req, res) => {
    try {
      const content = typeof req.body?.csv === "string" ? req.body.csv : "";
      if (!content) return res.status(400).json({ ok: false, error: "Send CSV content in the 'csv' field" });
      res.json({ ok: true, ...(await analyzeCsv(content)) });
    } catch (error) {
      res.status(400).json({ ok: false, error: error instanceof Error ? error.message : "Dataset analysis failed" });
    }
  });

  app.get("/api/realtime", async (_req, res) => {
    try {
      const payload = await getPayload();
      res.setHeader("Cache-Control", "no-store");
      res.json(payload);
    } catch (error) {
      res.status(502).json({ ok: false, error: error instanceof Error ? error.message : "Realtime source unavailable" });
    }
  });

  const staticPath = process.env.NODE_ENV === "production" ? path.resolve(__dirname, "public") : path.resolve(__dirname, "..", "dist", "public");
  app.use(express.static(staticPath));
  app.get("*", (_req, res) => res.sendFile(path.join(staticPath, "index.html")));

  server.listen(port, () => console.log(`SkyGuard API + frontend server running on http://localhost:${port}/`));
}

startServer().catch((error) => { console.error(error); process.exit(1); });
