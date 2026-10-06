const { serialize } = require('../dto');

const page = (result, pagination) => ({ items: result.items.map((item) => serialize(item)), total: result.total, limit: pagination.limit, offset: pagination.offset });

const createAttendanceController = (service) => ({
  checkIn: async (req, res) => res.status(201).json({ data: serialize(await service.checkIn(req.auth)) }),
  checkOut: async (req, res) => res.json({ data: serialize(await service.checkOut(req.auth)) }),
  list: async (req, res) => res.json(page(await service.list(req.auth, req.query), req.query))
});

const createLeaveController = (service) => ({
  create: async (req, res) => res.status(201).json({ data: serialize(await service.create(req.auth, req.body)) }),
  list: async (req, res) => res.json(page(await service.list(req.auth, req.query), req.query)),
  review: async (req, res) => res.json({ data: serialize(await service.review(req.auth, req.params.id, req.body.status)) }),
  upsertBalance: async (req, res) => res.json({ data: serialize(await service.upsertBalance(req.auth, req.params.employeeId, req.params.year, req.body)) })
});

module.exports = { createAttendanceController, createLeaveController };
