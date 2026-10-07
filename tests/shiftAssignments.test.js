const { ObjectId } = require('mongodb');
const { repository, coveredDates } = require('../src/repositories/shiftAssignments');
const { createShiftSchedulingService } = require('../src/services/shiftScheduling');
const { ConflictError } = require('../src/errors');

const employeeId = '507f1f77bcf86cd799439001';
const templateId = '507f1f77bcf86cd799439002';
const hrUserId = '507f1f77bcf86cd799439003';

class Collection {
  constructor(name, db) { this.name = name; this.db = db; this.documents = []; this.indexes = []; }
  async createIndex(keys, options) { this.indexes.push({ keys, options }); return options?.name; }
  async insertMany(documents, options) {
    if (this.name === 'shift_assignment_dates') {
      for (const document of documents) {
        if (this.documents.some((existing) => existing.employeeId.equals(document.employeeId) && existing.date === document.date)) {
          const error = new Error('E11000 duplicate key'); error.code = 11000; throw error;
        }
      }
    }
    this.documents.push(...documents.map((document) => ({ ...document, _id: document._id || new ObjectId() })));
    return { insertedCount: documents.length };
  }
  async insertOne(document, options) {
    if (this.db.failAssignmentInsert && this.name === 'shift_assignments') { const error = new Error('insert failed'); error.code = 11000; throw error; }
    const insertedId = new ObjectId(); this.documents.push({ ...document, _id: insertedId }); return { insertedId };
  }
  async findOne(filter) {
    return this.documents.find((document) => document.employeeId.equals(filter.employeeId) && (!filter.date || filter.date.$in.includes(document.date))) || null;
  }
}

class TransactionDb {
  constructor() {
    this.collections = new Map();
    this.client = { startSession: () => this.session() };
  }
  collection(name) {
    if (!this.collections.has(name)) this.collections.set(name, new Collection(name, this));
    return this.collections.get(name);
  }
  session() {
    return {
      withTransaction: async (work) => {
        const snapshots = [...this.collections.entries()].map(([name, collection]) => [name, collection.documents.slice()]);
        try { await work(); } catch (error) { snapshots.forEach(([name, documents]) => { this.collection(name).documents = documents; }); throw error; }
      },
      endSession: jest.fn(),
    };
  }
}

const assignmentInput = (startDate, endDate) => ({ employeeId, shiftTemplateId: templateId, assignedBy: hrUserId, startDate, endDate });

describe('atomic shift-assignment date reservations', () => {
  test('reserves every inclusive calendar boundary and commits reservations with its assignment', async () => {
    const db = new TransactionDb();
    const assignments = repository(db);
    await assignments.createShiftAssignment(assignmentInput('2025-02-27', '2025-03-01'));

    expect(coveredDates('2025-02-27', '2025-03-01')).toEqual(['2025-02-27', '2025-02-28', '2025-03-01']);
    expect(db.collection('shift_assignments').documents).toHaveLength(1);
    expect(db.collection('shift_assignment_dates').documents.map((item) => item.date)).toEqual(['2025-02-27', '2025-02-28', '2025-03-01']);
    expect(db.collection('shift_assignment_dates').indexes).toContainEqual({ keys: { employeeId: 1, date: 1 }, options: { unique: true, name: 'shift_assignment_dates_employee_date_unique' } });
  });

  test('rolls back date reservations when assignment insertion fails', async () => {
    const db = new TransactionDb();
    db.failAssignmentInsert = true;
    await expect(repository(db).createShiftAssignment(assignmentInput('2025-03-01', '2025-03-02'))).rejects.toMatchObject({ code: 11000 });
    expect(db.collection('shift_assignments').documents).toHaveLength(0);
    expect(db.collection('shift_assignment_dates').documents).toHaveLength(0);
  });

  test('translates duplicate date reservation conflicts to ConflictError without partial writes', async () => {
    const db = new TransactionDb();
    const assignments = repository(db);
    const service = createShiftSchedulingService({
      db,
      assignments,
      employees: { employeeExists: jest.fn().mockResolvedValue(true) },
      templates: { findShiftTemplateById: jest.fn().mockResolvedValue({ _id: new ObjectId(templateId) }) },
      attendance: {},
    });
    await service.assignShift(hrUserId, assignmentInput('2025-03-01', '2025-03-03'));
    await expect(service.assignShift(hrUserId, assignmentInput('2025-03-03', '2025-03-05'))).rejects.toBeInstanceOf(ConflictError);
    expect(db.collection('shift_assignments').documents).toHaveLength(1);
    expect(db.collection('shift_assignment_dates').documents.map((item) => item.date)).toEqual(['2025-03-01', '2025-03-02', '2025-03-03']);
  });
});
