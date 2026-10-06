# Enterprise HR REST API

Layered Express 5 HR API using the native MongoDB driver, JWT access tokens, RBAC and direct-manager authorization.

## Run

```bash
cp .env.example .env
npm install
npm start
```

Required environment variables are `MONGODB_URI` and `JWT_SECRET`; optional `MONGODB_DB` defaults to `hrdb`. The API listens on `0.0.0.0:8000`. Docker deployment uses `docker compose up --build -d`; the compose Mongo image is `mongo:8.3.8`.

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
