const { ConflictError, NotFoundError, ValidationError, AuthorizationError } = require('../errors');
const templateModule = require('../repositories/shiftTemplates');
const assignmentModule = require('../repositories/shiftAssignments');
const attendanceModule = require('../repositories/attendanceRecords');
const employeeModule = require('../repositories/employees');

const DAY_MS = 24 * 60 * 60 * 1000;
const dateString = (value) => new Date(value).toISOString().slice(0, 10);
const dateAt = (date, time) => new Date(`${date}T${time}:00.000Z`);
const addDays = (date, days) => new Date(Date.parse(`${date}T00:00:00.000Z`) + days * DAY_MS).toISOString().slice(0, 10);
const weekday = (date) => new Date(`${date}T00:00:00.000Z`).getUTCDay();
const idString = (value) => value?.toString();
const isDuplicateKey = (error) => {
  const seen = new Set();
  const visit = (candidate) => {
    if (!candidate || typeof candidate !== 'object' || seen.has(candidate)) return false;
    seen.add(candidate);
    if (candidate.code === 11000 || candidate.codeName === 'DuplicateKey') return true;
    if (visit(candidate.cause)) return true;
    return Array.isArray(candidate.errors) && candidate.errors.some(visit);
  };
  return visit(error);
};

function createShiftSchedulingService({ db, templates = templateModule.repository(db), assignments = assignmentModule.repository(db), attendance = attendanceModule.repository(db), employees = employeeModule.repository(db) } = {}) {
  const scheduled = (assignment, template, date) => {
    const scheduledStartAt = dateAt(date, template.startTime);
    const overnight = template.endTime <= template.startTime;
    const scheduledEndAt = dateAt(addDays(date, overnight ? 1 : 0), template.endTime);
    return { employeeId: idString(assignment.employeeId), assignmentId: idString(assignment._id), templateId: idString(template._id), date, scheduledStartAt, scheduledEndAt };
  };
  const materialize = async (employeeIds, fromDate, toDate) => {
    const assignmentsFound = await assignments.findApplicableAssignments(employeeIds, fromDate, toDate);
    const rows = [];
    for (const assignment of assignmentsFound) {
      const template = await templates.findShiftTemplateById(assignment.shiftTemplateId.toString());
      if (!template) continue;
      const start = assignment.startDate > fromDate ? assignment.startDate : fromDate;
      const end = assignment.endDate < toDate ? assignment.endDate : toDate;
      for (let date = start; date <= end; date = addDays(date, 1)) if (template.applicableDays.includes(weekday(date))) rows.push(scheduled(assignment, template, date));
    }
    return rows.sort((left, right) => left.date.localeCompare(right.date) || left.scheduledStartAt - right.scheduledStartAt || left.employeeId.localeCompare(right.employeeId));
  };
  const paginate = (items, { offset = 0, limit = 20 }) => ({ items: items.slice(offset, offset + limit), offset, limit, total: items.length });
  return {
    async createTemplate(input) { try { return await templates.createShiftTemplate(input); } catch (error) { if (error?.code === 11000) throw new ConflictError('A shift template with that name already exists', { cause: error }); throw error; } },
    listTemplates: (page) => templates.listShiftTemplates(page),
    async assignShift(hrUserId, input) { assignmentModule.validateRange(input.startDate, input.endDate); if (!await employees.employeeExists(input.employeeId)) throw new NotFoundError('Employee not found'); if (!await templates.findShiftTemplateById(input.shiftTemplateId)) throw new NotFoundError('Shift template not found'); try { return await assignments.createShiftAssignment({ ...input, assignedBy: hrUserId }); } catch (error) { if (isDuplicateKey(error)) throw new ConflictError('Assignment range overlaps an existing assignment', { cause: error }); throw error; } },
    async getUpcomingSchedule(employeeId, page) { const today = dateString(new Date()); return paginate(await materialize([employeeId], today, addDays(today, 13)), page); },
    async getTeamSchedule(managerId, fromDate, toDate, page) { assignmentModule.validateRange(fromDate, toDate); return paginate(await materialize(await employees.listManagedEmployeeIds(managerId), fromDate, toDate), page); },
    async checkIn(employeeId, now = new Date()) { const open = await attendance.findOpenAttendanceForEmployee(employeeId); if (open) throw new ConflictError('An open attendance record already exists'); const date = dateString(now); const shifts = await materialize([employeeId], date, date); const shift = shifts[0]; let earlyOvertimeMinutes = 0; if (shift) { const boundary = shift.scheduledStartAt.getTime() - (15 * 60 * 1000); if (now.getTime() < boundary) earlyOvertimeMinutes = Math.floor((shift.scheduledStartAt.getTime() - now.getTime()) / 60000); }
      try { return await attendance.createAttendanceRecord({ employeeId, attendanceDate: date, shiftAssignmentId: shift?.assignmentId || null, checkInAt: now, checkOutAt: null, unscheduled: !shift, overtimeFlagged: earlyOvertimeMinutes > 0, earlyOvertimeMinutes, lateOvertimeMinutes: 0, overtimeMinutes: earlyOvertimeMinutes, createdAt: now }); } catch (error) { if (error?.code === 11000) throw new ConflictError('An open attendance record already exists', { cause: error }); throw error; } },
    async checkOut(employeeId, now = new Date()) { const open = await attendance.findOpenAttendanceForEmployee(employeeId); if (!open) throw new ConflictError('No open attendance record exists'); let lateOvertimeMinutes = 0; if (open.shiftAssignmentId) { const assignmentsFound = await assignments.findApplicableAssignments([employeeId], open.attendanceDate, open.attendanceDate); const assignment = assignmentsFound.find((item) => item._id.toString() === open.shiftAssignmentId.toString()); const template = assignment && await templates.findShiftTemplateById(assignment.shiftTemplateId.toString()); if (template) { const end = dateAt(addDays(open.attendanceDate, template.endTime <= template.startTime ? 1 : 0), template.endTime); const boundary = end.getTime() + (15 * 60 * 1000); if (now.getTime() > boundary) lateOvertimeMinutes = Math.floor((now.getTime() - end.getTime()) / 60000); } }
      const overtimeMinutes = (open.earlyOvertimeMinutes || 0) + lateOvertimeMinutes; const result = await attendance.completeAttendanceRecord(open._id.toString(), employeeId, { checkOutAt: now, lateOvertimeMinutes, overtimeMinutes, overtimeFlagged: overtimeMinutes > 0 }); if (!result) throw new ConflictError('Attendance record is already closed'); return result; },
    async flagUnscheduled(managerId, attendanceId) { const record = await attendance.findById(attendanceId); if (!record) throw new NotFoundError('Attendance record not found'); const reports = await employees.listManagedEmployeeIds(managerId); if (!reports.includes(record.employeeId.toString())) throw new AuthorizationError('Attendance record does not belong to a direct team member'); return attendance.markUnscheduled(attendanceId); },
    getMonthlyOvertimeReport: (month, page) => attendance.aggregateMonthlyOvertime(month, page),
  };
}
const createTemplate = (input) => defaultService().createTemplate(input);
let singleton;
function defaultService() { if (!singleton) throw new Error('Shift scheduling service is not configured'); return singleton; }
function configureShiftSchedulingService(options) { singleton = createShiftSchedulingService(options); return singleton; }
module.exports = { createShiftSchedulingService, configureShiftSchedulingService, createTemplate, listTemplates: (page) => defaultService().listTemplates(page), assignShift: (id, input) => defaultService().assignShift(id, input), getUpcomingSchedule: (id, page) => defaultService().getUpcomingSchedule(id, page), getTeamSchedule: (id, from, to, page) => defaultService().getTeamSchedule(id, from, to, page), checkIn: (id, now) => defaultService().checkIn(id, now), checkOut: (id, now) => defaultService().checkOut(id, now), flagUnscheduled: (id, attendanceId) => defaultService().flagUnscheduled(id, attendanceId), getMonthlyOvertimeReport: (month, page) => defaultService().getMonthlyOvertimeReport(month, page) };
