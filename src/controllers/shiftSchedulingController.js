const { serialize } = require('../dto');

const safe = (value) => {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(safe);
  if (value instanceof Date) return value;
  if (value._id) return serialize(value);
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, item && typeof item.toHexString === 'function' ? item.toHexString() : safe(item)]));
};
const page = (result) => ({ items: result.items.map(safe), offset: result.offset, limit: result.limit, total: result.total });
const actorId = (req) => req.auth?.employeeId || req.auth?.id || req.auth?.sub;
const bind = (service, action) => (req, res, next) => action(service, req, res).catch(next);

const createShiftTemplate = async (service, req, res) => res.status(201).json({ data: safe(await service.createTemplate(req.body)) });
const listShiftTemplates = async (service, req, res) => res.json(page(await service.listTemplates(req.query)));
const createShiftAssignment = async (service, req, res) => res.status(201).json({ data: safe(await service.assignShift(actorId(req), req.body)) });
const getMyUpcomingSchedule = async (service, req, res) => res.json(page(await service.getUpcomingSchedule(actorId(req), req.query)));
const getTeamSchedule = async (service, req, res) => res.json(page(await service.getTeamSchedule(actorId(req), req.query.from, req.query.to, req.query)));
const checkIn = async (service, req, res) => res.status(201).json({ data: safe(await service.checkIn(actorId(req), new Date())) });
const checkOut = async (service, req, res) => res.json({ data: safe(await service.checkOut(actorId(req), new Date())) });
const flagUnscheduledAttendance = async (service, req, res) => res.json({ data: safe(await service.flagUnscheduled(actorId(req), req.params.attendanceId)) });
const getMonthlyOvertimeReport = async (service, req, res) => res.json(page(await service.getMonthlyOvertimeReport(req.query.month, req.query)));

function createShiftSchedulingController(service) {
  return {
    createShiftTemplate: bind(service, createShiftTemplate), listShiftTemplates: bind(service, listShiftTemplates), createShiftAssignment: bind(service, createShiftAssignment), getMyUpcomingSchedule: bind(service, getMyUpcomingSchedule), getTeamSchedule: bind(service, getTeamSchedule), checkIn: bind(service, checkIn), checkOut: bind(service, checkOut), flagUnscheduledAttendance: bind(service, flagUnscheduledAttendance), getMonthlyOvertimeReport: bind(service, getMonthlyOvertimeReport),
  };
}
module.exports = { createShiftSchedulingController, createShiftTemplate, listShiftTemplates, createShiftAssignment, getMyUpcomingSchedule, getTeamSchedule, checkIn, checkOut, flagUnscheduledAttendance, getMonthlyOvertimeReport };
