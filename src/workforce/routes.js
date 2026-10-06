const express = require('express');
const { z } = require('zod');
const { validate, authenticate } = require('../middleware');
const { AttendanceService, LeaveService } = require('./services');
const { createAttendanceController, createLeaveController } = require('./controllers');

const emptyBody = z.object({}).strict();
const pagination = z.object({ offset: z.coerce.number().int().min(0).default(0), limit: z.coerce.number().int().min(1).max(100).default(20) }).strict();
const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid resource id');
const year = z.coerce.number().int().min(1970).max(9999);
const isoDate = z.string().refine((value) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false; const date = new Date(`${value}T00:00:00.000Z`); return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value; }, 'Must be an ISO date (YYYY-MM-DD)');
// employeeId is accepted solely for backwards-compatible clients and deliberately ignored by the service; identity always comes from the JWT.
const leaveRequestBody = z.object({ startDate: isoDate, endDate: isoDate, reason: z.string().trim().min(1).max(1000) }).strict();
const reviewBody = z.object({ status: z.enum(['APPROVED', 'REJECTED']) }).strict();
const balanceBody = z.object({ year, allocatedDays: z.coerce.number().finite().min(0).max(366), usedDays: z.coerce.number().finite().min(0).max(366) }).strict();
const balanceParams = z.object({ employeeId: objectId, year }).strict();

/** Creates workforce routers. Mount this returned router beneath /api/v1. */
const createWorkforceRouter = ({ db, config }) => {
  const router = express.Router();
  const attendance = createAttendanceController(new AttendanceService(db));
  const leave = createLeaveController(new LeaveService(db));
  const auth = authenticate(config);

  router.post('/attendance/check-in', auth, validate(emptyBody), attendance.checkIn);
  router.post('/attendance/check-out', auth, validate(emptyBody), attendance.checkOut);
  router.get('/attendance', auth, validate(pagination, 'query'), attendance.list);

  router.post('/leave-requests', auth, validate(leaveRequestBody), leave.create);
  router.get('/leave-requests', auth, validate(pagination, 'query'), leave.list);
  router.patch('/leave-requests/:id', auth, validate(z.object({ id: objectId }).strict(), 'params'), validate(reviewBody), leave.review);
  router.put('/leave-balances/:employeeId/:year', auth, validate(balanceParams, 'params'), validate(balanceBody), leave.upsertBalance);
  return router;
};

module.exports = { createWorkforceRouter, schemas: { pagination, leaveRequestBody, reviewBody, balanceBody } };
