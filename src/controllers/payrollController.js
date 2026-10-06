const { serialize } = require('../dto');
const payrollController = (service) => ({
  create: async (req, res) => res.status(201).json({ data: serialize(await service.create(req.body)) }),
  list: async (req, res) => { const result = await service.list(req.query); res.json({ items: result.items.map(serialize), total: result.total, limit: req.query.limit, offset: req.query.offset }); },
  get: async (req, res) => res.json({ data: serialize(await service.get(req.params.id)) }),
  update: async (req, res) => res.json({ data: serialize(await service.update(req.params.id, req.body)) }),
  remove: async (req, res) => { await service.remove(req.params.id); res.json({ data: { id: req.params.id } }); }
});
module.exports = { payrollController };
