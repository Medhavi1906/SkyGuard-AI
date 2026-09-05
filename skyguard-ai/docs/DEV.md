# Development

## Install

```bash
npm install
```

## Start backend

```bash
npm run dev:backend
```

The API listens on port 3001 by default.

## Start frontend

```bash
npm run dev
```

Vite listens on port 3000 and proxies `/api` to the backend.

## Production

```bash
npm run build
npm start
```

The production Express process serves the compiled frontend from `dist/public` and the API from the same process.
