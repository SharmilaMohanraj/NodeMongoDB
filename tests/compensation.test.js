const jwt = require('jsonwebtoken');
const request = require('supertest');
const { ObjectId } = require('mongodb');
const { createApp } = require('../src/app');
const { PayrollService } = require('../src/services/payrollService');
const { ValidationError } = require('../src/errors');

const config = { jwtSecret: 'compensation-test-secret', jwtExpiresIn: '30m', logLevel: 'silent' };
const tokenFor = (role) => jwt.sign({ sub: new ObjectId().toString(), role }, config.jwtSecret);
const emptyCursor = () => ({ sort: () => ({ skip: () => ({ limit: () => ({ toArray: async () => [] }) }) }) });

// This follows the existing lightweight fake-collection pattern rather than requiring MongoDB.
function createFakeDb() {
  let payrollRecord;
  const employees = { findOne: jest.fn().mockResolvedValue({ _id: new ObjectId() }) };
  const payroll = {
    insertOne: jest.fn(async (record) => { payrollRecord = { ...record, _id: new ObjectId() }; return { insertedId: payrollRecord._id }; }),
    findOne: jest.fn(async () => payrollRecord),
    updateOne: jest.fn(),
    deleteOne: jest.fn(),
    find: jest.fn(emptyCursor),
    countDocuments: jest.fn().mockResolvedValue(0)
  };
  const emptyCollection = { findOne: jest.fn().mockResolvedValue(null), find: jest.fn(emptyCursor), countDocuments: jest.fn().mockResolvedValue(0) };
  return { db: { collection: (name) => ({ employees, payroll_records: payroll }[name] || emptyCollection) }, payroll };
}

describe('compensation payroll contract and reports', () => {
  let app;
  let payroll;
  const employeeId = '507f1f77bcf86cd799439011';

  beforeEach(() => {
    const fake = createFakeDb();
    payroll = fake.payroll;
    app = createApp({ db: fake.db, config, logger: { error: jest.fn() } });
  });

  test('persists and serializes only the canonical payroll fields', async () => {
    const response = await request(app)
      .post('/api/v1/payroll-records')
      .set('Authorization', `Bearer ${tokenFor('HR')}`)
      .send({ employeeId, periodStart: '2025-01-01', periodEnd: '2025-01-31', amount: 4200 });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({ employeeId, periodStart: '2025-01-01', periodEnd: '2025-01-31', amount: 4200 });
    expect(payroll.insertOne).toHaveBeenCalledTimes(1);
    expect(payroll.insertOne.mock.calls[0][0]).not.toHaveProperty('grossPay');
    expect(payroll.insertOne.mock.calls[0][0]).not.toHaveProperty('payPeriodStart');
  });

  test.each([
    [{ employeeId, periodStart: '2025-01-01', periodEnd: '2025-01-31' }, 'amount is required'],
    [{ employeeId, periodStart: '2025-01-31', periodEnd: '2025-01-01', amount: 1 }, 'period order is invalid'],
    [{ employeeId, payPeriodStart: '2025-01-01', payPeriodEnd: '2025-01-31', grossPay: 10 }, 'legacy fields are rejected'],
    [{ employeeId, periodStart: '01/01/2025', periodEnd: '2025-01-31', amount: 1 }, 'non-ISO dates are rejected']
  ])('rejects invalid payroll input: %s', async (body) => {
    const response = await request(app)
      .post('/api/v1/payroll-records')
      .set('Authorization', `Bearer ${tokenFor('HR')}`)
      .send(body);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('enforces chronology in the service even when route validation is bypassed', async () => {
    const service = new PayrollService(
      { create: jest.fn(), list: jest.fn(), findById: jest.fn(), update: jest.fn(), remove: jest.fn() },
      { findOne: jest.fn().mockResolvedValue({ _id: new ObjectId() }) }
    );
    await expect(service.create({ employeeId, periodStart: new Date('2025-02-01T00:00:00Z'), periodEnd: new Date('2025-01-31T00:00:00Z'), amount: 1 }))
      .rejects.toBeInstanceOf(ValidationError);
  });

  test.each(['/attendance', '/leave-balances'])('allows report %s only to HR users', async (path) => {
    const denied = await request(app).get(`/api/v1/reports${path}`).set('Authorization', `Bearer ${tokenFor('EMPLOYEE')}`);
    const allowed = await request(app).get(`/api/v1/reports${path}`).set('Authorization', `Bearer ${tokenFor('HR')}`);
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe('AUTHORIZATION_ERROR');
    expect(allowed.status).toBe(200);
    expect(allowed.body).toEqual({ items: [], total: 0, limit: 20, offset: 0 });
  });
});
