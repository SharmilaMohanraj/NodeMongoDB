const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { AuthService } = require('../src/auth');
const { employeeDto } = require('../src/dto');
const { authenticate, authorize, paginationSchema } = require('../src/middleware');
const { AuthenticationError, AuthorizationError } = require('../src/errors');
const employee = { _id: { toString: () => '507f1f77bcf86cd799439011' }, email: 'hr@example.com', passwordHash: '', firstName: 'H', lastName: 'R', role: 'HR' };
const config = { jwtSecret: 'a-test-secret', jwtExpiresIn: '30m' };
describe('authentication and authorization', () => {
 beforeAll(async () => { employee.passwordHash = await bcrypt.hash('secret123', 4); });
 test('issues an access token with exactly 30-minute configured expiry and sanitizes employee', async () => { const service = new AuthService({ collection: () => ({ findOne: jest.fn().mockResolvedValue(employee) }) }, config); const result = await service.login({ email: 'HR@EXAMPLE.COM', password: 'secret123' }); const decoded = jwt.verify(result.accessToken, config.jwtSecret); expect(decoded.role).toBe('HR'); expect(decoded.exp - decoded.iat).toBe(1800); expect(result.employee.passwordHash).toBeUndefined(); });
 test('rejects invalid credentials', async () => { const service = new AuthService({ collection: () => ({ findOne: jest.fn().mockResolvedValue(null) }) }, config); await expect(service.login({ email: 'none@example.com', password: 'bad' })).rejects.toBeInstanceOf(AuthenticationError); });
 test('rejects missing bearer and wrong roles', () => { const next = jest.fn(); authenticate(config)({ get: () => undefined }, {}, next); expect(next.mock.calls[0][0]).toBeInstanceOf(AuthenticationError); const denied = jest.fn(); authorize('HR')({ auth: { role: 'EMPLOYEE' } }, {}, denied); expect(denied.mock.calls[0][0]).toBeInstanceOf(AuthorizationError); });
 test('pagination defaults and employee DTO avoid password hash', () => { expect(paginationSchema.parse({})).toEqual({ offset: 0, limit: 20 }); expect(employeeDto(employee).passwordHash).toBeUndefined(); });
});
