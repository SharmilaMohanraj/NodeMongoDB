# AI Changes

## Summary
Added HR shift templates and assignments, 14-day employee schedules, manager team schedules, attendance check-in/out with overtime calculations, direct-team unscheduled marking, and monthly HR overtime reports.

## Architecture
- Added the layered scheduling route → controller → service → native MongoDB repository implementation.
- Reused existing JWT `req.auth`, role middleware, Zod validation, DTO serialization, Pino error logging, and global error envelope.
- Added read-only employee collection access; existing employee/authentication data and legacy routes were not changed.

## API
The nine new authenticated routes are mounted at `/api`: shift template and assignment creation/listing, employee/team schedules, attendance check-in/out and manager unscheduled marking, and monthly overtime reports. Existing `/api/v1` endpoints remain available.

## Persistence
Added `shift_templates`, `shift_assignments`, and `attendance_records` collections with unique/indexed constraints for template names, assignment ranges, date lookups, and one open attendance record per employee.

## Documentation and deployment
Updated the existing OpenAPI document used by `/openapi.json` and `/docs`. Existing Dockerfile and Compose configuration already cover the Node 20.18.1 application and MongoDB and were retained. Added `start_job-d74c6580-0cd8-4e7a-aa88-c787c3bbf48c.sh` for deployment booting.

## Verification
- `npm test` passed: 5 suites and 22 tests; all seven required `node --check` commands passed.
- MongoDB was started as the compose infrastructure dependency, and the native boot path used the configurable `MONGODB_URI=mongodb://127.0.0.1:27017` value.
- The app booted successfully and live HTTP verification observed 200 responses from `/health`, `/docs`, `/openapi.json`, both JWT logins, and the authenticated `GET /api/shifts/me?offset=0&limit=20` schedule probe. The same run created a Mongo-backed shift template and assignment (both 201).
- Docker image sources were pulled. The Dockerfile built successfully (using host networking for the isolated daemon build), the verification container remained running, and its `/health` endpoint returned 200 before container/image cleanup.
- Mongo compose infrastructure was torn down after verification. Detailed observed results are in `tests-artifacts/test_results.json` and `tests-artifacts/api_test_report.xlsx`.

## Verifier remediation
- Assignment conflicts are now enforced atomically by reserving every inclusive employee/calendar-date in `shift_assignment_dates` under a unique `{ employeeId, date }` index, inside the same MongoDB transaction as the assignment insert. Duplicate-key failures translate to the existing 409 conflict envelope.
- Compose Mongo is now an idempotently initialized single-node `rs0` replica set so transaction-based assignment creation is deployable; the API and native example URLs use the matching replica-set connection settings.
- `POST /api/attendance/check-in` is correctly documented as a server-timed, body-less authenticated operation. The invalid `AttendanceTimeInput` reference was removed, and focused OpenAPI resolution coverage was added.
- Remediation static syntax checks passed. The attempted dependency install/test and fresh Docker build could not complete because this environment could not resolve `registry.npmjs.org` / its Docker bridge network; the honest observed failures are retained in the final test artifacts.
