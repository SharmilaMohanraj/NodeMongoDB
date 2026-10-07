const express = require('express');
const { z } = require('zod');
const { authenticate, authorize, validate, paginationSchema } = require('../middleware');
const { createShiftSchedulingController } = require('../controllers/shiftSchedulingController');
const { createShiftSchedulingService } = require('../services/shiftScheduling');

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD');
const id = z.string().regex(/^[a-fA-F0-9]{24}$/, 'Must be a valid id');
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Must be HH:mm');
const templateSchema = z.object({ name: z.string().trim().min(1).max(160), startTime: time, endTime: time, applicableDays: z.array(z.number().int().min(0).max(6)).min(1).refine((days) => new Set(days).size === days.length, 'applicableDays must be unique') }).strict();
const assignmentSchema = z.object({ employeeId: id, shiftTemplateId: id, startDate: date, endDate: date }).strict().refine((input) => input.startDate <= input.endDate, { message: 'endDate must be on or after startDate', path: ['endDate'] });
const teamQuerySchema = z.object({ from: date, to: date, ...paginationSchema.shape }).strict().refine((input) => input.from <= input.to, { message: 'to must be on or after from', path: ['to'] });
const monthQuerySchema = z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Must be YYYY-MM'), ...paginationSchema.shape }).strict();
const attendanceIdSchema = z.object({ attendanceId: id }).strict();
const emptySchema = z.object({}).strict();

function createShiftSchedulingRouter({ db, config, service } = {}) {
  const router = express.Router();
  const controller = createShiftSchedulingController(service || createShiftSchedulingService({ db }));
  const authenticated = authenticate(config);
  router.post('/shift-templates', authenticated, authorize('HR'), validate(templateSchema), controller.createShiftTemplate);
  router.get('/shift-templates', authenticated, authorize('HR'), validate(paginationSchema, 'query'), controller.listShiftTemplates);
  router.post('/shift-assignments', authenticated, authorize('HR'), validate(assignmentSchema), controller.createShiftAssignment);
  router.get('/shifts/me', authenticated, authorize('EMPLOYEE'), validate(paginationSchema, 'query'), controller.getMyUpcomingSchedule);
  router.get('/shifts/team', authenticated, authorize('MANAGER'), validate(teamQuerySchema, 'query'), controller.getTeamSchedule);
  router.post('/attendance/check-in', authenticated, authorize('EMPLOYEE'), validate(emptySchema), controller.checkIn);
  router.patch('/attendance/check-out', authenticated, authorize('EMPLOYEE'), validate(emptySchema), controller.checkOut);
  router.patch('/attendance/:attendanceId/unscheduled', authenticated, authorize('MANAGER'), validate(attendanceIdSchema, 'params'), controller.flagUnscheduledAttendance);
  router.get('/overtime-reports/monthly', authenticated, authorize('HR'), validate(monthQuerySchema, 'query'), controller.getMonthlyOvertimeReport);
  return router;
}
module.exports = { createShiftSchedulingRouter };
