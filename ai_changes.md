# AI changes: shift scheduling & overtime tracking

## Summary
Added nine REST endpoints (mounted at `/api`, next to the existing `/api/v1`) for shift templates, shift assignments, employee/team schedules, check-in/check-out with overtime calculation, manager "unscheduled" flagging and an HR monthly overtime report. Existing routes, middleware, tests and the legacy `attendance` collection are untouched.

## Files added
| Layer | File |
|---|---|
| Repositories | `src/repositories/shiftTemplates.js`, `shiftAssignments.js`, `attendanceRecords.js`, `employees.js` |
| Service | `src/services/shiftScheduling.js` (`ShiftSchedulingService`, constructor-injected collaborators) |
| Controller | `src/controllers/shiftSchedulingController.js` (zod validation, role checks, DTO mapping) |
| Routes | `src/routes/shiftSchedulingRoutes.js` (composition root + 9 routes) |
| Support | `src/dtos/shiftSchedulingDto.js`, `src/utils/scheduleTime.js`, `src/requestContext.js` (correlation id in every log line) |
| Verification | `scripts/verify-shift-scheduling.js`, `start_657809bd-b358-4f9d-8acf-8726b3565fd0.sh` |

## Files modified
- `src/app.js`: imports and mounts `createShiftSchedulingRouter` at `/api` after `/api/v1`, before `notFound`/`errorHandler`.
- `src/db.js`: creates the new indexes on start-up (unique template name; employee+date-range; partial-unique open attendance per employee; employee/date; monthly report).
- `src/openapi.js`: documents the 9 endpoints (additive; keys carry the `/api` prefix so legacy `/attendance/*` docs are not overwritten).

## Endpoints
| Method | Path | Role |
|---|---|---|
| POST/GET | `/api/shift-templates` | HR |
| POST | `/api/shift-assignments` | HR |
| GET | `/api/shifts/me` | EMPLOYEE |
| GET | `/api/shifts/team?from&to` | MANAGER |
| POST | `/api/attendance/check-in` | EMPLOYEE |
| PATCH | `/api/attendance/check-out` | EMPLOYEE |
| PATCH | `/api/attendance/:attendanceId/unscheduled` | MANAGER (team only, else 403) |
| GET | `/api/overtime-reports/monthly?month=YYYY-MM` | HR |

## Decisions and interpretations
- **Roles** are the stored upper-case values (`HR`, `MANAGER`, `EMPLOYEE`); identity comes from the existing middleware's `req.auth.employeeId` / `req.auth.role` (the spec's `req.user`).
- **Responses**: success bodies are bare resources / `{ items, total, offset, limit }` exactly as specified; errors use the project's existing envelope `{ error: { code, message, timestamp, correlationId } }`.
- **Time**: "today", weekdays (0 = Sunday) and shift times are all evaluated in UTC.
- **Overtime**: early/late minutes are counted only when strictly more than 15 minutes outside the shift, then the full floored minute count is used. Check-in stores `overtimeMinutes = earlyOvertimeMinutes`; check-out adds late minutes. Unscheduled records never accrue late overtime.
- **One open record per employee** is enforced by a partial unique index and a service pre-check (any open record, including one from a previous day, blocks a new check-in with 409; check-out closes it).
- **Assignments** may not share any calendar date for the same employee, regardless of template (boundary days included). The check-then-insert is not transactional, so two simultaneous HR requests could in theory both succeed.
- Shifts are keyed to their start date; an overnight shift that began yesterday is not matched to today's check-in.
- Team schedule range is capped at 366 days (400 above) to bound work per request; `limit` max is 100 (existing `paginationSchema`).
- Monthly report counts records by `attendanceDate` (UTC) and lists only employees with at least one record that month; hours are rounded to 2 decimals.
- Testing framework "none": no Jest suites were added; the existing 22 Jest tests still pass.

## Verification (real observed results)
- `node --check` on all new/changed files: clean. Existing `npm test`: 5 suites / 22 tests pass.
- `scripts/verify-shift-scheduling.js` boots the real server against a real `mongod` (mongodb-memory-server 7.0.14) and issues HTTP calls: 56/56 checks pass (auth/roles, validation, 409 conflicts incl. inclusive boundary, overnight expansion, early/late overtime, team scoping, monthly aggregation, partial unique index, and the literal `curl -i .../api/shifts/me?offset=0&limit=20`).
- Start script boot-tested (health 200 on attempt 1).
- **Docker**: `Dockerfile` and `docker-compose.yml` exist and are unchanged (build copies `src/`, which contains all new code; production-only `npm install --omit=dev` + `require('./src/app')` verified outside Docker). `docker build`/`docker run` could NOT be executed: Docker daemon unavailable in this sandbox ("Dockerfile verification skipped: docker unavailable").
