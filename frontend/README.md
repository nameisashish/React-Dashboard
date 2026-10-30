# Fines & Fees frontend

See the [root README](../README.md) for local setup, account bootstrap, FastAPI endpoints, Excel contracts, roles and SQL Server configuration.

```bash
npm ci
npm run dev
npm run build
```

Node 22.12+ is required. The Vite dev server proxies `/api` to FastAPI at `127.0.0.1:8000`. Configure `VITE_API_URL` for separately deployed environments. No data is generated in the browser.
