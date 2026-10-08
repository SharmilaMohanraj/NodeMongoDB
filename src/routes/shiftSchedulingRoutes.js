const express = require('express');
const { authenticate } = require('../middleware');
const { bindRequestContext, withRequestContext } = require('../requestContext');
const { createShiftTemplatesRepository } = require('../repositories/shiftTemplates');
const { createShiftAssignmentsRepository } = require('../repositories/shiftAssignments');
const { createAttendanceRecordsRepository } = require('../repositories/attendanceRecords');
const { createEmployeesRepository } = require('../repositories/employees');
const { ShiftSchedulingService } = require('../services/shiftScheduling');
const { createShiftSchedulingController } = require('../controllers/shiftSchedulingController');

/** Composition root for shift scheduling. Mount the returned router at /api. */
const createShiftSchedulingRouter = ({ db, config, logger }) => {
  const service = new ShiftSchedulingService({
    templates: createShiftTemplatesRepository(db),
    assignments: createShiftAssignmentsRepository(db),
    attendance: createAttendanceRecordsRepository(db),
    employees: createEmployeesRepository(db),
    logger: withRequestContext(logger)
  });
  const controller = createShiftSchedulingController(service);
  // Authentication always runs before the handler; handlers then enforce their role.
  const secured = [authenticate(config), bindRequestContext];
  const router = express.Router();

  router.post('/shift-templates', ...secured, controller.createShiftTemplate);
  router.get('/shift-templates', ...secured, controller.listShiftTemplates);
  router.post('/shift-assignments', ...secured, controller.createShiftAssignment);
  router.get('/shifts/me', ...secured, controller.getMyUpcomingSchedule);
  router.get('/shifts/team', ...secured, controller.getTeamSchedule);
  router.post('/attendance/check-in', ...secured, controller.checkIn);
  router.patch('/attendance/check-out', ...secured, controller.checkOut);
  router.patch('/attendance/:attendanceId/unscheduled', ...secured, controller.flagUnscheduledAttendance);
  router.get('/overtime-reports/monthly', ...secured, controller.getMonthlyOvertimeReport);
  return router;
};

module.exports = { createShiftSchedulingRouter };
