# Checkpoint

| Step | Status |
|---|---|
| 1 Design | Complete |
| 2 Scaffold | In progress |
| 3 Feature groups | Pending |
| 4-17 Verification/reports | Pending |

## Decisions
- Node.js 20.18.1, Express 5/CommonJS, MongoDB native driver, Jest.
- API port 8000; `/api/v1`; Mongo config `MONGODB_URI`, `MONGODB_DB`; JWT config `JWT_SECRET`, fixed `30m` expiry.
- Shared contracts: success `{data}` and paginated `{items,total,limit,offset}`; errors `{error:{code,message,timestamp,correlationId}}`.
- Layering: routes/controllers -> injected services -> repositories, DTO serializers.
- Independent groups: organizational (employees/departments/designations), workforce (attendance/leaves/balances), compensation (payroll/reviews/reports). Shared repository interfaces and auth context are fixed by scaffold.
