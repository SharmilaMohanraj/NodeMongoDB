const { BaseRepository } = require('./baseRepository');
const { ValidationError } = require('../errors');
const { validDate } = require('./shiftAssignments');

function repository(db) {
  const collection = db.collection('attendance_records');
  const ensureIndexes = () => Promise.all([
    collection.createIndex({ employeeId: 1, checkOutAt: 1 }, { unique: true, partialFilterExpression: { checkOutAt: null }, name: 'one_open_attendance_per_employee' }),
    collection.createIndex({ employeeId: 1, attendanceDate: 1 }, { name: 'attendance_employee_date' }),
    collection.createIndex({ attendanceDate: 1, employeeId: 1 }, { name: 'attendance_date_employee' }),
  ]);
  const normalize = (record) => ({ ...record, employeeId: BaseRepository.objectId(record.employeeId), shiftAssignmentId: record.shiftAssignmentId ? BaseRepository.objectId(record.shiftAssignmentId) : null });
  return {
    async createAttendanceRecord(input) { if (!validDate(input.attendanceDate)) throw new ValidationError('attendanceDate must be YYYY-MM-DD'); await ensureIndexes(); const document = normalize(input); const result = await collection.insertOne(document); return { ...document, _id: result.insertedId }; },
    findOpenAttendanceForEmployee: (employeeId) => collection.findOne({ employeeId: BaseRepository.objectId(employeeId), checkOutAt: null }),
    async completeAttendanceRecord(attendanceId, employeeId, patch) { const result = await collection.findOneAndUpdate({ _id: BaseRepository.objectId(attendanceId), employeeId: BaseRepository.objectId(employeeId), checkOutAt: null }, { $set: patch }, { returnDocument: 'after' }); return result && (result.value === undefined ? result : result.value); },
    async markUnscheduled(attendanceId) { const result = await collection.findOneAndUpdate({ _id: BaseRepository.objectId(attendanceId) }, { $set: { unscheduled: true } }, { returnDocument: 'after' }); return result && (result.value === undefined ? result : result.value); },
    async findAttendanceForManager(employeeIds, { offset = 0, limit = 20 } = {}) { const ids = employeeIds.map((id) => BaseRepository.objectId(id)); const filter = { employeeId: { $in: ids } }; const [items, total] = await Promise.all([collection.find(filter).sort({ attendanceDate: -1, _id: 1 }).skip(offset).limit(limit).toArray(), collection.countDocuments(filter)]); return { items, offset, limit, total }; },
    async aggregateMonthlyOvertime(month, { offset = 0, limit = 20 } = {}) { if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month || '')) throw new ValidationError('month must be YYYY-MM'); const match = { attendanceDate: { $gte: `${month}-01`, $lt: `${month}-99` } }; const rows = await collection.aggregate([{ $match: match }, { $group: { _id: '$employeeId', overtimeMinutes: { $sum: '$overtimeMinutes' } } }, { $sort: { _id: 1 } }, { $facet: { items: [{ $skip: offset }, { $limit: limit }], count: [{ $count: 'total' }] } }]).toArray(); const result = rows[0] || { items: [], count: [] }; return { items: result.items.map((item) => ({ employeeId: item._id, overtimeMinutes: item.overtimeMinutes, overtimeHours: item.overtimeMinutes / 60 })), offset, limit, total: result.count[0]?.total || 0 }; },
    findById: (attendanceId) => collection.findOne({ _id: BaseRepository.objectId(attendanceId) }),
  };
}
let configuredRepository;
function configureAttendanceRecordsRepository(db) { configuredRepository = repository(db); return configuredRepository; }
function active() { if (!configuredRepository) throw new Error('Attendance records repository is not configured'); return configuredRepository; }
module.exports = { configureAttendanceRecordsRepository, createAttendanceRecord: (input) => active().createAttendanceRecord(input), findOpenAttendanceForEmployee: (id) => active().findOpenAttendanceForEmployee(id), completeAttendanceRecord: (id, employeeId, patch) => active().completeAttendanceRecord(id, employeeId, patch), markUnscheduled: (id) => active().markUnscheduled(id), findAttendanceForManager: (ids, page) => active().findAttendanceForManager(ids, page), aggregateMonthlyOvertime: (month, page) => active().aggregateMonthlyOvertime(month, page), repository };
