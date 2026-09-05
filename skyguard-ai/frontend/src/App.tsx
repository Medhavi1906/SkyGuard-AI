import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertCircle,
  BarChart3,
  Bell,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  CloudLightning,
  Database,
  Download,
  Gauge,
  Layers3,
  LayoutDashboard,
  Menu,
  MoreHorizontal,
  Play,
  Radio,
  RotateCcw,
  Search,
  Server,
  Settings2,
  ShieldCheck,
  Sparkles,
  Thermometer,
  Upload,
  UserRound,
  Wind,
  X,
  Zap,
} from "lucide-react";
import "./page-specific.css";
import { isUsableRealtimeResponse } from "./lib/realtime";
import { STATIONS } from "@shared/stations";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const temperatures = [
  { time: "09:10", value: 25.8, pressure: 1010.8, humidity: 68, anomaly: false },
  { time: "09:25", value: 26.1, pressure: 1010.6, humidity: 69, anomaly: false },
  { time: "09:40", value: 26.3, pressure: 1010.5, humidity: 70, anomaly: false },
  { time: "09:55", value: 26.2, pressure: 1010.4, humidity: 69, anomaly: false },
  { time: "10:10", value: 26.6, pressure: 1010.2, humidity: 70, anomaly: false },
  { time: "10:25", value: 27.1, pressure: 1009.9, humidity: 71, anomaly: false },
  { time: "10:40", value: 27.4, pressure: 1009.8, humidity: 71, anomaly: true },
  { time: "10:55", value: 27.2, pressure: 1009.7, humidity: 72, anomaly: false },
  { time: "11:10", value: 27.5, pressure: 1009.5, humidity: 72, anomaly: false },
];

const pressureSeries = temperatures.map((item) => ({ time: item.time, value: item.pressure }));
const humiditySeries = temperatures.map((item) => ({ time: item.time, value: item.humidity }));

const stations = STATIONS.map((item, index) => ({
  ...item,
  id: item.station_id,
  name: item.station_name,
  location: `${item.latitude.toFixed(2)}° N · ${item.longitude.toFixed(2)}° E`,
  status: index % 17 === 2 ? "Critical" : index % 11 === 1 ? "Warning" : "Healthy",
  health: index % 17 === 2 ? 64 : index % 11 === 1 ? 87 : 94 + (index % 6),
  temp: "—", pressure: "—", humidity: "—", color: index % 17 === 2 ? "red" : index % 11 === 1 ? "amber" : "green",
  mapX: 270, mapY: 185, deviations: { temperature: "—", humidity: "—", pressure: "—" }, affected: index % 17 === 2 ? ["temperature", "humidity"] : index % 11 === 1 ? ["temperature"] : [],
}));

const alerts = [
  { id: "ALT-1042", station: "AWS-003", title: "Temperature sensor spike", type: "CRITICAL", confidence: 94, time: "10:42 AM", description: "Temperature deviated sharply from the station’s learned recent behavior while pressure and humidity remained comparatively stable.", action: "Inspect the temperature sensor and communication channel.", color: "red" },
  { id: "ALT-1037", station: "AWS-001", title: "Possible drift detected", type: "WARNING", confidence: 81, time: "10:37 AM", description: "A slow positive drift is visible across the last 6 hours. The signal remains plausible but is moving outside the station baseline.", action: "Schedule a calibration check within the next maintenance window.", color: "amber" },
  { id: "ALT-1031", station: "AWS-002", title: "Communication interruption", type: "INFO", confidence: 67, time: "10:31 AM", description: "Three readings were not received in sequence. The station recovered without a manual restart.", action: "Review the station modem and signal history.", color: "blue" },
];

type Station = typeof stations[number] & {
  confidence?: number;
  anomaly_score?: number;
  explanation?: string;
  suspected_cause?: string;
  recommended_action?: string;
  affected?: string[];
};
type Alert = typeof alerts[number];
type DetectorConfig = { warning_score: number; critical_score: number; regional_fraction: number };

const navItems = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Stations", icon: Radio },
  { label: "Alerts", icon: AlertCircle },
  { label: "Analytics", icon: BarChart3 },
  { label: "Sensor health", icon: Gauge },
];

function LogoMark({ small = false }: { small?: boolean }) {
  return (
    <div className={`logo-mark ${small ? "logo-mark-small" : ""}`} aria-label="SkyGuard AI">
      <span className="logo-orbit orbit-a" />
      <span className="logo-orbit orbit-b" />
      <span className="logo-core" />
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const color = status === "Healthy" ? "green" : status === "Warning" ? "amber" : "red";
  return <span className={`status-pill status-${color}`}><span className="status-dot" />{status}</span>;
}

function MetricCard({ icon: Icon, label, value, detail, accent }: { icon: typeof Activity; label: string; value: string; detail: string; accent: string }) {
  return (
    <div className="metric-card">
      <div className={`metric-icon ${accent}`}><Icon size={18} strokeWidth={1.8} /></div>
      <div className="metric-copy"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>
      <MoreHorizontal className="metric-more" size={17} />
    </div>
  );
}

function StationModel({ station, running }: { station: typeof stations[number]; running: boolean }) {
  const isCritical = station.color === "red";
  const affected = station.affected;
  const hasFault = affected.length > 0;
  return (
    <div className={`station-stage ${running ? "stage-running" : ""} ${hasFault ? "inspection-mode" : ""}`}>
      <div className="stage-grid" />
      <div className="compass compass-n">N</div><div className="compass compass-e">E</div><div className="compass compass-s">S</div><div className="compass compass-w">W</div>
      <div className="inspection-ribbon"><span className={hasFault ? "fault-live" : "fault-clear"}>{hasFault ? "FAULT ISOLATION VIEW" : "ALL SENSORS NOMINAL"}</span><small>{hasFault ? `${affected.length} affected component${affected.length > 1 ? "s" : ""}` : "baseline comparison active"}</small></div>
      <div className="station-scene" style={{ transform: `rotateX(57deg) rotateZ(-32deg) rotateY(${isCritical ? -7 : -13}deg)` }}>
        <div className="tower-shadow" />
        <div className="station-foot foot-a" /><div className="station-foot foot-b" /><div className="station-foot foot-c" />
        <div className="tower-frame frame-left" /><div className="tower-frame frame-right" /><div className="tower-frame frame-back" />
        <div className="tower-cross cross-one" /><div className="tower-cross cross-two" /><div className="tower-cross cross-three" />
        <div className={`sensor-box ${isCritical ? "sensor-critical" : ""}`}><span className="sensor-light" /><span className={`fault-pin pin-temperature ${affected.includes("temperature") ? "pin-active" : ""}`} /><span className={`fault-pin pin-pressure ${affected.includes("pressure") ? "pin-active" : ""}`} /></div>
        <div className="sensor-mast"><div className="mast-cap" /><span className={`fault-pin pin-humidity ${affected.includes("humidity") ? "pin-active" : ""}`} /></div>
        <div className={`sensor-arm arm-left ${affected.includes("pressure") ? "arm-affected" : ""}`}><span className="anemometer" /></div>
        <div className={`sensor-arm arm-right ${affected.includes("humidity") ? "arm-affected" : ""}`}><span className="rain-gauge" /></div>
        <div className={`wind-blade blade-one ${running ? "blade-spin" : ""}`} /><div className={`wind-blade blade-two ${running ? "blade-spin" : ""}`} /><div className={`wind-blade blade-three ${running ? "blade-spin" : ""}`} />
      </div>
      {affected.includes("temperature") && <div className="part-callout part-temperature"><span className="part-line" /><b>Temperature probe</b><small>+2.8σ · spike</small></div>}
      {affected.includes("humidity") && <div className="part-callout part-humidity"><span className="part-line" /><b>RH probe</b><small>−2.1σ · inconsistent</small></div>}
      {affected.includes("pressure") && <div className="part-callout part-pressure"><span className="part-line" /><b>Pressure port</b><small>+2.4σ · outlier</small></div>}
      {!hasFault && <div className="part-callout part-nominal"><span className="part-line" /><b>All components nominal</b><small>Within learned baseline</small></div>}
      <div className="station-callout callout-top"><span className="callout-line" /><div><b>Wind + rain sensors</b><small>Realtime telemetry</small></div></div>
      <div className={`station-callout callout-right ${isCritical ? "callout-alert" : ""}`}><span className="callout-line" /><div><b>{isCritical ? "Fault isolated" : "Station baseline"}</b><small>{isCritical ? "Inspect highlighted parts" : "Within learned range"}</small></div></div>
      <div className="model-footer"><div><span className="live-dot" />LIVE MODEL VIEW</div><span>Highlighted parts = model evidence</span></div>
    </div>
  );
}


function projectIndiaPoint(latitude: number, longitude: number) {
  const x = 80 + ((longitude - 68) / 30) * 400;
  const y = 340 - ((latitude - 8) / 29) * 300;
  return { x: Math.max(70, Math.min(490, x)), y: Math.max(32, Math.min(345, y)) };
}

function IndiaNetworkMap({ stations, selectedStation, onSelect, sourceStatus, sourceLabel, lastSync, visualLayer, onLayerChange }: { stations: Station[]; selectedStation: Station; onSelect: (station: Station) => void; sourceStatus: "live" | "replay" | "connecting"; sourceLabel: string; lastSync: string; visualLayer: string; onLayerChange: (layer: string) => void }) {
  return <div className={`india-map-stage layer-${visualLayer.toLowerCase()}`}><div className="map-topline"><span><span className={`status-dot ${sourceStatus === "live" ? "status-dot-green" : sourceStatus === "connecting" ? "status-dot-amber" : "status-dot-blue"}`} /> {sourceStatus === "connecting" ? "CONNECTING TO WEATHER SOURCE" : `${sourceLabel} · LIVE`}</span><span>Network geometry · India</span><div className="layer-control"><small>VISUAL LAYER</small>{["Stations", "Temperature", "Humidity", "Pressure", "Anomalies"].map((layer) => <button key={layer} className={visualLayer === layer ? "active" : ""} onClick={() => onLayerChange(layer)}>{layer}</button>)}</div></div><div className="india-map-grid" /><svg className="india-map-svg" viewBox="0 0 560 370" role="img" aria-label="3D India weather station network map"><defs><linearGradient id="indiaLand" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#1e5a71" stopOpacity=".92" /><stop offset="100%" stopColor="#12283d" stopOpacity=".7" /></linearGradient><filter id="mapGlow"><feGaussianBlur stdDeviation="5" /></filter></defs><path className="india-shadow" d="M214 31 L275 46 310 76 346 93 371 128 402 142 393 178 416 207 399 247 375 269 369 308 341 343 313 329 294 360 270 340 251 304 223 284 213 249 185 223 171 183 187 150 169 120 182 88Z" /><path className="india-land" d="M214 31 L275 46 310 76 346 93 371 128 402 142 393 178 416 207 399 247 375 269 369 308 341 343 313 329 294 360 270 340 251 304 223 284 213 249 185 223 171 183 187 150 169 120 182 88Z" /><path className="india-coast" d="M214 31 L275 46 310 76 346 93 371 128 402 142 393 178 416 207 399 247 375 269 369 308 341 343 313 329 294 360 270 340 251 304 223 284 213 249 185 223 171 183 187 150 169 120 182 88Z" /><path className="route-line" d="M270 249 C251 232 249 226 278 229 C287 214 284 201 305 180" /><path className="route-line route-secondary" d="M263 239 C252 235 260 226 278 229" />{stations.map((station) => { const point = projectIndiaPoint(station.latitude, station.longitude); return <g key={station.id} className="map-station" onClick={() => onSelect(station)} role="button" tabIndex={0} onKeyDown={(event) => event.key === "Enter" && onSelect(station)}><circle cx={point.x} cy={point.y} r={station.id === selectedStation.id ? 15 : 5.5} className={`station-halo ${station.color}`} /><circle cx={point.x} cy={point.y} r={station.id === selectedStation.id ? 7 : 2.7} className={`station-node ${station.color}`} /><text x={point.x + 8} y={point.y - 7} className={`station-label ${station.id === selectedStation.id ? "selected" : "station-label-hidden"}`}>{station.id}</text></g>; })}</svg><div className="map-legend"><span><i className="green" />Healthy {stations.filter((station) => station.status === "Healthy").length}</span><span><i className="amber" />Warning {stations.filter((station) => station.status === "Warning").length}</span><span><i className="red" />Anomaly {stations.filter((station) => station.status === "Critical").length}</span></div><div className="map-footer"><span><b>{stations.length.toString().padStart(2, "0")}</b> stations</span><span><b>{stations.filter((station) => station.status === "Healthy").length.toString().padStart(2, "0")}</b> healthy</span><span><b>{stations.filter((station) => station.status === "Critical").length.toString().padStart(2, "0")}</b> critical</span><span><b>{lastSync}</b> last sync</span></div></div>;
}

function ExplainabilityPanel({ station }: { station: Station }) {
  const rows = [{ label: "Temperature", value: station.deviations.temperature, width: station.color === "red" ? "92%" : station.color === "amber" ? "63%" : "22%", color: "red" }, { label: "Humidity", value: station.deviations.humidity, width: station.color === "red" ? "76%" : station.color === "amber" ? "46%" : "19%", color: "blue" }, { label: "Pressure", value: station.deviations.pressure, width: station.color === "red" ? "83%" : station.color === "amber" ? "39%" : "16%", color: "amber" }];
  return <div className="xai-panel"><div className="xai-heading"><div><span className="eyebrow">Selected station</span><h3>{station.id}</h3><span>{station.name} · {station.location}</span></div><StatusPill status={station.status} /></div><div className="xai-confidence"><div className={`xai-status ${station.color}`}><AlertCircle size={16} />{station.status === "Critical" ? "Anomaly detected" : station.status === "Warning" ? "Review recommended" : "Within baseline"}</div><div className="confidence-number"><strong>{station.confidence ?? (station.status === "Critical" ? 94 : station.status === "Warning" ? 81 : 98)}%</strong><small>confidence</small></div></div><h4>Why was this station flagged?</h4><div className="deviation-list">{rows.map((row) => <div className="deviation-row" key={row.label}><div><span>{row.label}</span><b>{row.value}</b></div><span className="deviation-track"><i className={row.color} style={{ width: row.width }} /></span></div>)}</div><div className="xai-explanation"><span className="eyebrow">AI explanation</span><p>{station.explanation ?? (station.status === "Critical" ? "The station's temperature increased sharply compared with its recent temporal pattern. At the same time, relative humidity dropped significantly while atmospheric pressure remained inconsistent with neighboring observations." : station.status === "Warning" ? "The station remains plausible, but its rolling pattern is moving outside the learned station baseline. Cross-variable evidence is moderate and requires review." : "The station's recent readings agree with its learned temporal pattern and neighboring observations. No sensor fault signal is currently dominant.")}</p></div><div className="xai-evidence"><span><b>Suspected cause</b><small>{station.suspected_cause ?? (station.status === "Critical" ? "Possible sensor spike / multivariate inconsistency" : station.status === "Warning" ? "Possible gradual drift" : "Normal observation")}</small></span><span><b>Recommended action</b><small>{station.recommended_action ?? (station.status === "Critical" ? "Inspect temperature and humidity sensors; verify against nearby AWS observations." : station.status === "Warning" ? "Schedule calibration review within the next maintenance window." : "Continue monitoring; no action required.")}</small></span></div></div>;
}


function InstrumentStrip({ sourceStatus, sourceLabel, simulation, stationCount, healthyCount, warningCount, anomalyCount }: { sourceStatus: "live" | "replay" | "connecting"; sourceLabel: string; simulation: boolean; stationCount: number; healthyCount: number; warningCount: number; anomalyCount: number }) {
  return <div className="instrument-strip"><div className="strip-label"><span className="eyebrow">Mission status</span><b>SKYGUARD / WEATHER DATA YOU CAN TRUST</b></div><div className="strip-stat"><strong>{String(stationCount).padStart(2, "0")}</strong><span>STATIONS</span></div><div className="strip-stat"><strong>{String(healthyCount + warningCount + anomalyCount).padStart(2, "0")}</strong><span>ONLINE</span></div><div className="strip-stat warning"><strong>{String(warningCount).padStart(2, "0")}</strong><span>WARNING</span></div><div className="strip-stat anomaly"><strong>{String(anomalyCount).padStart(2, "0")}</strong><span>ANOMALIES</span></div><div className="strip-state"><span className={`status-dot ${sourceStatus === "live" ? "status-dot-green" : sourceStatus === "connecting" ? "status-dot-amber" : "status-dot-blue"}`} /><span>{sourceStatus === "connecting" ? "CONNECTING TO WEATHER SOURCE" : `${sourceLabel} · CONNECTED`}</span></div></div>;
}

function WeatherEventBanner({ event }: { event: { classification: string; label: string; confidence: number; evidence: string; affected_stations: string[] } }) {
  const tone = event.classification === "regional_weather" ? "regional" : event.classification === "sensor_fault" ? "sensor" : "mixed";
  return <div className={`weather-event-banner ${tone}`}><div><span className="eyebrow">Network weather-event detector</span><strong>{event.label}</strong><p>{event.evidence}</p></div><div className="event-confidence"><b>{event.confidence}%</b><span>confidence</span><small>{event.affected_stations.length ? `${event.affected_stations.length} stations affected` : "No broad event"}</small></div></div>;
}

function ForensicReport({ station, onInvestigate }: { station: Station; onInvestigate: () => void }) {
  const critical = station.color === "red";
  return <section className="forensic-panel"><div className="forensic-head"><div><span className="eyebrow">Forensic station report</span><h2>Why SkyGuard flagged this</h2><p>{station.id} · {station.name} · {station.location}</p></div><span className={`forensic-verdict ${critical ? "anomaly" : station.color === "amber" ? "warning" : "normal"}`}>{critical ? "POSSIBLE SENSOR FAULT" : station.color === "amber" ? "REVIEW REQUIRED" : "NORMAL BASELINE"}</span></div><div className="forensic-grid"><div className="forensic-chain"><div className="chain-step"><b>01</b><span>Normal baseline</span><small>Station-calibrated temporal pattern</small></div><div className="chain-arrow">↓</div><div className="chain-step"><b>02</b><span>{critical ? "Temperature changed rapidly" : "Signal moved outside baseline"}</span><small>{station.deviations.temperature} temperature deviation</small></div><div className="chain-arrow">↓</div><div className="chain-step"><b>03</b><span>{critical ? "Humidity deviated unusually" : "Cross-variable evidence reviewed"}</span><small>{station.deviations.humidity} relative humidity</small></div><div className="chain-arrow">↓</div><div className="chain-step"><b>04</b><span>{critical ? "Multivariate relationship broke" : "Nearby stations remained stable"}</span><small>{station.deviations.pressure} pressure deviation</small></div></div><div className="forensic-assessment"><span className="eyebrow">AI assessment</span><strong>{critical ? "Possible sensor fault" : station.color === "amber" ? "Possible gradual drift" : "No fault indicated"}</strong><div className="assessment-confidence"><span>Confidence</span><b>{critical ? "94%" : station.color === "amber" ? "81%" : "98%"}</b></div><p>{station.explanation ?? (critical ? "Localized anomaly detected. Nearby observations remain comparatively stable, increasing the likelihood of a station-level sensor issue rather than a regional weather event." : station.color === "amber" ? "Pattern needs operator review before escalation. Evidence is not yet strong enough to call a sensor failure." : "Observed values remain consistent with the station baseline and surrounding network.")}</p><button className="forensic-action" onClick={onInvestigate}>Open station investigation <ChevronRight size={14} /></button></div></div></section>;
}

function TelemetryChart({ mode, running }: { mode: "temperature" | "pressure" | "humidity"; running: boolean }) {
  const config = {
    temperature: { data: temperatures, color: "#e28a52", value: "27.4°", unit: "°C", label: "Temperature", min: 24, max: 30 },
    pressure: { data: pressureSeries, color: "#9c9b91", value: "1009.8", unit: "hPa", label: "Pressure", min: 1004, max: 1013 },
    humidity: { data: humiditySeries, color: "#61e7c1", value: "71", unit: "%", label: "Humidity", min: 60, max: 85 },
  }[mode];
  const data = running && mode === "temperature" ? [...config.data.slice(0, -1), { ...config.data[config.data.length - 1], value: 31.8, anomaly: true }] : config.data;
  return (
    <div className="telemetry-card">
      <div className="telemetry-head"><div><span className="eyebrow">{config.label}</span><strong>{config.value}<em>{config.unit}</em></strong></div><span className="telemetry-delta">{mode === "temperature" ? "+0.8°" : mode === "pressure" ? "−1.3" : "+2%"}<small>vs baseline</small></span></div>
      <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -20 }}>
        <CartesianGrid strokeDasharray="2 5" stroke="#223047" vertical={false} />
        <XAxis dataKey="time" stroke="#63718a" tickLine={false} axisLine={false} tick={{ fontSize: 9 }} interval={2} />
        <YAxis domain={[config.min, config.max]} stroke="#63718a" tickLine={false} axisLine={false} tick={{ fontSize: 9 }} />
        <Tooltip contentStyle={{ background: "#111b2b", border: "1px solid #263750", borderRadius: 10, color: "#f4f7fb", fontSize: 11 }} />
        <Line type="monotone" dataKey="value" stroke={config.color} strokeWidth={2.3} dot={(props: any) => props.payload.anomaly ? <circle key={`anomaly-dot-${props.index}`} cx={props.cx} cy={props.cy} r={5} fill="#ff6577" stroke="#ffb5bd" strokeWidth={2} /> : <circle key={`normal-dot-${props.index}`} cx={props.cx} cy={props.cy} r={2.3} fill={config.color} />} activeDot={{ r: 4 }} />
      </LineChart></ResponsiveContainer></div>
      <div className="chart-foot"><span><i className="legend-line" style={{ background: config.color }} />learned baseline</span>{mode === "temperature" && <span><i className="legend-anomaly" />fault injection</span>}<span>last 2 hours</span></div>
    </div>
  );
}


function LandingNetworkHero({ stations }: { stations: Station[] }) {
  return <div className="landing-network-hero"><div className="landing-network-head"><span><span className="status-dot status-dot-green" /> REAL-TIME AWS INTELLIGENCE NETWORK</span><b>INDIA / {stations.length.toString().padStart(2, "0")} STATIONS</b></div><div className="landing-map-grid" /><svg className="landing-india-map" viewBox="0 0 560 370" role="img" aria-label="India weather station network"><defs><linearGradient id="heroIndia" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#30382d" /><stop offset="100%" stopColor="#151a16" /></linearGradient><filter id="heroGlow"><feGaussianBlur stdDeviation="4" /></filter></defs><path className="hero-land-shadow" d="M214 31 L275 46 310 76 346 93 371 128 402 142 393 178 416 207 399 247 375 269 369 308 341 343 313 329 294 360 270 340 251 304 223 284 213 249 185 223 171 183 187 150 169 120 182 88Z" /><path className="hero-land" d="M214 31 L275 46 310 76 346 93 371 128 402 142 393 178 416 207 399 247 375 269 369 308 341 343 313 329 294 360 270 340 251 304 223 284 213 249 185 223 171 183 187 150 169 120 182 88Z" /><path className="hero-contour contour-a" d="M172 167 C228 115 315 132 397 190 S375 290 302 330" /><path className="hero-contour contour-b" d="M195 104 C281 86 359 116 401 168 S348 272 247 286" /><path className="hero-contour contour-c" d="M187 212 C250 166 337 183 395 235" /><path className="hero-route" d="M263 239 C251 231 257 226 278 229 C286 213 288 196 306 180" />{stations.map((station) => <g key={station.id} className={`hero-tower ${station.color}`} transform={`translate(${projectIndiaPoint(station.latitude, station.longitude).x - 270}, ${projectIndiaPoint(station.latitude, station.longitude).y - 185})`}><circle className="hero-node-pulse" cx="270" cy="185" r={station.color === "red" ? 18 : 10} /><circle className="hero-node" cx="270" cy="185" r="4" /><path d="M270 181 L270 166 M261 171 L279 171 M270 181 L263 190 M270 181 L277 190" className="tower-glyph" /><text x="282" y="181" className="hero-station-label">{station.id}</text></g>)}</svg><div className="landing-network-callout"><span className="status-dot status-dot-red" /><div><b>AWS-003 / PALAKKAD EAST</b><small>localized anomaly · 3 sensor deviations</small></div></div><div className="landing-network-footer"><span><b>{stations.length.toString().padStart(2, "0")}</b> stations</span><span><b>{stations.filter((station) => station.status === "Healthy").length.toString().padStart(2, "0")}</b> healthy</span><span><b>{stations.filter((station) => station.status === "Critical").length.toString().padStart(2, "0")}</b> anomaly</span><span><b>94%</b> model confidence</span></div></div>;
}

function Landing({ onOpen, onAnalyze }: { onOpen: () => void; onAnalyze: () => void }) {
  return (
    <div className="landing-page">
      <header className="landing-nav"><div className="brand-lockup"><LogoMark /><div><strong>SKYGUARD<span>AI</span></strong><small>weather intelligence</small></div></div><div className="landing-nav-links"><a href="#why">Why SkyGuard</a><a href="#workflow">How it works</a><button className="nav-signin" onClick={onOpen}>Operator sign in <ChevronRight size={15} /></button></div></header>
      <main className="landing-main"><div className="hero-copy"><div className="kicker"><span className="pulse-ring" />SIH 2026 · AWS anomaly intelligence</div><h1>WEATHER DATA <span>YOU CAN TRUST.</span></h1><p>Real-time intelligence for automatic weather stations. Investigate changes, separate regional weather events from sensor faults, and act on evidence.</p><div className="hero-actions"><button className="primary-button" onClick={onOpen}><span>Access monitoring dashboard</span><ChevronRight size={17} /></button><button className="ghost-button" onClick={onAnalyze}><Upload size={16} /> Analyze dataset</button></div><div className="hero-note"><ShieldCheck size={16} />Prototype environment · synthetic telemetry clearly labeled</div></div><div className="hero-visual"><LandingNetworkHero stations={stations} /><div className="hero-label label-left"><span>01</span><b>Network context</b><small>Physical AWS station nodes</small></div><div className="hero-label label-right"><span>02</span><b>Localized anomaly</b><small>Nearby stations remain stable</small></div></div></main><section id="why" className="landing-features"><div className="section-intro"><span className="eyebrow">A clearer signal in the noise</span><h2>From raw readings to a decision you can defend.</h2></div><div className="feature-row"><div className="feature-card"><div className="feature-number">01</div><Sparkles size={21} /><h3>AI anomaly detection</h3><p>Station-specific temporal baselines catch spikes, drift, frozen values, and multivariate inconsistencies.</p></div><div className="feature-card feature-active"><div className="feature-number">02</div><CloudLightning size={21} /><h3>Explainable alerts</h3><p>Every alert pairs anomaly score, confidence, contributing factors, and a recommended next action.</p></div><div className="feature-card"><div className="feature-number">03</div><Gauge size={21} /><h3>Sensor health intelligence</h3><p>Track maintenance risk across your network without pretending that a prototype predicts failure with certainty.</p></div></div></section><footer className="landing-footer"><span>SKYGUARD AI / 2026 PROTOTYPE</span><span>Built for intelligent weather operations</span></footer></div>
  );
}


function StationsPage({ stations, selectedStation, onSelect, onRun }: { stations: Station[]; selectedStation: Station; onSelect: (station: Station) => void; onRun: () => void }) {
  const [stateFilter, setStateFilter] = useState("All states");
  const [regionFilter, setRegionFilter] = useState("All regions");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const filteredStations = stations.filter((station) => (stateFilter === "All states" || station.state === stateFilter) && (regionFilter === "All regions" || station.region === regionFilter) && (statusFilter === "All statuses" || station.status === statusFilter));
  return <div className="workspace-page">
    <div className="page-hero panel"><div><span className="eyebrow">Network registry</span><h2>Station operations</h2><p>Inspect every automatic weather station, compare current readings, and open a focused 3D telemetry view.</p></div><button className="primary-button" onClick={onRun}><Play size={15} fill="currentColor" /> Run live simulation</button></div>
    <div className="station-filter-bar"><label>State<select value={stateFilter} onChange={(event) => setStateFilter(event.target.value)}><option>All states</option>{Array.from(new Set(stations.map((station) => station.state))).sort().map((state) => <option key={state}>{state}</option>)}</select></label><label>Region<select value={regionFilter} onChange={(event) => setRegionFilter(event.target.value)}><option>All regions</option>{Array.from(new Set(stations.map((station) => station.region))).sort().map((region) => <option key={region}>{region}</option>)}</select></label><label>Status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All statuses</option><option>Healthy</option><option>Warning</option><option>Critical</option></select></label><span className="filter-result">{filteredStations.length} of {stations.length} stations</span></div><div className="station-detail-grid"><section className="panel station-directory"><div className="panel-header"><div><span className="eyebrow">{stations.length} registered stations</span><h2>All stations</h2></div><span className="table-label">Filtered by selection</span></div><div className="station-table">{filteredStations.map((station) => <button key={station.id} className={`station-table-row ${selectedStation.id === station.id ? "selected" : ""}`} onClick={() => onSelect(station)}><span className={`station-status-icon ${station.color}`}><Radio size={16} /></span><span className="station-meta"><b>{station.id}</b><small>{station.name}</small></span><span className="station-location">{station.location}</span><StatusPill status={station.status} /><span className="station-health"><strong>{station.health}%</strong><span className="mini-progress"><i className={station.color} style={{ width: `${station.health}%` }} /></span></span><ChevronRight size={15} className="row-arrow" /></button>)}</div></section><section className="panel station-focus"><div className="panel-header"><div><span className="eyebrow">Selected station</span><h2>{selectedStation.id} <span className="muted-title">/ {selectedStation.name}</span></h2></div><StatusPill status={selectedStation.status} /></div><StationModel station={selectedStation} running={false} /></section></div>
    <div className="station-stat-grid"><MetricCard icon={Thermometer} label="Temperature" value={selectedStation.temp} detail="Latest reading" accent="red" /><MetricCard icon={Wind} label="Pressure" value={selectedStation.pressure} detail="hPa · latest" accent="blue" /><MetricCard icon={Activity} label="Humidity" value={selectedStation.humidity} detail="Relative humidity" accent="green" /></div>
  </div>;
}

function AlertsPage({ alerts, selectedAlert, onSelect }: { alerts: Alert[]; selectedAlert: Alert; onSelect: (alert: Alert) => void }) {
  return <div className="workspace-page"><div className="page-hero panel"><div><span className="eyebrow">Explainable alert center</span><h2>Investigate anomalies</h2><p>Review severity, confidence, evidence, and the next recommended action for every alert in the network.</p></div><div className="alert-summary"><strong>{alerts.length}</strong><span>open alerts</span></div></div><div className="alerts-layout"><section className="panel alert-center-list"><div className="panel-header"><div><span className="eyebrow">Live queue</span><h2>Open alerts</h2></div><span className="table-label">Newest first</span></div><div className="alert-list">{alerts.map((alert) => <button key={alert.id} className={`alert-row ${selectedAlert.id === alert.id ? "selected" : ""}`} onClick={() => onSelect(alert)}><span className={`alert-severity ${alert.color}`}>{alert.type === "CRITICAL" ? <AlertCircle size={16} /> : alert.type === "WARNING" ? <CloudLightning size={16} /> : <Radio size={16} />}</span><span className="alert-copy"><b>{alert.title}</b><small>{alert.station} · {alert.time} · {alert.id}</small></span><span className="alert-confidence"><strong>{alert.confidence}%</strong><small>confidence</small></span><ChevronRight size={15} className="row-arrow" /></button>)}</div><div className="queue-footer"><span><span className="status-dot status-dot-red" /> 1 critical</span><span><span className="status-dot status-dot-amber" /> 1 warning</span><span><span className="status-dot status-dot-blue" /> 1 info</span></div></section><section className="panel alert-detail-card"><div className="panel-header"><div><span className="eyebrow">Evidence review</span><h2>{selectedAlert.title}</h2></div><span className={`severity-tag ${selectedAlert.color}`}>{selectedAlert.type}</span></div><div className="analysis-content"><div className="analysis-score"><div className="score-ring" style={{ "--score": `${selectedAlert.confidence * 3.6}deg` } as React.CSSProperties}><div><strong>{selectedAlert.confidence}%</strong><small>confidence</small></div></div><div><b>{selectedAlert.station}</b><span>{selectedAlert.time} · anomaly score 0.86</span></div></div><p>{selectedAlert.description}</p><div className="factor-list"><div><span className="factor-bar factor-red" style={{ width: "89%" }} /><span>Temperature deviation from baseline</span><b>0.89</b></div><div><span className="factor-bar factor-amber" style={{ width: "64%" }} /><span>Abnormal rate of change</span><b>0.64</b></div><div><span className="factor-bar factor-blue" style={{ width: "41%" }} /><span>Multivariate inconsistency</span><b>0.41</b></div></div><div className="recommendation"><span><ShieldCheck size={16} /></span><div><small>Recommended action</small><b>{selectedAlert.action}</b></div></div></div></section></div></div>;
}

function AnalyticsPage({ history, hours, onHoursChange }: { history: Array<{ time: string; humidity: number }>; hours: number; onHoursChange: (hours: number) => void }) {
  const faultTypes = [{ label: "Spike", value: 42, color: "red" }, { label: "Drift", value: 27, color: "amber" }, { label: "Communication", value: 18, color: "blue" }, { label: "Noise burst", value: 13, color: "purple" }];
  return <div className="workspace-page"><div className="page-hero panel"><div><span className="eyebrow">Backend history + model evaluation</span><h2>Model analytics</h2><p>Trend readings from the stored observation stream and compare regional events with sensor-level faults.</p></div><span className="evaluation-chip"><Database size={15} /> {history.length ? `${history.length} stored readings` : "Awaiting history"}</span></div><div className="analytics-metrics"><MetricCard icon={Check} label="Precision" value="51.6%" detail="False positives remain a focus" accent="green" /><MetricCard icon={Activity} label="Recall" value="74.9%" detail="Injected faults detected" accent="blue" /><MetricCard icon={BarChart3} label="F1 score" value="61.1%" detail="Balanced performance" accent="purple" /></div><div className="analytics-grid"><section className="panel analytics-chart"><div className="panel-header"><div><span className="eyebrow">Stored humidity trend</span><h2>Network observations</h2></div><div className="history-range-picker">{[24, 72, 168].map((item) => <button key={item} className={hours === item ? "active" : ""} onClick={() => onHoursChange(item)}>{item === 24 ? "24 hours" : item === 72 ? "3 days" : "7 days"}</button>)}</div></div><div className="large-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={history.length ? history : temperatures}><defs><linearGradient id="analyticsFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#62b7ff" stopOpacity={.32} /><stop offset="100%" stopColor="#62b7ff" stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="2 5" stroke="#223047" vertical={false} /><XAxis dataKey="time" stroke="#63718a" tickLine={false} axisLine={false} tick={{ fontSize: 9 }} interval={1} /><YAxis stroke="#63718a" tickLine={false} axisLine={false} tick={{ fontSize: 9 }} /><Tooltip contentStyle={{ background: "#111b2b", border: "1px solid #263750", borderRadius: 10, color: "#f4f7fb", fontSize: 11 }} /><Area type="monotone" dataKey="humidity" stroke="#62b7ff" fill="url(#analyticsFill)" strokeWidth={2} /></AreaChart></ResponsiveContainer></div></section><section className="panel fault-panel"><div className="panel-header"><div><span className="eyebrow">Root cause mix</span><h2>Fault distribution</h2></div></div><div className="fault-bars">{faultTypes.map((fault) => <div className="fault-row" key={fault.label}><div><span>{fault.label}</span><b>{fault.value}%</b></div><span className="fault-track"><i className={fault.color} style={{ width: `${fault.value * 2}%` }} /></span></div>)}</div><div className="analytics-note"><CircleHelp size={14} /> Regional weather events are separated from localized sensor faults before escalation.</div></section></div></div>;
}

function HealthPage({ stations }: { stations: Station[] }) {
  const averageHealth = stations.length ? stations.reduce((sum, station) => sum + station.health, 0) / stations.length : 0;
  return <div className="workspace-page"><div className="page-hero panel"><div><span className="eyebrow">Maintenance risk index</span><h2>Sensor health intelligence</h2><p>Prioritize inspections using recent anomaly frequency, persistence, drift, and communication behavior.</p></div><span className="health-overview"><strong>{averageHealth.toFixed(1)}%</strong><small>network average</small></span></div><section className="panel health-table-panel"><div className="panel-header"><div><span className="eyebrow">Station health table</span><h2>Maintenance queue</h2></div><span className="table-label">Highest risk first</span></div><div className="health-table"><div className="health-table-head"><span>Station</span><span>Health</span><span>Risk</span><span>Anomaly rate</span><span>Recent faults</span><span>Last alert</span><span>Status</span></div>{stations.map((station) => <div className="health-table-row" key={station.id}><span><b>{station.id}</b><small>{station.name}</small></span><span className="health-value"><strong>{station.health}%</strong><i className={station.color} style={{ width: `${station.health}%` }} /></span><span className={`risk-label ${station.color}`}>{station.color === "green" ? "LOW" : station.color === "amber" ? "MEDIUM" : "HIGH"}</span><span>{(station.anomaly_score ? station.anomaly_score * 10 : 0).toFixed(1)}%</span><span>{station.affected?.length ? station.affected.join(" · ") : "None"}</span><span>{station.status === "Healthy" ? "—" : new Date(station.timestamp ?? Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span><StatusPill status={station.status} /></div>)}</div></section></div>;
}

function SettingsPage({ onBack, config, onSave }: { onBack: () => void; config: DetectorConfig; onSave: (config: DetectorConfig) => Promise<void> }) {
  const [saved, setSaved] = useState(false);
  const [draft, setDraft] = useState(config);
  return <div className="workspace-page"><div className="page-hero panel"><div><span className="eyebrow">Operator preferences</span><h2>Workspace settings</h2><p>Configure the demo workspace behavior and notification preferences.</p></div><button className="primary-button" onClick={async () => { await onSave(draft); setSaved(true); window.setTimeout(() => setSaved(false), 1800); }}>{saved ? <><Check size={15} /> Saved</> : <><Settings2 size={15} /> Save settings</>}</button></div><div className="settings-grid"><section className="panel settings-card"><div className="panel-header"><div><span className="eyebrow">Monitoring behavior</span><h2>Alert preferences</h2></div></div><label className="setting-row"><span><b>Critical alert sound</b><small>Play a sound when a high-severity anomaly arrives.</small></span><input type="checkbox" defaultChecked /></label><label className="setting-row"><span><b>Auto-start simulation</b><small>Keep disabled for reliable presentation control.</small></span><input type="checkbox" /></label><label className="setting-row"><span><b>Show technical factors</b><small>Expose contributing feature weights in alert detail.</small></span><input type="checkbox" defaultChecked /></label></section><section className="panel settings-card"><div className="panel-header"><div><span className="eyebrow">Model controls</span><h2>Detection sensitivity</h2></div></div><div className="threshold-form"><label>Warning score <output>{draft.warning_score.toFixed(2)}</output><input type="range" min="0.05" max="0.8" step="0.01" value={draft.warning_score} onChange={(event) => setDraft({ ...draft, warning_score: Number(event.target.value) })} /></label><label>Critical score <output>{draft.critical_score.toFixed(2)}</output><input type="range" min="0.1" max="0.99" step="0.01" value={draft.critical_score} onChange={(event) => setDraft({ ...draft, critical_score: Number(event.target.value) })} /></label><label>Regional event sensitivity <output>{Math.round(draft.regional_fraction * 100)}%</output><input type="range" min="0.2" max="1" step="0.05" value={draft.regional_fraction} onChange={(event) => setDraft({ ...draft, regional_fraction: Number(event.target.value) })} /></label></div><div className="model-detail"><div><span>Algorithm</span><b>Isolation Forest + robust baseline</b></div><div><span>Source</span><b>Open-Meteo / IMD when available</b></div></div></section></div><button className="back-link" onClick={onBack}><ChevronRight size={15} className="back-chevron" />Back to overview</button></div>;
}

function App() {
  const [view, setView] = useState<"landing" | "dashboard">(() => window.localStorage.getItem("skyguard_session") === "active" ? "dashboard" : "landing");
  const [activeNav, setActiveNav] = useState("Overview");
  const [selectedStation, setSelectedStation] = useState(stations[2]);
  const [selectedAlert, setSelectedAlert] = useState(alerts[0]);
  const [simulation, setSimulation] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [datasetOpen, setDatasetOpen] = useState(false);
  const [showAllOverviewStations, setShowAllOverviewStations] = useState(false);
  const [range, setRange] = useState("6 hours");
  const [sourceStatus, setSourceStatus] = useState<"live" | "replay" | "connecting">("connecting");
  const [sourceLabel, setSourceLabel] = useState("Connecting to weather source");
  const [lastSync, setLastSync] = useState("connecting");
  const [visualLayer, setVisualLayer] = useState("Stations");
  const [realtimeStations, setRealtimeStations] = useState<Station[]>(stations);
  const [weatherEvent, setWeatherEvent] = useState({ classification: "mixed", label: "Checking network conditions", confidence: 0, evidence: "Waiting for the first backend observation batch.", affected_stations: [] as string[] });
  const [history, setHistory] = useState<Array<{ time: string; humidity: number }>>([]);
  const [historyHours, setHistoryHours] = useState(24);
  const [detectorConfig, setDetectorConfig] = useState<DetectorConfig>({ warning_score: 0.32, critical_score: 0.62, regional_fraction: 0.5 });
  const [datasetResult, setDatasetResult] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const syncLiveSource = async () => {
      try {
        const response = await fetch("/api/realtime", { headers: { Accept: "application/json" } });
        if (!isUsableRealtimeResponse(response)) throw new Error("Realtime backend unavailable");
        const payload = await response.json();
        const mappedStations = Array.isArray(payload.stations) ? payload.stations.map((item: any) => {
          const base = stations.find((station) => station.id === item.station_id) ?? stations[0];
          return { ...base, id: item.station_id, name: item.station_name ?? base.name, location: `${Number(item.latitude).toFixed(2)}° N · ${Number(item.longitude).toFixed(2)}° E`, state: item.state ?? base.state ?? "Unknown", region: item.region ?? base.region ?? "Unknown", latitude: Number(item.latitude), longitude: Number(item.longitude), status: item.status ?? base.status, health: Number(item.health ?? base.health), temp: `${Number(item.temperature).toFixed(1)}°`, pressure: Number(item.pressure).toFixed(1), humidity: `${Number(item.humidity).toFixed(0)}%`, color: item.color ?? base.color, confidence: Number(item.confidence ?? 0), anomaly_score: Number(item.anomaly_score ?? 0), explanation: item.explanation, suspected_cause: item.suspected_cause, recommended_action: item.recommended_action, deviations: { temperature: `${Number(item.deviations?.temperature ?? 0).toFixed(1)}σ`, humidity: `${Number(item.deviations?.humidity ?? 0).toFixed(1)}σ`, pressure: `${Number(item.deviations?.pressure ?? 0).toFixed(1)}σ` }, affected: Array.isArray(item.affected) ? item.affected : item.status === "Critical" ? ["temperature", "humidity", "pressure"] : item.status === "Warning" ? ["humidity"] : [] };
        }) : [];
        if (mounted) {
          setRealtimeStations(mappedStations.length ? mappedStations : stations);
          setSelectedStation((current) => mappedStations.find((station: Station) => station.id === current.id) ?? current);
          setSourceStatus(payload.source === "live" || payload.source === "open-meteo" ? "live" : "replay");
          setSourceLabel(payload.source_label ?? "Weather source");
          if (payload.weather_event) setWeatherEvent(payload.weather_event);
          const historyResponse = await fetch(`/api/history?hours=${historyHours}`, { headers: { Accept: "application/json" } });
          if (isUsableRealtimeResponse(historyResponse)) {
            const historyPayload = await historyResponse.json();
            setHistory(Array.isArray(historyPayload.readings) ? historyPayload.readings.map((row: any) => ({ time: new Date(row.recorded_at ?? row.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), humidity: Number(row.humidity) })).filter((row: { humidity: number }) => Number.isFinite(row.humidity)).slice(-120) : []);
          }
        }
      } catch {
        if (mounted) setSourceStatus("replay");
      } finally {
        if (mounted) setLastSync(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      }
    };
    fetch("/api/config", { headers: { Accept: "application/json" } }).then((response) => response.json()).then((config) => mounted && setDetectorConfig(config)).catch(() => undefined);
    syncLiveSource();
    const interval = window.setInterval(syncLiveSource, 15000);
    return () => { mounted = false; window.clearInterval(interval); };
  }, [historyHours]);

  useEffect(() => {
    if (!simulation) return;
    const timer = window.setTimeout(() => setSimulation(false), 10000);
    return () => window.clearTimeout(timer);
  }, [simulation]);

  const liveStation = useMemo(() => simulation ? { ...selectedStation, health: 57, temp: "38.6°", status: "Critical" } : selectedStation, [selectedStation, simulation]);
  const activeStations = realtimeStations.length ? realtimeStations : stations;
  const activeAlerts = useMemo<Alert[]>(() => {
    const live = activeStations.filter((station) => station.status !== "Healthy").map((station, index) => ({
      id: `ALT-${String(1042 - index).padStart(4, "0")}`, station: station.id,
      title: station.status === "Critical" ? `${station.affected?.[0] ?? "Sensor"} anomaly detected` : `${station.affected?.[0] ?? "Signal"} needs review`,
      type: station.status === "Critical" ? "CRITICAL" as const : "WARNING" as const,
      confidence: station.confidence ?? Math.round(50 + (station.anomaly_score ?? 0) * 48),
      time: new Date(station.timestamp ?? Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      description: station.explanation ?? "The latest observation moved outside the learned station pattern.",
      action: station.recommended_action ?? "Compare the reading with nearby stations and inspect the sensor if the anomaly persists.",
      color: station.color === "red" ? "red" as const : "amber" as const,
    }));
    return live.length ? live : alerts;
  }, [activeStations]);
  useEffect(() => { if (activeAlerts.length && !activeAlerts.some((alert) => alert.id === selectedAlert.id)) setSelectedAlert(activeAlerts[0]); }, [activeAlerts, selectedAlert.id]);

  const openDashboard = () => { window.localStorage.setItem("skyguard_session", "active"); setView("dashboard"); setActiveNav("Overview"); };
  const openDataset = () => { openDashboard(); setDatasetOpen(true); setActiveNav("Analyze dataset"); };
  const logout = () => { window.localStorage.removeItem("skyguard_session"); setProfileOpen(false); setMenuOpen(false); setView("landing"); };

  if (view === "landing") return <Landing onOpen={openDashboard} onAnalyze={openDataset} />;

  const setNav = (label: string) => { setActiveNav(label); setMenuOpen(false); setProfileOpen(false); };
  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}><div className="sidebar-brand"><LogoMark small /><div><strong>SKYGUARD<span>AI</span></strong><small>weather intelligence</small></div><button className="mobile-close" onClick={() => setMenuOpen(false)}><X size={17} /></button></div><div className="sidebar-status"><span className="status-dot status-dot-green" /><span>Network nominal</span><small>Updated 11:12:08</small></div><nav className="side-nav"><span className="nav-label">Workspace</span>{navItems.map(({ label, icon: Icon }) => <button key={label} className={activeNav === label ? "active" : ""} onClick={() => setNav(label)}><Icon size={17} /><span>{label}</span>{label === "Alerts" && <b className="nav-count">{activeAlerts.length}</b>}</button>)}<span className="nav-label nav-label-spaced">Data</span><button className={activeNav === "Analyze dataset" ? "active" : ""} onClick={() => { setNav("Analyze dataset"); setDatasetOpen(true); }}><Database size={17} /><span>Analyze dataset</span></button><button onClick={() => setNav("Settings")}><Settings2 size={17} /><span>Settings</span></button></nav><div className="sidebar-bottom"><div className="model-badge"><span className="model-icon"><Zap size={15} /></span><div><b>Model online</b><small>v1.0.0 · Isolation Forest</small></div><span className="status-dot status-dot-green" /></div><button className="profile-row" onClick={() => setProfileOpen((value) => !value)}><div className="avatar">AS</div><div><b>Arjun S.</b><small>Operator</small></div><ChevronDown size={15} /></button>{profileOpen && <div className="sidebar-profile-menu"><button onClick={() => setNav("Settings")}><UserRound size={14} /> Account settings</button><button onClick={() => setNav("Alerts")}><Bell size={14} /> Alerts</button><button className="danger-action" onClick={logout}><RotateCcw size={14} /> Log out</button></div>}</div></aside>
      <main className="dashboard-main"><header className="topbar"><button className="mobile-menu" onClick={() => setMenuOpen(true)}><Menu size={20} /></button><div className="breadcrumbs"><span>Operations</span><ChevronRight size={14} /><b>{activeNav}</b></div><div className="topbar-actions"><button className="data-badge data-badge-button" onClick={() => setNav("Settings")}><span className={`status-dot ${sourceStatus === "live" ? "status-dot-green" : sourceStatus === "connecting" ? "status-dot-amber" : "status-dot-blue"}`} /> {sourceStatus === "connecting" ? "CONNECTING TO WEATHER SOURCE" : `${sourceLabel} · LIVE`} <ChevronDown size={13} /></button><button className="icon-button notification" onClick={() => setNav("Alerts")} title="Open alerts"><Bell size={18} /><i>{activeAlerts.length}</i></button><div className="profile-menu-wrap"><button className="top-user profile-trigger" onClick={() => setProfileOpen((value) => !value)} aria-expanded={profileOpen}><div className="avatar">AS</div><span>Arjun S.</span><ChevronDown size={14} /></button>{profileOpen && <div className="profile-menu"><button onClick={() => setNav("Settings")}><UserRound size={14} /> Account settings</button><button onClick={() => setNav("Alerts")}><Bell size={14} /> Notification center</button><button className="danger-action" onClick={logout}><RotateCcw size={14} /> Log out</button></div>}</div></div></header>
        <div className="dashboard-content"><div className="content-heading"><div><span className="eyebrow">{simulation ? "Replay fault injection in progress" : sourceStatus === "connecting" ? "Connecting to weather source" : `${sourceLabel} stream`}</span><h1>{activeNav === "Overview" ? "Weather data you can trust" : activeNav}</h1><p>{activeNav === "Overview" ? "Control-room view of India’s automatic weather-station network." : activeNav === "Analyze dataset" ? "Validate an AWS observation file before running anomaly detection." : "Monitor network behavior, review the evidence, and decide what happens next."}</p></div><div className="heading-actions"><button className={`simulation-button ${simulation ? "is-running" : ""}`} onClick={() => setSimulation((value) => !value)}>{simulation ? <><span className="spinner-dot" />Simulation running</> : <><Play size={15} fill="currentColor" />Start live simulation</>}</button><button className="square-button" onClick={() => setDatasetOpen(true)}><Upload size={16} /></button></div></div>
          {activeNav === "Stations" ? <StationsPage stations={activeStations} selectedStation={selectedStation} onSelect={setSelectedStation} onRun={() => setSimulation(true)} /> : activeNav === "Alerts" ? <AlertsPage alerts={activeAlerts} selectedAlert={selectedAlert} onSelect={setSelectedAlert} /> : activeNav === "Analytics" ? <AnalyticsPage history={history} hours={historyHours} onHoursChange={setHistoryHours} /> : activeNav === "Sensor health" ? <HealthPage stations={activeStations} /> : activeNav === "Settings" ? <SettingsPage config={detectorConfig} onBack={() => setNav("Overview")} onSave={async (nextConfig) => { const response = await fetch("/api/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(nextConfig) }); if (!response.ok) throw new Error("Unable to save detector settings"); const payload = await response.json(); setDetectorConfig(payload.detector_config ?? nextConfig); }} /> : activeNav === "Analyze dataset" ? <DatasetPanel onBack={() => setNav("Overview")} onOpenUpload={() => setDatasetOpen(true)} /> : <>
            <InstrumentStrip sourceStatus={sourceStatus} sourceLabel={sourceLabel} simulation={simulation} stationCount={activeStations.length} healthyCount={activeStations.filter((station) => station.status === "Healthy").length} warningCount={activeStations.filter((station) => station.status === "Warning").length} anomalyCount={activeStations.filter((station) => station.status === "Critical").length} /><WeatherEventBanner event={weatherEvent} />
            <div className="dashboard-grid"><section className="panel network-panel"><div className="panel-header"><div><span className="eyebrow">Network overview</span><h2>Weather station network</h2></div><button className="small-link" onClick={() => setNav("Stations")}>View all stations <ChevronRight size={14} /></button></div><div className="station-list">{activeStations.slice(0, showAllOverviewStations ? activeStations.length : 8).map((station) => <button key={station.id} className={`station-row ${selectedStation.id === station.id ? "selected" : ""}`} onClick={() => setSelectedStation(station)}><span className={`station-status-icon ${station.color}`}><Radio size={16} /></span><span className="station-meta"><b>{station.id}</b><small>{station.name}</small></span><StatusPill status={station.id === liveStation.id ? liveStation.status : station.status} /><span className="station-health"><strong>{station.id === liveStation.id ? liveStation.health : station.health}%</strong><span className="mini-progress"><i className={station.color} style={{ width: `${station.id === liveStation.id ? liveStation.health : station.health}%` }} /></span></span><span className="station-reading"><b>{station.id === liveStation.id ? liveStation.temp : station.temp}</b><small>{station.id === liveStation.id ? "anomaly" : "latest °C"}</small></span><ChevronRight size={15} className="row-arrow" /></button>)}</div><button className="show-more-button" onClick={() => setShowAllOverviewStations((value) => !value)}>{showAllOverviewStations ? "Show less" : `Show ${Math.max(0, activeStations.length - 8)} more stations`} <ChevronDown size={14} className={showAllOverviewStations ? "rotate-180" : ""} /></button><div className="network-footer"><span><span className="status-dot status-dot-green" /> {activeStations.filter((station) => station.status === "Healthy").length} healthy</span><span><span className="status-dot status-dot-amber" /> {activeStations.filter((station) => station.status === "Warning").length} needs review</span><span>Last sync {lastSync}</span></div></section>
            <section className="panel station-panel network-visual-panel"><div className="panel-header"><div><span className="eyebrow">Real-time AWS intelligence network</span><h2>3D India station view <span className="muted-title">/ click a station to inspect</span></h2></div><button className="icon-button" onClick={() => setNav("Stations")} title="Open station registry"><Layers3 size={17} /></button></div><div className="network-visual-grid"><IndiaNetworkMap stations={activeStations} selectedStation={liveStation} onSelect={setSelectedStation} sourceStatus={sourceStatus} sourceLabel={sourceLabel} lastSync={lastSync} visualLayer={visualLayer} onLayerChange={setVisualLayer} /><ExplainabilityPanel station={liveStation} /></div></section>
            <ForensicReport station={liveStation} onInvestigate={() => setNav("Stations")} /><section className="panel telemetry-panel"><div className="panel-header"><div><span className="eyebrow">Live sensor monitoring</span><h2>{liveStation.id} telemetry</h2></div><div className="range-picker">{["1 hour", "6 hours", "24 hours"].map((item) => <button className={range === item ? "active" : ""} key={item} onClick={() => setRange(item)}>{item}</button>)}</div></div><div className="telemetry-grid"><TelemetryChart mode="temperature" running={simulation} /><TelemetryChart mode="pressure" running={simulation} /><TelemetryChart mode="humidity" running={simulation} /></div></section>
            <section className="panel alerts-panel"><div className="panel-header"><div><span className="eyebrow">Needs attention</span><h2>Anomaly alert feed</h2></div><button className="small-link" onClick={() => setNav("Alerts")}>Open alert center <ChevronRight size={14} /></button></div><div className="alert-list">{activeAlerts.slice(0, 5).map((alert) => <button key={alert.id} className={`alert-row ${selectedAlert.id === alert.id ? "selected" : ""}`} onClick={() => setSelectedAlert(alert)}><span className={`alert-severity ${alert.color}`}>{alert.type === "CRITICAL" ? <AlertCircle size={16} /> : alert.type === "WARNING" ? <CloudLightning size={16} /> : <Radio size={16} />}</span><span className="alert-copy"><b>{alert.title}</b><small>{alert.station} · {alert.time}</small></span><span className="alert-confidence"><strong>{alert.confidence}%</strong><small>confidence</small></span><ChevronRight size={15} className="row-arrow" /></button>)}</div></section>
            <section className="panel analysis-panel"><div className="panel-header"><div><span className="eyebrow">Selected alert</span><h2>Why was this flagged?</h2></div><span className={`severity-tag ${selectedAlert.color}`}>{selectedAlert.type}</span></div><div className="analysis-content"><div className="analysis-score"><div className="score-ring" style={{ "--score": `${selectedAlert.confidence * 3.6}deg` } as React.CSSProperties}><div><strong>{selectedAlert.confidence}%</strong><small>confidence</small></div></div><div><b>{selectedAlert.title}</b><span>{selectedAlert.station} · {selectedAlert.time}</span></div></div><p>{selectedAlert.description}</p><div className="factor-list"><div><span className="factor-bar factor-red" style={{ width: "89%" }} /><span>Temperature deviation from baseline</span><b>0.89</b></div><div><span className="factor-bar factor-amber" style={{ width: "64%" }} /><span>Abnormal rate of change</span><b>0.64</b></div><div><span className="factor-bar factor-blue" style={{ width: "41%" }} /><span>Multivariate inconsistency</span><b>0.41</b></div></div><div className="recommendation"><span><ShieldCheck size={16} /></span><div><small>Recommended action</small><b>{selectedAlert.action}</b></div></div></div></section>
          </div></>}
          {datasetResult && <div className="dataset-result-banner"><Check size={14} /> {datasetResult}</div>}<div className="content-disclaimer"><CircleHelp size={14} /> Primary source: IMD AWS / ARG when available; Open-Meteo is the active development source until IMD access is configured. An anomaly score explains model behavior; it does not prove a physical sensor fault.</div>
        </div></main>
      {datasetOpen && <DatasetModal onClose={() => setDatasetOpen(false)} onComplete={(message) => { setDatasetResult(message); }} />}
    </div>
  );
}

function DatasetPanel({ onBack, onOpenUpload }: { onBack: () => void; onOpenUpload: () => void }) {
  return <div className="workspace-page"><div className="dataset-hero"><div><span className="eyebrow">Historical analysis workspace</span><h2>Analyze an AWS dataset</h2><p>Upload a CSV, validate the expected schema, preview the observations, and run the same station-calibrated anomaly engine used in live monitoring.</p></div><div className="schema-chip"><Database size={16} /><span>Expected schema</span><b>timestamp · station_id · temperature · pressure · humidity</b></div></div><div className="dataset-drop"><div className="upload-icon"><Upload size={22} /></div><h3>Analyze historical observations</h3><p>CSV files up to 10 MB · validation happens before anomaly scoring</p><button className="primary-button" onClick={onOpenUpload}><Upload size={16} /> Choose CSV file</button><div className="dataset-note"><ShieldCheck size={14} /> Your file is processed locally through this project backend and is not silently discarded.</div></div><div className="dataset-steps"><div className="step active"><span>01</span><b>Validate</b><small>Schema + values</small></div><div className="step"><span>02</span><b>Preview</b><small>Inspect observations</small></div><div className="step"><span>03</span><b>Process</b><small>Feature engineering</small></div><div className="step"><span>04</span><b>Results</b><small>Explainable alerts</small></div></div><button className="back-link" onClick={onBack}><ChevronRight size={15} className="back-chevron" />Back to overview</button></div>;
}

function DatasetModal({ onClose, onComplete }: { onClose: () => void; onComplete: (message: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const chooseFile = () => inputRef.current?.click();
  const analyze = async (file: File) => {
    setBusy(true); setError(""); setResult(""); setFileName(file.name);
    try {
      if (!file.name.toLowerCase().endsWith(".csv")) throw new Error("Please choose a CSV file.");
      if (file.size > 10 * 1024 * 1024) throw new Error("The maximum file size is 10 MB.");
      const csv = await file.text();
      const response = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ csv }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Dataset analysis failed.");
      const message = `${payload.rows} observations processed across ${payload.stations?.length ?? 0} stations${payload.errors?.length ? ` · ${payload.errors.length} invalid rows skipped` : ""}.`;
      setResult(message); onComplete(message);
    } catch (err) { setError(err instanceof Error ? err.message : "Dataset analysis failed."); } finally { setBusy(false); }
  };
  return <div className="modal-backdrop" onClick={onClose}><div className="dataset-modal" onClick={(event) => event.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">Controlled input</span><h2>Analyze historical data</h2></div><button className="icon-button" onClick={onClose}><X size={17} /></button></div><input ref={inputRef} type="file" accept=".csv,text/csv" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void analyze(file); }} /><button className="modal-upload modal-upload-button" onClick={chooseFile}><div className="upload-icon"><Upload size={20} /></div><div><b>{fileName || "Upload a CSV file"}</b><p>timestamp, station_id, temperature, pressure, humidity</p></div><ChevronRight size={16} /></button><div className="modal-schema"><Check size={14} /> Schema validation runs before the model sees any data.</div>{busy && <div className="modal-status">Analyzing {fileName}…</div>}{result && <div className="modal-success"><Check size={14} /> {result}</div>}{error && <div className="modal-error"><AlertCircle size={14} /> {error}</div>}<div className="modal-actions"><button className="ghost-button" onClick={onClose}>Cancel</button><button className="primary-button" onClick={chooseFile} disabled={busy}><Zap size={15} /> {busy ? "Processing…" : "Choose CSV"}</button></div></div></div>;
}

export default App;
