const id = { type: 'string', pattern: '^[a-fA-F0-9]{24}$' };
const bearer = [{ bearerAuth: [] }];
const page = (description) => ({ get: { summary: description, security: bearer, parameters: [{ name: 'offset', in: 'query', schema: { type: 'integer', minimum: 0, default: 0 } }, { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, default: 20 } }], responses: { 200: { description: 'OK' }, 401: { description: 'Unauthenticated' }, 403: { description: 'Forbidden' } } } });
const write = (method, summary) => ({ [method]: { summary, security: bearer, requestBody: { required: method !== 'delete', content: { 'application/json': { schema: { type: 'object' } } } }, responses: { 200: { description: 'OK' }, 201: { description: 'Created' }, 204: { description: 'Deleted' }, 400: { description: 'Validation error' }, 403: { description: 'Forbidden' }, 404: { description: 'Not found' } } } });
const spec = { openapi: '3.0.3', info: { title: 'Enterprise HR API', version: '1.0.0' }, servers: [{ url: '/api/v1' }], components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } }, paths: {
  '/health': { servers: [{ url: '/' }], get: { summary: 'Health check', responses: { 200: { description: 'Healthy' } } } },
  '/auth/login': { post: { summary: 'Login', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['email', 'password'] } } } }, responses: { 200: { description: 'Token issued' }, 401: { description: 'Invalid credentials' } } } },
  '/employees': { ...page('List employees'), ...write('post', 'Onboard employee') }, '/employees/{id}': { get: { summary: 'Get employee', security: bearer, parameters: [{ name: 'id', in: 'path', required: true, schema: id }], responses: { 200: { description: 'OK' }, 403: { description: 'Forbidden' } } }, ...write('patch', 'Update employee') }, '/employees/subordinates': page('List direct subordinates'),
  '/departments': { ...page('List departments'), ...write('post', 'Create department') }, '/departments/{id}': { ...write('patch', 'Update department'), ...write('delete', 'Delete department') },
  '/designations': { ...page('List designations'), ...write('post', 'Create designation') }, '/designations/{id}': { ...write('patch', 'Update designation'), ...write('delete', 'Delete designation') },
  '/attendance': page('List attendance'), '/attendance/check-in': write('post', 'Check in'), '/attendance/check-out': write('post', 'Check out'),
  '/leave-requests': { ...page('List leave requests'), ...write('post', 'Create leave request') }, '/leave-requests/{id}': write('patch', 'Review leave request'), '/leave-balances/{employeeId}/{year}': write('put', 'Upsert leave balance'),
  '/payroll-records': { ...page('List payroll records'), ...write('post', 'Create payroll record') }, '/payroll-records/{id}': { ...write('patch', 'Update payroll record'), ...write('delete', 'Delete payroll record') },
  '/review-cycles': { ...page('List review cycles'), ...write('post', 'Create review cycle') }, '/review-cycles/{id}': { ...write('patch', 'Update review cycle'), ...write('delete', 'Delete review cycle') },
  '/reports/attendance': page('Attendance report'), '/reports/leave-balances': page('Leave balance report')
} };
module.exports = { spec };
