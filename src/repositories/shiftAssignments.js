const { ObjectId } = require('mongodb');
const { ValidationError } = require('../errors');
const { isValidDate } = require('../utils/scheduleTime');

const COLLECTION = 'shift_assignments';

const toObjectId = (value, label) => {
  if (!ObjectId.isValid(value)) throw new ValidationError(`${label} is not a valid id`);
  return new ObjectId(value);
};

const assertDateRange = (startDate, endDate) => {
  if (!isValidDate(startDate)) throw new ValidationError('startDate must be a valid YYYY-MM-DD date');
  if (!isValidDate(endDate)) throw new ValidationError('endDate must be a valid YYYY-MM-DD date');
  if (startDate > endDate) throw new ValidationError('startDate must be on or before endDate');
};

/** Data access for assignments of shift templates to employees over inclusive date ranges. */
class ShiftAssignmentsRepository {
  constructor(db) { this.collection = db.collection(COLLECTION); }

  ensureIndexes() { return this.collection.createIndex({ employeeId: 1, startDate: 1, endDate: 1 }, { name: 'employee_date_range' }); }

  async createShiftAssignment(input) {
    assertDateRange(input?.startDate, input?.endDate);
    const document = {
      employeeId: toObjectId(input.employeeId, 'employeeId'),
      shiftTemplateId: toObjectId(input.shiftTemplateId, 'shiftTemplateId'),
      startDate: input.startDate,
      endDate: input.endDate,
      assignedBy: toObjectId(input.assignedBy, 'assignedBy'),
      createdAt: new Date()
    };
    const result = await this.collection.insertOne(document);
    return { ...document, _id: result.insertedId };
  }

  async findShiftAssignmentById(id) {
    if (!ObjectId.isValid(id)) return null;
    return this.collection.findOne({ _id: new ObjectId(id) });
  }

  /** Assignments of the given employees whose inclusive range intersects [fromDate, toDate]. */
  async findApplicableAssignments(employeeIds, fromDate, toDate) {
    assertDateRange(fromDate, toDate);
    if (!employeeIds || employeeIds.length === 0) return [];
    const ids = employeeIds.map((id) => toObjectId(id, 'employeeId'));
    return this.collection.find({ employeeId: { $in: ids }, startDate: { $lte: toDate }, endDate: { $gte: fromDate } }).sort({ startDate: 1, _id: 1 }).toArray();
  }

  /** True when any existing assignment of the employee shares at least one calendar date (boundaries inclusive). */
  async hasAssignmentConflict(employeeId, startDate, endDate) {
    assertDateRange(startDate, endDate);
    const found = await this.collection.countDocuments(
      { employeeId: toObjectId(employeeId, 'employeeId'), startDate: { $lte: endDate }, endDate: { $gte: startDate } },
      { limit: 1 }
    );
    return found > 0;
  }
}

const createShiftAssignmentsRepository = (db) => new ShiftAssignmentsRepository(db);
module.exports = { ShiftAssignmentsRepository, createShiftAssignmentsRepository };
