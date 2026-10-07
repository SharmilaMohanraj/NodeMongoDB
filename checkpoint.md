# Checkpoint

| Step | Status |
|---|---|
| 1 Design | Complete — brownfield scheduling extension planned |
| 2 Feature groups | Complete — repositories, scheduling service, authenticated HTTP routes, app mount, and OpenAPI updated |
| 3 Verification/reports/deployment | Complete — Mongo-backed live verification, Docker build/run verification, reports, and infra cleanup passed |
| 4 Verifier remediation | Code complete — atomic reservations, replica-set deployment, body-less check-in OpenAPI, focused tests, reports updated; live Jest/boot/Docker re-verification blocked by environment dependency/Docker networking failures (recorded honestly) |

## Verifier remediation design
- Assignment conflict enforcement will materialize each covered employee/calendar-date reservation in a dedicated `shift_assignment_dates` collection with unique `{ employeeId, date }`; reservation and assignment insertion will run in one MongoDB transaction. Duplicate-key conflicts become the existing `ConflictError` response; transaction cleanup prevents orphan reservations.
- `POST /api/attendance/check-in` has no request body and derives its timestamp server-side. Its OpenAPI operation will omit `requestBody`, retain documented responses/security, and no longer reference the nonexistent `AttendanceTimeInput` schema.

## Current feature decisions
- Preserve CommonJS, Express 5, native MongoDB driver, existing `req.auth` JWT convention (claims `employeeId`, `role`), `authorize`, Zod `validate`, Pino/error middleware, and existing `/api/v1` routes.
- New scheduling router is mounted at `/api` exactly as requested; each route authenticates through the existing `authenticate(config)` middleware. It retains its own HR/manager role gates; `req.auth` is the actual repository equivalent of the requested `req.user`.
- Independent group contracts: repositories use Mongo collections `shift_templates`, `shift_assignments`, `attendance_records` and the existing `employees` collection. IDs are ObjectId-backed and serialized to strings. Services receive injectable repositories for tests/composition.
- Shift contract: strict UTC-like calendar strings (`YYYY-MM-DD`), start/end `HH:mm`, inclusive ranges, assignment overlap conflict includes boundaries, overnight end rolls one calendar day, and pagination is `{items,total,limit,offset}` with default 20.
- Attendance contract: a unique partial index protects one open record per employee; attendance date is check-in date; early/late overtime threshold is strictly more than 15 minutes and uses full minutes beyond scheduled start/end.
- Existing OpenAPI `/openapi.json` + `/docs` is extended, not replaced. Docker/Compose are extended only after source work.
- Native boot uses configurable `MONGODB_URI`; `.env.example` defaults to `mongodb://127.0.0.1:27017`, while compose overrides the API container to `mongodb://mongo:27017`.

## Verification evidence
- `npm test` passed 5 suites / 22 tests; all seven requested `node --check` checks passed.
- Compose Mongo infrastructure booted healthy. The app booted against it and observed HTTP 200 for `/health`, unauthenticated `/docs`, `/openapi.json`, authenticated schedule retrieval, and both JWT logins. The live run created a shift template and assignment (201 each) before retrieving the employee's nonempty schedule (200).
- Required Docker sources were pulled. Dockerfile build/run verification passed: the container stayed running and `/health` returned 200; test container/image cleanup completed.
- Compose infrastructure was torn down. Reports: `tests-artifacts/api_test_report.xlsx`, `tests-artifacts/changes_report.docx`, and observed data in `tests-artifacts/test_results.json`; change log: `ai_changes.md`.
- Remediation static checks passed for both production changes and focused tests; compose configuration parsed and its rs0 Mongo became healthy/writable primary before teardown. Fresh Jest could not execute after `npm ci` hit `registry.npmjs.org` DNS `EAI_AGAIN`, and a start-script boot attempt then captured missing `pino` because dependencies were unavailable. Fresh Docker build similarly failed at `npm install` with Docker `network bridge not found`. These actual failures are recorded as FAIL rows alongside retained historical PASS evidence in regenerated reports.

## Existing baseline retained
- Previous project work and reports remain in place. Current requested work is a new brownfield feature extension; it does not replace prior routes, tests, Docker configuration, or documentation.
