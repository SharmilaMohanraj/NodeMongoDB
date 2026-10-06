const jwt = require('jsonwebtoken');
const request = require('supertest');
const { ObjectId } = require('mongodb');
const { createApp } = require('../src/app');

const config = { jwtSecret: 'workforce-test-secret', jwtExpiresIn: '30m', logLevel: 'silent' };
const id = (hex) => new ObjectId(hex);
const idsEqual = (left, right) => left && right && left.toString() === right.toString();

const matches = (document, filter = {}) => Object.entries(filter).every(([key, expected]) => {
  const actual = document[key];
  if (expected && Array.isArray(expected.$in)) return expected.$in.some((value) => idsEqual(actual, value));
  return idsEqual(actual, expected) || actual === expected;
});

class FakeCollection {
  constructor(documents = []) { this.documents = documents; }

  async findOne(filter) { return this.documents.find((document) => matches(document, filter)) || null; }

  find(filter = {}) {
    let results = this.documents.filter((document) => matches(document, filter));
    const cursor = {
      sort: (order) => {
        const [[field, direction]] = Object.entries(order);
        results = [...results].sort((left, right) => (left[field] > right[field] ? direction : left[field] < right[field] ? -direction : 0));
        return cursor;
      },
      skip: (offset) => { results = results.slice(offset); return cursor; },
      limit: (limit) => { results = results.slice(0, limit); return cursor; },
      toArray: async () => results,
    };
    return cursor;
  }

  async countDocuments(filter = {}) { return this.documents.filter((document) => matches(document, filter)).length; }

  async insertOne(document) {
    const insertedId = document._id || new ObjectId();
    this.documents.push({ ...document, _id: insertedId });
    return { insertedId };
  }

  async findOneAndUpdate(filter, update, options = {}) {
    let document = await this.findOne(filter);
    if (!document && options.upsert) {
      document = { ...filter, _id: new ObjectId(), ...(update.$setOnInsert || {}) };
      this.documents.push(document);
    }
    if (!document) return null;
    Object.assign(document, update.$set || {});
    return document;
  }
}

const makeApp = () => {
  const employees = [
    { _id: id('507f1f77bcf86cd799439001'), role: 'EMPLOYEE', firstName: 'Erin', lastName: 'Employee' },
    { _id: id('507f1f77bcf86cd799439002'), role: 'MANAGER', firstName: 'Manny', lastName: 'Manager' },
    { _id: id('507f1f77bcf86cd799439003'), role: 'EMPLOYEE', firstName: 'Dina', lastName: 'Direct', managerId: id('507f1f77bcf86cd799439002') },
    { _id: id('507f1f77bcf86cd799439004'), role: 'EMPLOYEE', firstName: 'Una', lastName: 'Unrelated' },
    { _id: id('507f1f77bcf86cd799439005'), role: 'MANAGER', firstName: 'Other', lastName: 'Manager' },
    { _id: id('507f1f77bcf86cd799439006'), role: 'HR', firstName: 'Hana', lastName: 'Hr' },
  ];
  const collections = new Map([
    ['employees', new FakeCollection(employees)],
    ['attendance', new FakeCollection()],
    ['leave_requests', new FakeCollection()],
    ['leave_balances', new FakeCollection()],
  ]);
  const db = { collection: (name) => {
    if (!collections.has(name)) collections.set(name, new FakeCollection());
    return collections.get(name);
  } };
  return { app: createApp({ db, config, logger: { error: jest.fn() } }), collections };
};

const token = (employeeId, role) => `Bearer ${jwt.sign({ employeeId: employeeId.toString(), role }, config.jwtSecret, { expiresIn: config.jwtExpiresIn })}`;
const auth = (number, role) => token(id(`507f1f77bcf86cd79943900${number}`), role);

describe('workforce remediation contracts', () => {
  test('attendance rejects an open-record conflict and limits employee and manager history to self while HR sees all', async () => {
    const { app } = makeApp();
    const employee = auth(1, 'EMPLOYEE');
    const manager = auth(2, 'MANAGER');
    const hr = auth(6, 'HR');

    expect((await request(app).post('/api/v1/attendance/check-in').set('Authorization', employee).send({})).status).toBe(201);
    expect((await request(app).post('/api/v1/attendance/check-in').set('Authorization', employee).send({})).status).toBe(409);
    expect((await request(app).post('/api/v1/attendance/check-in').set('Authorization', manager).send({})).status).toBe(201);
    expect((await request(app).get('/api/v1/attendance').set('Authorization', employee)).body.total).toBe(1);
    expect((await request(app).get('/api/v1/attendance').set('Authorization', manager)).body.total).toBe(1);
    expect((await request(app).get('/api/v1/attendance').set('Authorization', hr)).body.total).toBe(2);
  });

  test('leave visibility is self-only for employees, direct-team plus self for managers, and global for HR', async () => {
    const { app, collections } = makeApp();
    await collections.get('leave_requests').insertOne({ _id: id('507f1f77bcf86cd799439011'), employeeId: id('507f1f77bcf86cd799439002'), status: 'PENDING', createdAt: new Date('2025-01-01') });
    await collections.get('leave_requests').insertOne({ _id: id('507f1f77bcf86cd799439012'), employeeId: id('507f1f77bcf86cd799439003'), status: 'PENDING', createdAt: new Date('2025-01-02') });
    await collections.get('leave_requests').insertOne({ _id: id('507f1f77bcf86cd799439013'), employeeId: id('507f1f77bcf86cd799439004'), status: 'PENDING', createdAt: new Date('2025-01-03') });

    const employeeResponse = await request(app).get('/api/v1/leave-requests').set('Authorization', auth(3, 'EMPLOYEE'));
    const managerResponse = await request(app).get('/api/v1/leave-requests').set('Authorization', auth(2, 'MANAGER'));
    const hrResponse = await request(app).get('/api/v1/leave-requests').set('Authorization', auth(6, 'HR'));
    expect(employeeResponse.body.items.map((item) => item.employeeId)).toEqual([id('507f1f77bcf86cd799439003').toString()]);
    expect(managerResponse.body.items.map((item) => item.employeeId).sort()).toEqual([id('507f1f77bcf86cd799439002').toString(), id('507f1f77bcf86cd799439003').toString()].sort());
    expect(hrResponse.body.total).toBe(3);
  });

  test('only a requestor’s direct manager can transition a PENDING leave request once', async () => {
    const { app, collections } = makeApp();
    const requestId = '507f1f77bcf86cd799439021';
    await collections.get('leave_requests').insertOne({ _id: id(requestId), employeeId: id('507f1f77bcf86cd799439003'), status: 'PENDING', createdAt: new Date() });

    expect((await request(app).patch(`/api/v1/leave-requests/${requestId}`).set('Authorization', auth(5, 'MANAGER')).send({ status: 'APPROVED' })).status).toBe(403);
    expect((await request(app).patch(`/api/v1/leave-requests/${requestId}`).set('Authorization', auth(6, 'HR')).send({ status: 'APPROVED' })).status).toBe(403);
    const approved = await request(app).patch(`/api/v1/leave-requests/${requestId}`).set('Authorization', auth(2, 'MANAGER')).send({ status: 'APPROVED' });
    expect(approved.status).toBe(200);
    expect(approved.body.data.status).toBe('APPROVED');
    expect((await request(app).patch(`/api/v1/leave-requests/${requestId}`).set('Authorization', auth(2, 'MANAGER')).send({ status: 'REJECTED' })).status).toBe(409);
  });

  test('leave balances require HR, a matching year, an existing employee, and used days no greater than allocated days', async () => {
    const { app } = makeApp();
    const endpoint = '/api/v1/leave-balances/507f1f77bcf86cd799439003/2025';
    expect((await request(app).put(endpoint).set('Authorization', auth(3, 'EMPLOYEE')).send({ year: 2025, allocatedDays: 10, usedDays: 1 })).status).toBe(403);
    expect((await request(app).put(endpoint).set('Authorization', auth(6, 'HR')).send({ year: 2024, allocatedDays: 10, usedDays: 1 })).status).toBe(400);
    expect((await request(app).put(endpoint).set('Authorization', auth(6, 'HR')).send({ year: 2025, allocatedDays: 2, usedDays: 3 })).status).toBe(400);
    expect((await request(app).put('/api/v1/leave-balances/507f1f77bcf86cd799439099/2025').set('Authorization', auth(6, 'HR')).send({ year: 2025, allocatedDays: 2, usedDays: 1 })).status).toBe(404);
    const saved = await request(app).put(endpoint).set('Authorization', auth(6, 'HR')).send({ year: 2025, allocatedDays: 10, usedDays: 3 });
    expect(saved.status).toBe(200);
    expect(saved.body.data).toMatchObject({ employeeId: id('507f1f77bcf86cd799439003').toString(), year: 2025, allocatedDays: 10, usedDays: 3 });
  });
});
