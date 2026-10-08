const { ObjectId } = require('mongodb');
const { ConflictError, ValidationError } = require('../errors');
const { isValidDate, isValidMonth, monthBounds } = require('../utils/scheduleTime');

const COLLECTION = 'attendance_records';
const DUPLICATE_KEY = 11000;
const COMPLETION_FIELDS = ['checkOutAt', 'lateOvertimeMinutes', 'overtimeMinutes', 'overtimeFlagged'];

const toObjectId = (value, label) => {
  if (!ObjectId.isValid(value)) throw new ValidationError(`${label} is not a valid id`);
  return new ObjectId(value);
};

/** Data access for shift-aware attendance records (separate from the legacy `attendance` collection). */
class AttendanceRecordsRepository {
  constructor(db) { this.collection = db.collection(COLLECTION); }

  /** Idempotent. The partial unique index enforces at most one open record per employee. */
  ensureIndexes() {
    return Promise.all([
      this.collection.createIndex({ employeeId: 1 }, { unique: true, partialFilterExpression: { checkOutAt: { $type: 'null' } }, name: 'uniq_open_record_per_employee' }),
      this.collection.createIndex({ employeeId: 1, attendanceDate: 1 }, { name: 'employee_date' }),
      this.collection.createIndex({ attendanceDate: 1, employeeId: 1, overtimeMinutes: 1 }, { name: 'monthly_overtime_report' })
    ]);
  }

  async createAttendanceRecord(input) {
    if (!isValidDate(input?.attendanceDate)) throw new ValidationError('attendanceDate must be a valid YYYY-MM-DD date');
    const document = {
      employeeId: toObjectId(input.employeeId, 'employeeId'),
      attendanceDate: input.attendanceDate,
      shiftAssignmentId: input.shiftAssignmentId ? toObjectId(input.shiftAssignmentId, 'shiftAssignmentId') : null,
      checkInAt: input.checkInAt,
      checkOutAt: null,
      unscheduled: Boolean(input.unscheduled),
      overtimeFlagged: Boolean(input.overtimeFlagged),
      earlyOvertimeMinutes: input.earlyOvertimeMinutes ?? 0,
      lateOvertimeMinutes: input.lateOvertimeMinutes ?? 0,
      overtimeMinutes: input.overtimeMinutes ?? 0
    };
    try {
      const result = await this.collection.insertOne(document);
      return { ...document, _id: result.insertedId };
    } catch (error) {
      if (error?.code === DUPLICATE_KEY) throw new ConflictError('An open attendance record already exists for this employee', { cause: error });
      throw error;
    }
  }

  findOpenAttendanceForEmployee(employeeId) {
    return this.collection.findOne({ employeeId: toObjectId(employeeId, 'employeeId'), checkOutAt: null });
  }

  async findAttendanceById(attendanceId) {
    if (!ObjectId.isValid(attendanceId)) return null;
    return this.collection.findOne({ _id: new ObjectId(attendanceId) });
  }

  /** Closes the still-open record; returns the updated document, or null when it is missing or already closed. */
  completeAttendanceRecord(attendanceId, employeeId, patch) {
    if (!ObjectId.isValid(attendanceId)) return null;
    const changes = Object.fromEntries(COMPLETION_FIELDS.filter((field) => patch[field] !== undefined).map((field) => [field, patch[field]]));
    return this.collection.findOneAndUpdate(
      { _id: new ObjectId(attendanceId), employeeId: toObjectId(employeeId, 'employeeId'), checkOutAt: null },
      { $set: changes },
      { returnDocument: 'after' }
    );
  }

  markUnscheduled(attendanceId) {
    if (!ObjectId.isValid(attendanceId)) return null;
    return this.collection.findOneAndUpdate({ _id: new ObjectId(attendanceId) }, { $set: { unscheduled: true } }, { returnDocument: 'after' });
  }

  async findAttendanceForManager(employeeIds, { offset, limit }) {
    if (!employeeIds || employeeIds.length === 0) return { items: [], offset, limit, total: 0 };
    const filter = { employeeId: { $in: employeeIds.map((id) => toObjectId(id, 'employeeId')) } };
    const [items, total] = await Promise.all([
      this.collection.find(filter).sort({ attendanceDate: -1, _id: -1 }).skip(offset).limit(limit).toArray(),
      this.collection.countDocuments(filter)
    ]);
    return { items, offset, limit, total };
  }

  /** Per-employee overtime totals for a YYYY-MM month, ordered by employeeId. */
  async aggregateMonthlyOvertime(month, { offset, limit }) {
    if (!isValidMonth(month)) throw new ValidationError('month must be a valid YYYY-MM value');
    const { first, last } = monthBounds(month);
    const [result] = await this.collection.aggregate([
      { $match: { attendanceDate: { $gte: first, $lte: last } } },
      { $group: { _id: '$employeeId', overtimeMinutes: { $sum: '$overtimeMinutes' } } },
      { $sort: { _id: 1 } },
      { $facet: { items: [{ $skip: offset }, { $limit: limit }], total: [{ $count: 'count' }] } }
    ]).toArray();
    const items = result.items.map((row) => ({
      employeeId: row._id.toString(),
      overtimeMinutes: row.overtimeMinutes,
      overtimeHours: Math.round((row.overtimeMinutes / 60) * 100) / 100
    }));
    return { items, offset, limit, total: result.total[0]?.count ?? 0 };
  }
}

const createAttendanceRecordsRepository = (db) => new AttendanceRecordsRepository(db);
module.exports = { AttendanceRecordsRepository, createAttendanceRecordsRepository };
