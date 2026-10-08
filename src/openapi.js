const id = { type: 'string', pattern: '^[a-fA-F0-9]{24}$', example: '507f1f77bcf86cd799439011' };
const date = { type: 'string', format: 'date', example: '2026-01-31' };
const bearer = [{ bearerAuth: [] }];
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema) => ({ 'application/json': { schema } });
const response = (description, schema) => ({ description, ...(schema ? { content: json(schema) } : {}) });
const errorResponses = {
  400: response('Validation error', ref('Error')),
  401: response('Authentication required', ref('Error')),
  403: response('Authorization denied', ref('Error')),
  404: response('Resource not found', ref('Error')),
  500: response('Unexpected server error', ref('Error')),
};
const secured = (operation) => ({ security: bearer, ...operation });
const idParameter = { name: 'id', in: 'path', required: true, schema: id };
const pagination = [
  { name: 'offset', in: 'query', required: false, schema: { type: 'integer', minimum: 0, default: 0 } },
  { name: 'limit', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
];
const body = (schema) => ({ required: true, content: json(schema) });
const dataResponse = (description, schema, status = 200) => ({ [status]: response(description, { type: 'object', required: ['data'], properties: { data: schema } }) });
const pageResponse = (item) => response('Paginated results', { type: 'object', required: ['items', 'total', 'limit', 'offset'], properties: { items: { type: 'array', items: item }, total: { type: 'integer', minimum: 0 }, limit: { type: 'integer', minimum: 1 }, offset: { type: 'integer', minimum: 0 } } });

const spec = {
  openapi: '3.0.3',
  info: { title: 'Enterprise HR API', version: '1.0.0', description: 'JWT-protected human-resources operations API.' },
  servers: [{ url: '/api/v1', description: 'API base path' }],
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    schemas: {
      Error: { type: 'object', required: ['error'], properties: { error: { type: 'object', required: ['code', 'message', 'timestamp', 'correlationId'], properties: { code: { type: 'string' }, message: { type: 'string' }, timestamp: { type: 'string', format: 'date-time' }, correlationId: { type: 'string', format: 'uuid' } } } } },
      Login: { type: 'object', additionalProperties: false, required: ['email', 'password'], properties: { email: { type: 'string', format: 'email' }, password: { type: 'string', minLength: 1, maxLength: 200 } } },
      LoginResponse: { type: 'object', required: ['accessToken', 'tokenType', 'expiresIn', 'employee'], properties: { accessToken: { type: 'string', description: 'Signed JWT access token' }, tokenType: { type: 'string', example: 'Bearer' }, expiresIn: { type: 'string', example: '30m' }, employee: ref('Employee') } },
      DepartmentInput: { type: 'object', additionalProperties: false, required: ['name'], properties: { name: { type: 'string', minLength: 1, maxLength: 160 }, description: { type: 'string', maxLength: 2000 } } },
      Department: { allOf: [ref('DepartmentInput'), { type: 'object', required: ['id'], properties: { id } }] },
      DepartmentPatch: { type: 'object', additionalProperties: false, minProperties: 1, properties: { name: { type: 'string', minLength: 1, maxLength: 160 }, description: { type: 'string', maxLength: 2000 } } },
      DesignationInput: { type: 'object', additionalProperties: false, required: ['title', 'departmentId'], properties: { title: { type: 'string', minLength: 1, maxLength: 160 }, departmentId: id, description: { type: 'string', maxLength: 2000 } } },
      Designation: { allOf: [ref('DesignationInput'), { type: 'object', required: ['id'], properties: { id } }] },
      DesignationPatch: { type: 'object', additionalProperties: false, minProperties: 1, properties: { title: { type: 'string', minLength: 1, maxLength: 160 }, departmentId: id, description: { type: 'string', maxLength: 2000 } } },
      EmployeeInput: { type: 'object', additionalProperties: false, required: ['email', 'password', 'firstName', 'lastName', 'role'], properties: { email: { type: 'string', format: 'email' }, password: { type: 'string', minLength: 8, maxLength: 200 }, firstName: { type: 'string', minLength: 1, maxLength: 100 }, lastName: { type: 'string', minLength: 1, maxLength: 100 }, role: { type: 'string', enum: ['HR', 'MANAGER', 'EMPLOYEE'] }, departmentId: id, designationId: id, managerId: id } },
      Employee: { allOf: [ref('EmployeeInput'), { type: 'object', required: ['id'], properties: { id } }] },
      EmployeePatch: { type: 'object', additionalProperties: false, minProperties: 1, properties: { email: { type: 'string', format: 'email' }, password: { type: 'string', minLength: 8, maxLength: 200 }, firstName: { type: 'string', minLength: 1, maxLength: 100 }, lastName: { type: 'string', minLength: 1, maxLength: 100 }, role: { type: 'string', enum: ['HR', 'MANAGER', 'EMPLOYEE'] }, departmentId: id, designationId: id, managerId: id } },
      Attendance: { type: 'object', required: ['id', 'employeeId', 'checkInAt'], properties: { id, employeeId: id, checkInAt: { type: 'string', format: 'date-time' }, checkOutAt: { type: 'string', format: 'date-time', nullable: true } } },
      LeaveRequestInput: { type: 'object', additionalProperties: false, required: ['startDate', 'endDate', 'reason'], properties: { startDate: date, endDate: date, reason: { type: 'string', minLength: 1, maxLength: 1000 } } },
      LeaveReview: { type: 'object', additionalProperties: false, required: ['status'], properties: { status: { type: 'string', enum: ['APPROVED', 'REJECTED'] } } },
      LeaveRequest: { allOf: [ref('LeaveRequestInput'), { type: 'object', required: ['id', 'employeeId', 'status'], properties: { id, employeeId: id, status: { type: 'string', enum: ['PENDING', 'APPROVED', 'REJECTED'] } } }] },
      LeaveBalanceInput: { type: 'object', additionalProperties: false, required: ['year', 'allocatedDays', 'usedDays'], properties: { year: { type: 'integer', minimum: 1970, maximum: 9999 }, allocatedDays: { type: 'number', minimum: 0, maximum: 366 }, usedDays: { type: 'number', minimum: 0, maximum: 366 } } },
      LeaveBalance: { allOf: [ref('LeaveBalanceInput'), { type: 'object', required: ['id', 'employeeId'], properties: { id, employeeId: id } }] },
      PayrollInput: { type: 'object', additionalProperties: false, required: ['employeeId', 'periodStart', 'periodEnd', 'amount'], properties: { employeeId: id, periodStart: date, periodEnd: date, amount: { type: 'number', minimum: 0 }, status: { type: 'string', minLength: 1, maxLength: 40 }, paidAt: { type: 'string', format: 'date-time' } } },
      Payroll: { allOf: [ref('PayrollInput'), { type: 'object', required: ['id'], properties: { id } }] },
      PayrollPatch: { type: 'object', additionalProperties: false, minProperties: 1, properties: { employeeId: id, periodStart: date, periodEnd: date, amount: { type: 'number', minimum: 0 }, status: { type: 'string', minLength: 1, maxLength: 40 }, paidAt: { type: 'string', format: 'date-time' } } },
      ReviewCycleInput: { type: 'object', additionalProperties: false, required: ['name', 'startDate', 'endDate'], properties: { name: { type: 'string', minLength: 1, maxLength: 160 }, description: { type: 'string', maxLength: 2000 }, startDate: { type: 'string', format: 'date-time' }, endDate: { type: 'string', format: 'date-time' }, status: { type: 'string', minLength: 1, maxLength: 40 } } },
      ReviewCycle: { allOf: [ref('ReviewCycleInput'), { type: 'object', required: ['id'], properties: { id } }] },
      ReviewCyclePatch: { type: 'object', additionalProperties: false, minProperties: 1, properties: { name: { type: 'string', minLength: 1, maxLength: 160 }, description: { type: 'string', maxLength: 2000 }, startDate: { type: 'string', format: 'date-time' }, endDate: { type: 'string', format: 'date-time' }, status: { type: 'string', minLength: 1, maxLength: 40 } } },
    },
  },
  paths: {
    '/health': { servers: [{ url: '/' }], get: { summary: 'Health check', responses: { 200: response('Healthy', { type: 'object', required: ['status'], properties: { status: { type: 'string', example: 'ok' } } }) } } },
    '/docs': { servers: [{ url: '/' }], get: { summary: 'Swagger UI documentation', responses: { 200: response('Swagger UI HTML') } } },
    '/openapi.json': { servers: [{ url: '/' }], get: { summary: 'OpenAPI specification', responses: { 200: response('OpenAPI 3.0 document', { type: 'object' }) } } },
    '/auth/login': { post: { summary: 'Log in', requestBody: body(ref('Login')), responses: { ...dataResponse('Access token issued', ref('LoginResponse')), ...errorResponses } } },
    '/employees': { get: secured({ summary: 'List employees (HR)', parameters: pagination, responses: { 200: pageResponse(ref('Employee')), ...errorResponses } }), post: secured({ summary: 'Onboard employee (HR)', requestBody: body(ref('EmployeeInput')), responses: { ...dataResponse('Employee created', ref('Employee'), 201), ...errorResponses } }) },
    '/employees/subordinates': { get: secured({ summary: 'List direct subordinates (manager)', parameters: pagination, responses: { 200: pageResponse(ref('Employee')), ...errorResponses } }) },
    '/employees/{id}': { get: secured({ summary: 'Get employee', parameters: [idParameter], responses: { ...dataResponse('Employee', ref('Employee')), ...errorResponses } }), patch: secured({ summary: 'Update employee (HR)', parameters: [idParameter], requestBody: body(ref('EmployeePatch')), responses: { ...dataResponse('Employee updated', ref('Employee')), ...errorResponses } }) },
    '/departments': { get: secured({ summary: 'List departments', parameters: pagination, responses: { 200: pageResponse(ref('Department')), ...errorResponses } }), post: secured({ summary: 'Create department (HR)', requestBody: body(ref('DepartmentInput')), responses: { ...dataResponse('Department created', ref('Department'), 201), ...errorResponses } }) },
    '/departments/{id}': { patch: secured({ summary: 'Update department (HR)', parameters: [idParameter], requestBody: body(ref('DepartmentPatch')), responses: { ...dataResponse('Department updated', ref('Department')), ...errorResponses } }), delete: secured({ summary: 'Delete department (HR)', parameters: [idParameter], responses: { 204: { description: 'Department deleted' }, ...errorResponses } }) },
    '/designations': { get: secured({ summary: 'List designations', parameters: pagination, responses: { 200: pageResponse(ref('Designation')), ...errorResponses } }), post: secured({ summary: 'Create designation (HR)', requestBody: body(ref('DesignationInput')), responses: { ...dataResponse('Designation created', ref('Designation'), 201), ...errorResponses } }) },
    '/designations/{id}': { patch: secured({ summary: 'Update designation (HR)', parameters: [idParameter], requestBody: body(ref('DesignationPatch')), responses: { ...dataResponse('Designation updated', ref('Designation')), ...errorResponses } }), delete: secured({ summary: 'Delete designation (HR)', parameters: [idParameter], responses: { 204: { description: 'Designation deleted' }, ...errorResponses } }) },
    '/attendance/check-in': { post: secured({ summary: 'Check in', requestBody: body({ type: 'object', additionalProperties: false }), responses: { ...dataResponse('Attendance opened', ref('Attendance'), 201), ...errorResponses } }) },
    '/attendance/check-out': { post: secured({ summary: 'Check out', requestBody: body({ type: 'object', additionalProperties: false }), responses: { ...dataResponse('Attendance closed', ref('Attendance')), ...errorResponses } }) },
    '/attendance': { get: secured({ summary: 'List attendance within caller scope', parameters: pagination, responses: { 200: pageResponse(ref('Attendance')), ...errorResponses } }) },
    '/leave-requests': { get: secured({ summary: 'List leave requests within caller scope', parameters: pagination, responses: { 200: pageResponse(ref('LeaveRequest')), ...errorResponses } }), post: secured({ summary: 'Create leave request', requestBody: body(ref('LeaveRequestInput')), responses: { ...dataResponse('Leave request created', ref('LeaveRequest'), 201), ...errorResponses } }) },
    '/leave-requests/{id}': { patch: secured({ summary: 'Review pending direct-report leave request', parameters: [idParameter], requestBody: body(ref('LeaveReview')), responses: { ...dataResponse('Leave request reviewed', ref('LeaveRequest')), ...errorResponses } }) },
    '/leave-balances/{employeeId}/{year}': { put: secured({ summary: 'Upsert leave balance (HR)', parameters: [{ name: 'employeeId', in: 'path', required: true, schema: id }, { name: 'year', in: 'path', required: true, schema: { type: 'integer', minimum: 1970, maximum: 9999 } }], requestBody: body(ref('LeaveBalanceInput')), responses: { ...dataResponse('Leave balance saved', ref('LeaveBalance')), ...errorResponses } }) },
    '/payroll-records': { get: secured({ summary: 'List payroll records (HR)', parameters: pagination, responses: { 200: pageResponse(ref('Payroll')), ...errorResponses } }), post: secured({ summary: 'Create payroll record (HR)', requestBody: body(ref('PayrollInput')), responses: { ...dataResponse('Payroll record created', ref('Payroll'), 201), ...errorResponses } }) },
    '/payroll-records/{id}': { get: secured({ summary: 'Get payroll record (HR)', parameters: [idParameter], responses: { ...dataResponse('Payroll record', ref('Payroll')), ...errorResponses } }), patch: secured({ summary: 'Update payroll record (HR)', parameters: [idParameter], requestBody: body(ref('PayrollPatch')), responses: { ...dataResponse('Payroll record updated', ref('Payroll')), ...errorResponses } }), delete: secured({ summary: 'Delete payroll record (HR)', parameters: [idParameter], responses: { ...dataResponse('Payroll record deleted', { type: 'object', required: ['id'], properties: { id } }), ...errorResponses } }) },
    '/review-cycles': { get: secured({ summary: 'List review cycles', parameters: pagination, responses: { 200: pageResponse(ref('ReviewCycle')), ...errorResponses } }), post: secured({ summary: 'Create review cycle (HR)', requestBody: body(ref('ReviewCycleInput')), responses: { ...dataResponse('Review cycle created', ref('ReviewCycle'), 201), ...errorResponses } }) },
    '/review-cycles/{id}': { get: secured({ summary: 'Get review cycle', parameters: [idParameter], responses: { ...dataResponse('Review cycle', ref('ReviewCycle')), ...errorResponses } }), patch: secured({ summary: 'Update review cycle (HR)', parameters: [idParameter], requestBody: body(ref('ReviewCyclePatch')), responses: { ...dataResponse('Review cycle updated', ref('ReviewCycle')), ...errorResponses } }), delete: secured({ summary: 'Delete review cycle (HR)', parameters: [idParameter], responses: { ...dataResponse('Review cycle deleted', { type: 'object', required: ['id'], properties: { id } }), ...errorResponses } }) },
    '/reports/attendance': { get: secured({ summary: 'Attendance report (HR)', parameters: pagination, responses: { 200: pageResponse(ref('Attendance')), ...errorResponses } }) },
    '/reports/leave-balances': { get: secured({ summary: 'Leave balance report (HR)', parameters: pagination, responses: { 200: pageResponse(ref('LeaveBalance')), ...errorResponses } }) },
  },
};

// --- Shift scheduling & overtime (mounted at /api, not /api/v1; success bodies are bare resources) ---
// Keys carry the full /api prefix (and a root server) so they cannot collide with the legacy /api/v1 attendance paths.
const shiftServers = [{ url: '/', description: 'Server root' }];
const timeStr = { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$', example: '09:00' };
const dateTime = { type: 'string', format: 'date-time' };
const shiftSchemas = {
  ShiftTemplateInput: { type: 'object', additionalProperties: false, required: ['name', 'startTime', 'endTime', 'applicableDays'], properties: { name: { type: 'string', minLength: 1, maxLength: 100 }, startTime: timeStr, endTime: { ...timeStr, example: '17:00', description: 'endTime <= startTime denotes an overnight shift ending the next calendar day' }, applicableDays: { type: 'array', minItems: 1, items: { type: 'integer', minimum: 0, maximum: 6 }, description: '0 = Sunday ... 6 = Saturday' } } },
  ShiftTemplate: { type: 'object', required: ['id', 'name', 'startTime', 'endTime', 'applicableDays', 'createdAt'], properties: { id, name: { type: 'string' }, startTime: timeStr, endTime: timeStr, applicableDays: { type: 'array', items: { type: 'integer', minimum: 0, maximum: 6 } }, createdAt: dateTime } },
  ShiftAssignmentInput: { type: 'object', additionalProperties: false, required: ['employeeId', 'shiftTemplateId', 'startDate', 'endDate'], properties: { employeeId: id, shiftTemplateId: id, startDate: date, endDate: date } },
  ShiftAssignment: { type: 'object', required: ['id', 'employeeId', 'shiftTemplateId', 'startDate', 'endDate', 'assignedBy', 'createdAt'], properties: { id, employeeId: id, shiftTemplateId: id, startDate: date, endDate: date, assignedBy: id, createdAt: dateTime } },
  ShiftRow: { type: 'object', required: ['employeeId', 'assignmentId', 'templateId', 'date', 'scheduledStartAt', 'scheduledEndAt'], properties: { employeeId: id, assignmentId: id, templateId: id, date, scheduledStartAt: dateTime, scheduledEndAt: dateTime } },
  AttendanceRecord: { type: 'object', required: ['id', 'employeeId', 'attendanceDate', 'shiftAssignmentId', 'checkInAt', 'checkOutAt', 'unscheduled', 'overtimeFlagged', 'earlyOvertimeMinutes', 'lateOvertimeMinutes', 'overtimeMinutes'], properties: { id, employeeId: id, attendanceDate: date, shiftAssignmentId: { ...id, nullable: true }, checkInAt: dateTime, checkOutAt: { ...dateTime, nullable: true }, unscheduled: { type: 'boolean' }, overtimeFlagged: { type: 'boolean' }, earlyOvertimeMinutes: { type: 'integer' }, lateOvertimeMinutes: { type: 'integer' }, overtimeMinutes: { type: 'integer' } } },
  MonthlyOvertimeRow: { type: 'object', required: ['employeeId', 'overtimeMinutes', 'overtimeHours'], properties: { employeeId: id, overtimeMinutes: { type: 'integer' }, overtimeHours: { type: 'number', description: 'overtimeMinutes / 60 rounded to 2 decimals' } } },
};
const bare = (description, schema, status = 200) => ({ [status]: response(description, schema) });
const conflict = { 409: response('Conflict', ref('Error')) };
const dateQuery = (name) => ({ name, in: 'query', required: true, schema: date });
const shiftPaths = {
  '/api/shift-templates': { servers: shiftServers, post: secured({ summary: 'Create shift template (HR)', requestBody: body(ref('ShiftTemplateInput')), responses: { ...bare('Shift template created', ref('ShiftTemplate'), 201), ...errorResponses, ...conflict } }), get: secured({ summary: 'List shift templates (HR)', parameters: pagination, responses: { 200: pageResponse(ref('ShiftTemplate')), ...errorResponses } }) },
  '/api/shift-assignments': { servers: shiftServers, post: secured({ summary: 'Assign a shift template to an employee over an inclusive date range (HR)', requestBody: body(ref('ShiftAssignmentInput')), responses: { ...bare('Shift assignment created', ref('ShiftAssignment'), 201), ...errorResponses, ...conflict } }) },
  '/api/shifts/me': { servers: shiftServers, get: secured({ summary: 'My shifts for today through the next 13 days (EMPLOYEE)', parameters: pagination, responses: { 200: pageResponse(ref('ShiftRow')), ...errorResponses } }) },
  '/api/shifts/team': { servers: shiftServers, get: secured({ summary: 'Team shifts over an inclusive date range (MANAGER)', parameters: [dateQuery('from'), dateQuery('to'), ...pagination], responses: { 200: pageResponse(ref('ShiftRow')), ...errorResponses } }) },
  '/api/attendance/check-in': { servers: shiftServers, post: secured({ summary: 'Check in (EMPLOYEE)', responses: { ...bare('Attendance record opened', ref('AttendanceRecord'), 201), ...errorResponses, ...conflict } }) },
  '/api/attendance/check-out': { servers: shiftServers, patch: secured({ summary: 'Check out (EMPLOYEE)', responses: { ...bare('Attendance record closed', ref('AttendanceRecord')), ...errorResponses } }) },
  '/api/attendance/{attendanceId}/unscheduled': { servers: shiftServers, patch: secured({ summary: 'Flag a team member attendance record as unscheduled (MANAGER)', parameters: [{ name: 'attendanceId', in: 'path', required: true, schema: id }], responses: { ...bare('Attendance record updated', ref('AttendanceRecord')), ...errorResponses } }) },
  '/api/overtime-reports/monthly': { servers: shiftServers, get: secured({ summary: 'Monthly overtime per employee (HR)', parameters: [{ name: 'month', in: 'query', required: true, schema: { type: 'string', pattern: '^\\d{4}-(0[1-9]|1[0-2])$', example: '2026-01' } }, ...pagination], responses: { 200: pageResponse(ref('MonthlyOvertimeRow')), ...errorResponses } }) },
};
Object.assign(spec.components.schemas, shiftSchemas);
Object.assign(spec.paths, shiftPaths);
module.exports = { spec };
