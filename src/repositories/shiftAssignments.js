const { BaseRepository } = require('./baseRepository');
const { ValidationError } = require('../errors');

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 24 * 60 * 60 * 1000;
function validDate(value) { const match = typeof value === 'string' && DATE.exec(value); if (!match) return false; const date = new Date(Date.UTC(+match[1], +match[2] - 1, +match[3])); return date.getUTCFullYear() === +match[1] && date.getUTCMonth() === +match[2] - 1 && date.getUTCDate() === +match[3]; }
function validateRange(startDate, endDate) { if (!validDate(startDate) || !validDate(endDate)) throw new ValidationError('Dates must be valid YYYY-MM-DD calendar dates'); if (startDate > endDate) throw new ValidationError('startDate must be on or before endDate'); }
function coveredDates(startDate, endDate) {
  validateRange(startDate, endDate);
  const dates = [];
  for (let timestamp = Date.parse(`${startDate}T00:00:00.000Z`), end = Date.parse(`${endDate}T00:00:00.000Z`); timestamp <= end; timestamp += DAY_MS) dates.push(new Date(timestamp).toISOString().slice(0, 10));
  return dates;
}

function repository(db, { client = db.client } = {}) {
  const collection = db.collection('shift_assignments');
  const reservations = db.collection('shift_assignment_dates');
  const ensureIndexes = () => Promise.all([
    collection.createIndex({ employeeId: 1, startDate: 1, endDate: 1 }, { name: 'shift_assignments_employee_dates' }),
    collection.createIndex({ employeeId: 1, endDate: 1 }, { name: 'shift_assignments_employee_end_date' }),
    reservations.createIndex({ employeeId: 1, date: 1 }, { unique: true, name: 'shift_assignment_dates_employee_date_unique' }),
  ]);
  return {
    async createShiftAssignment(input) {
      validateRange(input.startDate, input.endDate);
      if (!client || typeof client.startSession !== 'function') throw new Error('MongoDB client sessions are required for shift assignment creation');
      await ensureIndexes();
      const document = { employeeId: BaseRepository.objectId(input.employeeId), shiftTemplateId: BaseRepository.objectId(input.shiftTemplateId), startDate: input.startDate, endDate: input.endDate, assignedBy: BaseRepository.objectId(input.assignedBy), createdAt: input.createdAt || new Date() };
      const session = client.startSession();
      let insertedId;
      try {
        await session.withTransaction(async () => {
          const reservationDocuments = coveredDates(document.startDate, document.endDate).map((date) => ({ employeeId: document.employeeId, date }));
          await reservations.insertMany(reservationDocuments, { session, ordered: true });
          const result = await collection.insertOne(document, { session });
          insertedId = result.insertedId;
        });
      } finally {
        await session.endSession();
      }
      return { ...document, _id: insertedId };
    },
    findApplicableAssignments(employeeIds, fromDate, toDate) { validateRange(fromDate, toDate); const ids = employeeIds.map((id) => BaseRepository.objectId(id)); if (!ids.length) return Promise.resolve([]); return collection.find({ employeeId: { $in: ids }, startDate: { $lte: toDate }, endDate: { $gte: fromDate } }).sort({ employeeId: 1, startDate: 1, _id: 1 }).toArray(); },
    async hasAssignmentConflict(employeeId, startDate, endDate) { validateRange(startDate, endDate); return Boolean(await reservations.findOne({ employeeId: BaseRepository.objectId(employeeId), date: { $in: coveredDates(startDate, endDate) } })); },
  };
}
let configuredRepository;
function configureShiftAssignmentRepository(db) { configuredRepository = repository(db); return configuredRepository; }
function active() { if (!configuredRepository) throw new Error('Shift assignment repository is not configured'); return configuredRepository; }
module.exports = { configureShiftAssignmentRepository, createShiftAssignment: (input) => active().createShiftAssignment(input), findApplicableAssignments: (ids, from, to) => active().findApplicableAssignments(ids, from, to), hasAssignmentConflict: (employeeId, start, end) => active().hasAssignmentConflict(employeeId, start, end), repository, validDate, validateRange, coveredDates };
