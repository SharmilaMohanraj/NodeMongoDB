const { BaseRepository } = require('../repositories/baseRepository');

class AttendanceRepository extends BaseRepository {
  constructor(db) { super(db, 'attendance'); }
  findOpen(employeeId) { return this.collection.findOne({ employeeId, checkOutAt: null }); }
  create(document) { return this.collection.insertOne(document); }
  async closeOpen(employeeId, checkOutAt, updatedAt) {
    const result = await this.collection.findOneAndUpdate(
      { employeeId, checkOutAt: null },
      { $set: { checkOutAt, updatedAt } },
      { returnDocument: 'after' }
    );
    return result && (result.value === undefined ? result : result.value);
  }
}

class LeaveRequestRepository extends BaseRepository {
  constructor(db) { super(db, 'leave_requests'); }
  create(document) { return this.collection.insertOne(document); }
  async transitionPending(id, update) {
    const result = await this.collection.findOneAndUpdate(
      { _id: BaseRepository.objectId(id), status: 'PENDING' },
      { $set: update }, { returnDocument: 'after' }
    );
    return result && (result.value === undefined ? result : result.value);
  }
}

class LeaveBalanceRepository extends BaseRepository {
  constructor(db) { super(db, 'leave_balances'); }
  async upsert(employeeId, year, values) {
    const result = await this.collection.findOneAndUpdate(
      { employeeId, year },
      { $set: { ...values, employeeId, year }, $setOnInsert: { createdAt: values.updatedAt } },
      { upsert: true, returnDocument: 'after' }
    );
    return result && (result.value === undefined ? result : result.value);
  }
}

module.exports = { AttendanceRepository, LeaveRequestRepository, LeaveBalanceRepository };
