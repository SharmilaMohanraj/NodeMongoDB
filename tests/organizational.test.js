const jwt = require('jsonwebtoken');
const request = require('supertest');
const { ObjectId } = require('mongodb');
const { createApp } = require('../src/app');

const ids = {
  department: '507f1f77bcf86cd799439101',
  designation: '507f1f77bcf86cd799439102',
  manager: '507f1f77bcf86cd799439103',
  employee: '507f1f77bcf86cd799439104',
  grandchild: '507f1f77bcf86cd799439105',
  otherManager: '507f1f77bcf86cd799439106',
  unrelated: '507f1f77bcf86cd799439107',
  missing: '507f1f77bcf86cd799439108',
};

const equal = (left, right) => String(left) === String(right);
const matches = (document, filter) => Object.entries(filter).every(([key, value]) => equal(document[key], value));

// Keep the test database shaped like the Mongo collection API used by the repositories.
function createFakeDb(seed = {}) {
  const records = Object.fromEntries(Object.entries(seed).map(([name, values]) => [name, [...values]]));
  return {
    collection(name) {
      records[name] ||= [];
      return {
        findOne: async (filter) => records[name].find((document) => matches(document, filter)) || null,
        insertOne: async (document) => {
          const insertedId = new ObjectId();
          records[name].push({ ...document, _id: insertedId });
          return { insertedId };
        },
        find(filter) {
          let result = records[name].filter((document) => matches(document, filter));
          return {
            sort(sort) {
              const fields = Object.entries(sort);
              result = [...result].sort((left, right) => {
                for (const [field, direction] of fields) {
                  const compared = String(left[field] || '').localeCompare(String(right[field] || ''));
                  if (compared) return compared * direction;
                }
                return 0;
              });
              return this;
            },
            skip(offset) {
              result = result.slice(offset);
              return this;
            },
            limit(limit) {
              result = result.slice(0, limit);
              return this;
            },
            toArray: async () => result,
          };
        },
        countDocuments: async (filter) => records[name].filter((document) => matches(document, filter)).length,
      };
    },
  };
}

const config = { jwtSecret: 'organizational-test-secret', jwtExpiresIn: '30m', logLevel: 'silent' };
const tokenFor = (employeeId, role) => jwt.sign({ employeeId, role }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
const employeePayload = (overrides = {}) => ({
  firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', password: 'password123', role: 'EMPLOYEE', ...overrides,
});
const makeApp = (seed) => createApp({ db: createFakeDb(seed), config, logger: { error: jest.fn() } });

describe('organizational employee remediation', () => {
  test('onboarding permits omitted optional assignments but validates every supplied reference', async () => {
    const app = makeApp({
      departments: [{ _id: new ObjectId(ids.department), name: 'Engineering' }],
      designations: [{ _id: new ObjectId(ids.designation), name: 'Engineer', departmentId: new ObjectId(ids.department) }],
      employees: [
        { _id: new ObjectId(ids.manager), firstName: 'Mina', lastName: 'Manager', email: 'manager@example.com', role: 'MANAGER' },
        { _id: new ObjectId(ids.employee), firstName: 'Eli', lastName: 'Employee', email: 'employee@example.com', role: 'EMPLOYEE' },
      ],
    });
    const hr = { Authorization: `Bearer ${tokenFor(ids.manager, 'HR')}` };

    const unassigned = await request(app).post('/api/v1/employees').set(hr).send(employeePayload());
    expect(unassigned.status).toBe(201);
    expect(unassigned.body.data).toMatchObject({ departmentId: null, designationId: null, managerId: null });
    expect(unassigned.body.data.passwordHash).toBeUndefined();

    const assigned = await request(app).post('/api/v1/employees').set(hr).send(employeePayload({
      email: 'assigned@example.com', departmentId: ids.department, designationId: ids.designation, managerId: ids.manager,
    }));
    expect(assigned.status).toBe(201);
    expect(assigned.body.data).toMatchObject({ departmentId: ids.department, designationId: ids.designation, managerId: ids.manager });

    for (const [field, value] of [
      ['departmentId', ids.missing],
      ['designationId', ids.missing],
      ['managerId', ids.employee],
      ['managerId', ids.missing],
    ]) {
      const response = await request(app).post('/api/v1/employees').set(hr).send(employeePayload({ email: `${field}-${value}@example.com`, [field]: value }));
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    }
  });

  test('a manager can see only their direct reports, never descendants or another manager’s reports', async () => {
    const app = makeApp({
      employees: [
        { _id: new ObjectId(ids.manager), firstName: 'Mina', lastName: 'Manager', role: 'MANAGER' },
        { _id: new ObjectId(ids.employee), firstName: 'Drew', lastName: 'Direct', role: 'EMPLOYEE', managerId: new ObjectId(ids.manager) },
        { _id: new ObjectId(ids.grandchild), firstName: 'Gia', lastName: 'Grandchild', role: 'EMPLOYEE', managerId: new ObjectId(ids.employee) },
        { _id: new ObjectId(ids.unrelated), firstName: 'Una', lastName: 'Unrelated', role: 'EMPLOYEE', managerId: new ObjectId(ids.otherManager) },
      ],
    });

    const response = await request(app)
      .get('/api/v1/employees/subordinates')
      .set('Authorization', `Bearer ${tokenFor(ids.manager, 'MANAGER')}`);

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(1);
    expect(response.body.items.map((employee) => employee.id)).toEqual([ids.employee]);

    const employeeResponse = await request(app)
      .get('/api/v1/employees/subordinates')
      .set('Authorization', `Bearer ${tokenFor(ids.employee, 'EMPLOYEE')}`);
    expect(employeeResponse.status).toBe(403);
  });
});
