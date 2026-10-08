const { z } = require('zod');
const { AuthenticationError, AuthorizationError, ValidationError } = require('../errors');
const { paginationSchema } = require('../middleware');
const { isValidDate, isValidMonth, isValidTime, isValidWeekday } = require('../utils/scheduleTime');
const { shiftTemplateDto, shiftAssignmentDto, attendanceRecordDto, shiftRowDto, overtimeRowDto, pageDto } = require('../dtos/shiftSchedulingDto');

// Role names as stored on the existing employee documents (and carried in the JWT).
const ROLES = Object.freeze({ HR: 'HR', MANAGER: 'MANAGER', EMPLOYEE: 'EMPLOYEE' });

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, 'Must be a 24-character hex id');
const calendarDate = z.string().refine(isValidDate, 'Must be a valid YYYY-MM-DD date');
const templateBody = z.object({
  name: z.string().trim().min(1, 'name is required').max(100),
  startTime: z.string().refine(isValidTime, 'startTime must be HH:mm (24-hour)'),
  endTime: z.string().refine(isValidTime, 'endTime must be HH:mm (24-hour)'),
  applicableDays: z.array(z.number().refine(isValidWeekday, 'Weekdays must be integers 0-6')).min(1, 'applicableDays must not be empty')
}).strict();
const assignmentBody = z.object({ employeeId: objectId, shiftTemplateId: objectId, startDate: calendarDate, endDate: calendarDate }).strict()
  .refine((value) => value.startDate <= value.endDate, { message: 'startDate must be on or before endDate', path: ['endDate'] });
const teamQuery = paginationSchema.extend({ from: calendarDate, to: calendarDate });
const reportQuery = paginationSchema.extend({ month: z.string().refine(isValidMonth, 'month must be a valid YYYY-MM value') });
const attendanceParams = z.object({ attendanceId: objectId });

/** Validates `data` and returns the parsed value, translating zod failures into the domain ValidationError. */
const parse = (schema, data) => {
  const result = schema.safeParse(data ?? {});
  if (!result.success) throw new ValidationError(result.error.issues.map((issue) => (issue.path.length ? `${issue.path.join('.')}: ` : '') + issue.message).join('; '));
  return result.data;
};

/** Returns the authenticated caller's id after verifying they hold one of the permitted roles. */
const requireRole = (req, ...roles) => {
  const { employeeId, role } = req.auth || {};
  if (!employeeId) throw new AuthenticationError('Authentication required');
  if (!roles.includes(role)) throw new AuthorizationError();
  return employeeId;
};

/**
 * HTTP adapter for shift scheduling: authenticates the caller's role, parses and validates input,
 * delegates to the injected service and maps results to DTOs. Domain errors propagate to the
 * centralized Express error handler (Express 5 forwards rejected async handlers automatically).
 */
const createShiftSchedulingController = (service) => ({
  createShiftTemplate: async (req, res) => {
    requireRole(req, ROLES.HR);
    res.status(201).json(shiftTemplateDto(await service.createTemplate(parse(templateBody, req.body))));
  },
  listShiftTemplates: async (req, res) => {
    requireRole(req, ROLES.HR);
    res.json(pageDto(await service.listTemplates(parse(paginationSchema, req.query)), shiftTemplateDto));
  },
  createShiftAssignment: async (req, res) => {
    const hrUserId = requireRole(req, ROLES.HR);
    res.status(201).json(shiftAssignmentDto(await service.assignShift(hrUserId, parse(assignmentBody, req.body))));
  },
  getMyUpcomingSchedule: async (req, res) => {
    const employeeId = requireRole(req, ROLES.EMPLOYEE);
    res.json(pageDto(await service.getUpcomingSchedule(employeeId, parse(paginationSchema, req.query)), shiftRowDto));
  },
  getTeamSchedule: async (req, res) => {
    const managerId = requireRole(req, ROLES.MANAGER);
    const { from, to, offset, limit } = parse(teamQuery, req.query);
    res.json(pageDto(await service.getTeamSchedule(managerId, from, to, { offset, limit }), shiftRowDto));
  },
  checkIn: async (req, res) => {
    const employeeId = requireRole(req, ROLES.EMPLOYEE);
    res.status(201).json(attendanceRecordDto(await service.checkIn(employeeId, new Date())));
  },
  checkOut: async (req, res) => {
    const employeeId = requireRole(req, ROLES.EMPLOYEE);
    res.json(attendanceRecordDto(await service.checkOut(employeeId, new Date())));
  },
  flagUnscheduledAttendance: async (req, res) => {
    const managerId = requireRole(req, ROLES.MANAGER);
    const { attendanceId } = parse(attendanceParams, req.params);
    res.json(attendanceRecordDto(await service.flagUnscheduled(managerId, attendanceId)));
  },
  getMonthlyOvertimeReport: async (req, res) => {
    requireRole(req, ROLES.HR);
    const { month, offset, limit } = parse(reportQuery, req.query);
    res.json(pageDto(await service.getMonthlyOvertimeReport(month, { offset, limit }), overtimeRowDto));
  }
});

module.exports = { createShiftSchedulingController, ROLES };
