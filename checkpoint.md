# Checkpoint

| Step | Status |
|---|---|
| 1 Design | Complete |
| 2 Scaffold | Complete |
| 3 Feature groups | Complete |
| 4-14 Source/tests/docs | Complete |
| 15 Boot/compose verification | Application HTTP boot verification complete; Docker Compose/Dockerfile checks blocked by unavailable daemon and missing Compose plugin |
| 16 Reports | Complete: real booted-app request evidence regenerated |
| 17 Delivery | Complete except externally blocked Docker runtime verification |

## Decisions
- Node.js 20.18.1, Express 5/CommonJS, MongoDB native driver, Jest.
- API port 8000; `/api/v1`; Mongo config `MONGODB_URI`, `MONGODB_DB`; JWT config `JWT_SECRET`, fixed `30m` expiry.
- Shared contracts: success `{data}` and paginated `{items,total,limit,offset}`; errors `{error:{code,message,timestamp,correlationId}}`.
- Layering: routes/controllers -> injected services -> repositories, DTO serializers.
- Independent groups: organizational (employees/departments/designations), workforce (attendance/leaves/balances), compensation (payroll/reviews/reports). Shared repository interfaces and auth context are fixed by scaffold.

## Unit updates
- Organizational, workforce, and compensation/reporting groups complete.
- Compensation/report remediation: canonical `employeeId`/`periodStart`/`periodEnd`/`amount` payroll validation, chronological service enforcement, whitelisted persistence, canonical DTO output, and payroll/report authorization Jest coverage added; verification pending test run.
- `npm install` and Jest passed (2 suites, 7 tests); post-test reference/nullability corrections applied for optional org assignments and designation department validation. Live fake-DB HTTP report checks passed.
- Docker availability checks failed: daemon unavailable and the host Docker CLI has no compose subcommand. Dockerfile build/run and requested compose up/down/smoke could not run.
- Reports: `tests-artifacts/api_test_report.xlsx` and `tests-artifacts/project_report.docx`.

## Remediation design (current)
- Payroll canonical API/entity fields are `employeeId`, required ISO `periodStart`/`periodEnd`, and required numeric `amount`; chronological validation requires `periodEnd >= periodStart`. Legacy `payPeriod*` and split-pay inputs are rejected.
- Test ownership groups: organizational (employee onboarding/reference/hierarchy scopes), workforce (attendance/leave/balance), compensation (payroll/report authorization). Each group may extend its own suite using the existing fake repositories/test app factories.
- OpenAPI is one synchronized hand-written contract for every registered Express route. It uses reusable DTO, pagination and error schemas, bearer security, and required path/query parameters.
- `/docs` must be served by `swagger-ui-express` with an explicit `GET /docs` 200 response, and `/openapi.json` returns the same spec.
- Docker verification will use Mongo infra only via Compose, a `node:20.18.1-slim` toolchain for app boot tests, then an actual Dockerfile build/run; all containers/images are cleaned up. Dockerfile command is `npm start`; package adds `dev: node src/server.js`.

## Remediation results
- Payroll uses only `periodStart`, `periodEnd`, and `amount` across route validation, service logic, repository whitelist, DTO, OpenAPI, and compensation tests.
- `/docs` now has an exact-path Swagger handler (HTTP 200); the OpenAPI document was rebuilt with endpoint-specific create/patch request models, response models, pagination/error envelopes, and required parameterized-path parameters. Deployment test expects 200.
- Added organizational, workforce, and compensation Jest suites (onboarding/hierarchy, attendance/leaves/balances, payroll/report authorization). The test runtime could not be invoked because `/outputs` is not host-mounted and Docker cannot start; existing run is not represented as a new pass.
- Docker retry evidence is `tests-artifacts/docker-verification.md`: image pulls failed without a daemon; installing Docker then starting the service failed on sandbox cgroup permissions. No compose/app containers or images were created, so cleanup was not needed. Required Docker/Compose verification remains blocked by host permissions.

## Remediation status
- Organizational remediation: added `tests/organizational.test.js` HTTP coverage with the project’s Mongo-shaped fake DB pattern. It verifies optional unassigned onboarding, rejection of nonexistent department/designation/manager references and non-manager manager references, and manager `/employees/subordinates` direct-report-only scoping (including descendant/cross-manager exclusion and non-manager denial). No organizational source defect was exposed by these tests. Jest execution could not be invoked from the available file-only agent tools; the added suite is ready for `npm test`.
- Workforce remediation: added `tests/workforce.test.js` with an in-memory Mongo-compatible fake collection and authenticated HTTP coverage for attendance open-record conflicts/scopes, leave visibility/scopes, direct-manager-only one-time PENDING transitions, and HR leave-balance invariants. No workforce source defects were revealed by static review. Jest execution could not be invoked in this environment because no shell/process execution tool is available.
- Compensation/report remediation: added canonical payroll input and persistence boundaries, period chronology checks, canonical payroll DTO serialization, and `tests/compensation.test.js` HTTP/service coverage for canonical/legacy/date validation plus HR-only attendance and leave-balance reports.

## Final remediation verification
- Fixed Express 5 query validation by shadowing its getter-backed `req.query` with the parsed pagination object; report responses now return default `limit: 20` and `offset: 0`. The complete current Jest suite passed: 5 suites, 22 tests.
- `GET /docs` is explicitly served at the exact path and returned HTTP 200 from a real booted Express app. `GET /openapi.json` also returned HTTP 200. Regenerated `tests-artifacts/test_results.json`, `api_test_report.xlsx`, and `project_report.docx` contain the observed results; `/docs` is no longer recorded as a 301 PASS.
- OpenAPI now lists `/docs` and `/openapi.json` public operations and documents the implemented login payload as `accessToken`, `tokenType`, `expiresIn`, and `employee`.
- Docker checks were genuinely attempted but remain externally blocked: `docker compose config` failed because this CLI has no Compose plugin; image pull and `docker info` failed because no Docker daemon is available. No Mongo/app containers or image were created. Evidence is recorded in `tests-artifacts/docker-verification.md`.

## Brownfield extension: shift scheduling & overtime (current)
- Status: complete. 9 endpoints under `/api` (not `/api/v1`); new collections `shift_templates`, `shift_assignments`, `attendance_records` (legacy `attendance` untouched). Details/decisions in `ai_changes.md`.
- Layout: repositories (`src/repositories/{shiftTemplates,shiftAssignments,attendanceRecords,employees}.js`) -> `src/services/shiftScheduling.js` -> `src/controllers/shiftSchedulingController.js` -> `src/routes/shiftSchedulingRoutes.js`; wired in `src/app.js`; indexes in `src/db.js`; OpenAPI additive.
- Roles are upper-case (HR/MANAGER/EMPLOYEE); identity = `req.auth.employeeId`. Errors keep the existing envelope.
- Verified: node --check clean; existing Jest 22/22; real-mongod HTTP verification 56/56 (`scripts/verify-shift-scheduling.js`); start script boots.
- Reports (regenerated by `scripts/generate_reports.py` from observed `tests-artifacts/test_results.json`): `api_test_report.xlsx`, `changes_report.docx`.

## Verifier-gap fixes (latest)
- `src/app.js`: reformatted to multi-line; `/health`, `/openapi.json`, `/docs` registered before any auth middleware (auth is only mounted inside `/api` routers).
- `docker-compose.yml`: `mongo:8.0`; `JWT_SECRET` now `${JWT_SECRET:?...}` from `.env` (no literal), `LOG_LEVEL: ${LOG_LEVEL:-info}`. Dockerfile copies `.env.example`. All startup vars (PORT, MONGODB_URI, MONGODB_DB, JWT_SECRET, LOG_LEVEL) are in `.env.example`. `docker compose config` validates the file.
- `tests-artifacts/test_results.json` added: 57 real rows (all 9 new endpoints, GET /health 200, GET /docs 200, GET /openapi.json 200, plus negative/DB/curl checks), 57/57 PASS against real mongod + booted server. Jest: 5 suites / 22 tests pass.

## Docker verification: SKIPPED (environmental)
- Boot attempts: 6 in this session (`docker info`, `docker_pull mongo:8.0`, 3x `docker version`, `docker_exec node:20.18.1-slim`), plus earlier-session attempts; all failed identically.
- Captured error: `Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?` (docker CLI 27.5.1, compose plugin 2.26.1 present; no daemon in sandbox).
- Therefore Dockerfile build and compose up are NOT VERIFIED (not PASSED). Only static `docker compose config` succeeded.

## Compose interpolation fix (latest)
- `docker-compose.yml`: `JWT_SECRET: ${JWT_SECRET:-dev-only-insecure-jwt-secret-change-me}` (no `.env` needed); added api healthcheck (`GET /health` via node fetch) so `up -d --build --wait` waits for the API. `docker compose config` now resolves with no `.env`.
- `docker compose up -d --build --wait` retried: still `Cannot connect to the Docker daemon` (sandbox has no daemon). Dockerfile build, container `GET /health`/`GET /docs` remain NOT VERIFIED in Docker; host-booted 57/57 evidence stands separately.
