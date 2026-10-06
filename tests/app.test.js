const request = require('supertest');
const { createApp } = require('../src/app');
const emptyCollection = { findOne: jest.fn().mockResolvedValue(null), find: jest.fn(() => ({ sort: () => ({ skip: () => ({ limit: () => ({ toArray: async () => [] }) }) }) })), countDocuments: jest.fn().mockResolvedValue(0) };
const db = { collection: () => emptyCollection };
const app = createApp({ db, config: { jwtSecret: 'test-secret', jwtExpiresIn: '30m', logLevel: 'silent' }, logger: { error: jest.fn() } });
describe('deployment and API error contracts', () => {
 test('health, docs and OpenAPI are public', async () => { expect((await request(app).get('/health')).status).toBe(200); expect((await request(app).get('/docs')).status).toBe(301); expect((await request(app).get('/openapi.json')).status).toBe(200); });
 test('invalid login produces the JSON 401 envelope', async () => { const response = await request(app).post('/api/v1/auth/login').send({ email: 'none@example.com', password: 'wrong' }); expect(response.status).toBe(401); expect(response.body.error.code).toBe('AUTHENTICATION_ERROR'); expect(response.body.error.correlationId).toBeTruthy(); });
 test('protected endpoint rejects no token', async () => { expect((await request(app).get('/api/v1/departments')).status).toBe(401); });
});
