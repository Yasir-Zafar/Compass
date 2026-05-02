# Compass (React + Express + Python ML)

Compass is a guided ASD assessment web app:
- React frontend (multi-step assessment workflow)
- Node/Express API gateway
- Python FastAPI inference service (existing trained models)

## 1) Run Python model API

From `backend/`:

```bash
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

## 2) Run Express server

From `server/`:

```bash
npm install
copy .env.example .env
npm run dev
```

## 3) Run React frontend

From `frontend/`:

```bash
npm install
npm run dev
```

Vite proxies `/api/*` requests to the Express server on port `5000`.
