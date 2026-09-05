# SkyGuard AI

SkyGuard AI is an automatic-weather-station anomaly detection dashboard. The current development data source is Open-Meteo; the backend can later switch to IMD AWS/ARG by setting the IMD environment variables.

## Project layout

- `frontend/` — React + Vite dashboard
- `backend/` — Express API, ingestion, anomaly detection and station registry
- `shared/` — data/types shared by frontend and backend
- `data/` — runtime observation history
- `docs/` — development/backend notes
- `patches/` — package patches

## Run

```bash
npm install
npm run dev:backend
```

In a second terminal:

```bash
npm run dev
```

Or build the complete application:

```bash
npm run build
npm start
```

The dashboard is available at `http://localhost:3000` in development and production.

## Data source

With no IMD credentials configured, SkyGuard automatically uses Open-Meteo and the bundled 100-station Indian network. Configure IMD later with:

```env
IMD_AWS_API_URL=https://api.imd.gov.in/api/v1/aws_data
IMD_API_TOKEN=...
```

## Main API endpoints

- `GET /api/realtime` — current station readings + anomaly scores
- `GET /api/history?hours=24` — stored observations
- `GET /api/config` — detector configuration
- `POST /api/config` — update detector thresholds
- `POST /api/analyze` — analyze a CSV dataset
- `GET /api/health` — backend/source/model health
