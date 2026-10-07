# Enterprise HR REST API

Layered Express 5 HR API using the native MongoDB driver, JWT access tokens, RBAC and direct-manager authorization.

## Run

```bash
cp .env.example .env
npm install
npm start
```

Required environment variables are `MONGODB_URI` and `JWT_SECRET`; optional `MONGODB_DB` defaults to `hrdb`. The API listens on `0.0.0.0:8000`.

Mongo is configured as a single-node `rs0` replica set so transaction-based scheduling works in local deployment. Start and wait for the infrastructure with `docker compose up -d mongo`; its healthcheck initializes the replica set idempotently and only reports healthy after the node is writable primary. For a native API process, use the `.env.example` URL: `mongodb://127.0.0.1:27017/hrdb?replicaSet=rs0&directConnection=true`. `directConnection=true` is needed from the host because the replica member advertises the Compose-only hostname `mongo`. Docker deployment uses `docker compose up --build -d`; the API container uses `mongodb://mongo:27017/hrdb?replicaSet=rs0`. The compose Mongo image is `mongo:8.3.8`.

- Health: `GET /health`
- API docs: `GET /docs`
- OpenAPI: `GET /openapi.json`
- Login: `POST /api/v1/auth/login`

Most business API routes use `/api/v1`; the scheduling extension is mounted at `/api` (for example, `GET /api/shifts/me`). Send `Authorization: Bearer <token>` for protected endpoints. List responses use `offset` and `limit` (default 20). Errors use a correlation-aware JSON envelope.

## Verification

```bash
npm test
docker compose config
```
