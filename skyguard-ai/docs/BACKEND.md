# SkyGuard backend

The backend is an Express + TypeScript service. It currently uses Open-Meteo when IMD AWS/ARG credentials are absent and automatically switches to IMD when both `IMD_AWS_API_URL` and `IMD_API_TOKEN` are configured.

## Data source

The default network contains 100 Indian station locations. Open-Meteo requests are batched in groups of 20 to avoid oversized URLs. Each batch requests current values plus seven days of hourly temperature, relative humidity and surface pressure for station-specific model context.

## Detection

The detector combines:

1. physical/range validation through normalized numeric inputs,
2. station-specific robust median/MAD deviations,
3. a dependency-free Isolation Forest over six temporal/multivariate features,
4. nearby-station spatial agreement for regional-weather versus localized-fault classification.

The result is exposed by `GET /api/realtime`.

## API

- `GET /api/health`
- `GET /api/config`
- `POST /api/config`
- `GET /api/history?hours=24&station_id=AWS-001`
- `GET /api/realtime`
- `POST /api/analyze` with `{ "csv": "..." }`

## IMD later

Set the credentials in `.env` when IMD access is approved. Keep the token server-side; never expose it through Vite client variables or commit it to source control.
