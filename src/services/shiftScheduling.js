const { AuthorizationError, ConflictError, NotFoundError, ValidationError } = require('../errors');
const {
  MS_PER_MINUTE, isValidDate, isValidMonth, toDateString, weekdayOf, addDays, daysBetween, maxDate, minDate, eachDate, shiftWindow, paginate
} = require('../utils/scheduleTime');

const OVERTIME_THRESHOLD_MS = 15 * MS_PER_MINUTE;
const UPCOMING_DAYS = 14;
const MAX_TEAM_RANGE_DAYS = 366;

/**
 * Business rules for shift templates, assignments, schedules, attendance and overtime.
 * Collaborators are injected so the service never touches MongoDB or HTTP directly.
 * All "today" decisions and shift times are evaluated in UTC.
 */
class ShiftSchedulingService {
  constructor({ templates, assignments, attendance, employees, logger }) {
    this.templates = templates;
    this.assignments = assignments;
    this.attendance = attendance;
    this.employees = employees;
    this.logger = logger;
  }

  async createTemplate(input) {
    const template = await this.templates.createShiftTemplate(input);
    this.logger.info({ shiftTemplateId: template._id.toString() }, 'Shift template created');
    return template;
  }

  listTemplates(page) { return this.templates.listShiftTemplates(page); }

  async assignShift(hrUserId, input) {
    if (!await this.employees.employeeExists(input.employeeId)) throw new NotFoundError('Employee not found');
    if (!await this.templates.findShiftTemplateById(input.shiftTemplateId)) throw new NotFoundError('Shift template not found');
    if (await this.assignments.hasAssignmentConflict(input.employeeId, input.startDate, input.endDate)) {
      this.logger.warn({ employeeId: input.employeeId, startDate: input.startDate, endDate: input.endDate }, 'Shift assignment conflict');
      throw new ConflictError('Employee already has a shift assignment overlapping these dates');
    }
    const assignment = await this.assignments.createShiftAssignment({ ...input, assignedBy: hrUserId });
    this.logger.info({ assignmentId: assignment._id.toString(), employeeId: input.employeeId, assignedBy: hrUserId }, 'Shift assigned');
    return assignment;
  }

  /** Shifts for today through the next 13 calendar days (14 days in total). */
  async getUpcomingSchedule(employeeId, page, now = new Date()) {
    const from = toDateString(now);
    const rows = await this.buildScheduleRows([employeeId], from, addDays(from, UPCOMING_DAYS - 1));
    return paginate(rows, page);
  }

  async getTeamSchedule(managerId, fromDate, toDate, page) {
    if (!isValidDate(fromDate) || !isValidDate(toDate)) throw new ValidationError('from and to must be valid YYYY-MM-DD dates');
    if (fromDate > toDate) throw new ValidationError('from must be on or before to');
    if (daysBetween(fromDate, toDate) >= MAX_TEAM_RANGE_DAYS) throw new ValidationError(`Date range may not exceed ${MAX_TEAM_RANGE_DAYS} days`);
    const teamIds = await this.employees.listManagedEmployeeIds(managerId);
    const rows = await this.buildScheduleRows(teamIds, fromDate, toDate);
    return paginate(rows, page);
  }

  async checkIn(employeeId, now = new Date()) {
    if (await this.attendance.findOpenAttendanceForEmployee(employeeId)) throw new ConflictError('An open attendance record already exists');
    const attendanceDate = toDateString(now);
    const shift = await this.resolveShiftForDate(employeeId, attendanceDate);
    const earlyMs = shift ? shift.window.startAt.getTime() - now.getTime() : 0;
    const earlyOvertimeMinutes = earlyMs > OVERTIME_THRESHOLD_MS ? Math.floor(earlyMs / MS_PER_MINUTE) : 0;
    const record = await this.attendance.createAttendanceRecord({
      employeeId,
      attendanceDate,
      shiftAssignmentId: shift ? shift.assignment._id : null,
      checkInAt: now,
      unscheduled: !shift,
      overtimeFlagged: earlyOvertimeMinutes > 0,
      earlyOvertimeMinutes,
      lateOvertimeMinutes: 0,
      overtimeMinutes: earlyOvertimeMinutes
    });
    this.logger.info({ attendanceId: record._id.toString(), employeeId, unscheduled: !shift, earlyOvertimeMinutes }, 'Employee checked in');
    return record;
  }

  async checkOut(employeeId, now = new Date()) {
    const open = await this.attendance.findOpenAttendanceForEmployee(employeeId);
    if (!open) throw new NotFoundError('No open attendance record found');
    const window = await this.resolveRecordedWindow(open);
    const lateMs = window ? now.getTime() - window.endAt.getTime() : 0;
    const lateOvertimeMinutes = lateMs > OVERTIME_THRESHOLD_MS ? Math.floor(lateMs / MS_PER_MINUTE) : 0;
    const overtimeMinutes = (open.earlyOvertimeMinutes || 0) + lateOvertimeMinutes;
    const closed = await this.attendance.completeAttendanceRecord(open._id.toString(), employeeId, {
      checkOutAt: now, lateOvertimeMinutes, overtimeMinutes, overtimeFlagged: overtimeMinutes > 0
    });
    if (!closed) throw new NotFoundError('No open attendance record found');
    this.logger.info({ attendanceId: closed._id.toString(), employeeId, lateOvertimeMinutes, overtimeMinutes }, 'Employee checked out');
    return closed;
  }

  async flagUnscheduled(managerId, attendanceId) {
    const record = await this.attendance.findAttendanceById(attendanceId);
    if (!record) throw new NotFoundError('Attendance record not found');
    const teamIds = (await this.employees.listManagedEmployeeIds(managerId)).map(String);
    if (!teamIds.includes(record.employeeId.toString())) {
      this.logger.warn({ managerId, attendanceId, employeeId: record.employeeId.toString() }, 'Manager attempted to flag a non-team attendance record');
      throw new AuthorizationError('Attendance record does not belong to your team');
    }
    const updated = await this.attendance.markUnscheduled(attendanceId);
    if (!updated) throw new NotFoundError('Attendance record not found');
    this.logger.info({ attendanceId, managerId }, 'Attendance record flagged unscheduled');
    return updated;
  }

  getMonthlyOvertimeReport(month, page) {
    if (!isValidMonth(month)) throw new ValidationError('month must be a valid YYYY-MM value');
    return this.attendance.aggregateMonthlyOvertime(month, page);
  }

  /** Expands the assignments of the given employees into one row per applicable shift date in [fromDate, toDate]. */
  async buildScheduleRows(employeeIds, fromDate, toDate) {
    const assignments = await this.assignments.findApplicableAssignments(employeeIds, fromDate, toDate);
    if (assignments.length === 0) return [];
    const templates = await this.templates.findShiftTemplatesByIds(assignments.map((assignment) => assignment.shiftTemplateId));
    const templatesById = new Map(templates.map((template) => [template._id.toString(), template]));
    const rows = [];
    for (const assignment of assignments) {
      const template = templatesById.get(assignment.shiftTemplateId.toString());
      if (!template) continue;
      const days = new Set(template.applicableDays);
      for (const date of eachDate(maxDate(assignment.startDate, fromDate), minDate(assignment.endDate, toDate))) {
        if (!days.has(weekdayOf(date))) continue;
        const { startAt, endAt } = shiftWindow(date, template.startTime, template.endTime);
        rows.push({
          employeeId: assignment.employeeId.toString(),
          assignmentId: assignment._id.toString(),
          templateId: template._id.toString(),
          date,
          scheduledStartAt: startAt.toISOString(),
          scheduledEndAt: endAt.toISOString()
        });
      }
    }
    return rows.sort((a, b) => a.date.localeCompare(b.date) || a.scheduledStartAt.localeCompare(b.scheduledStartAt) || a.employeeId.localeCompare(b.employeeId));
  }

  /** The assignment (and its concrete shift window) that applies to the employee on `date`, or null. */
  async resolveShiftForDate(employeeId, date) {
    const assignments = await this.assignments.findApplicableAssignments([employeeId], date, date);
    for (const assignment of assignments) {
      const template = await this.templates.findShiftTemplateById(assignment.shiftTemplateId);
      if (template && template.applicableDays.includes(weekdayOf(date))) {
        return { assignment, template, window: shiftWindow(date, template.startTime, template.endTime) };
      }
    }
    return null;
  }

  /** Shift window for an existing attendance record, based on its linked assignment; null when unscheduled. */
  async resolveRecordedWindow(record) {
    if (!record.shiftAssignmentId) return null;
    const assignment = await this.assignments.findShiftAssignmentById(record.shiftAssignmentId);
    const template = assignment && await this.templates.findShiftTemplateById(assignment.shiftTemplateId);
    return template ? shiftWindow(record.attendanceDate, template.startTime, template.endTime) : null;
  }
}

module.exports = { ShiftSchedulingService };
