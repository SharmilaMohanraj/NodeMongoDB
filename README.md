# Enterprise HR REST API

Layered Express 5 HR API using the native MongoDB driver, JWT access tokens, RBAC and direct-manager authorization.

## Run

```bash
cp .env.example .env
npm install
npm start
```

Required environment variables are `MONGODB_URI` and `JWT_SECRET`; optional `MONGODB_DB` defaults to `hrdb`. The API listens on `0.0.0.0:8000`. Docker deployment: copy `.env.example` to `.env`, set `JWT_SECRET`, then run `docker compose up --build -d`; the compose Mongo image is `mongo:8.0`.

- Health: `GET /health`
- API docs: `GET /docs`
- OpenAPI: `GET /openapi.json`
- Login: `POST /api/v1/auth/login`

All business API routes use `/api/v1`. Send `Authorization: Bearer <token>` for protected endpoints. List responses use `offset` and `limit` (default 20). Errors use a correlation-aware JSON envelope.

## Verification

```bash
npm test
docker compose config
```

## Shift scheduling & overtime (`/api`)

Endpoints (JWT required; roles `HR`, `MANAGER`, `EMPLOYEE`): `POST|GET /api/shift-templates`, `POST /api/shift-assignments`, `GET /api/shifts/me`, `GET /api/shifts/team?from&to`, `POST /api/attendance/check-in`, `PATCH /api/attendance/check-out`, `PATCH /api/attendance/:attendanceId/unscheduled`, `GET /api/overtime-reports/monthly?month=YYYY-MM`. List endpoints take `offset` (default 0) and `limit` (default 20, max 100) and return `{ items, total, offset, limit }`. All times are UTC. See `ai_changes.md` for rules and decisions; the contract is in `/docs`.

Verify against a real MongoDB: `MMS_PATH=<path to mongodb-memory-server> node scripts/verify-shift-scheduling.js` (or set `MONGODB_URI` to use an existing instance).
