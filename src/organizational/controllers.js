const { employeeDto, serialize } = require('../dto');
const { AuthorizationError } = require('../errors');

const actorId = (req) => req.auth && (req.auth.employeeId || req.auth.id || req.auth.sub);
class EmployeeController {
  constructor(service) { this.service = service; }
  create = async (req, res) => res.status(201).json({ data: employeeDto(await this.service.create(req.body)) });
  list = async (req, res) => { const result = await this.service.list(req.query); res.json({ items: result.items.map(employeeDto), total: result.total, limit: req.query.limit, offset: req.query.offset }); };
  get = async (req, res) => {
    if (req.auth.role !== 'HR' && actorId(req) !== req.params.id) throw new AuthorizationError('You may only view your own employee record');
    res.json({ data: employeeDto(await this.service.get(req.params.id)) });
  };
  update = async (req, res) => res.json({ data: employeeDto(await this.service.update(req.params.id, req.body)) });
  subordinates = async (req, res) => { const result = await this.service.subordinates(actorId(req), req.query); res.json({ items: result.items.map(employeeDto), total: result.total, limit: req.query.limit, offset: req.query.offset }); };
}
class CatalogController {
  constructor(service) { this.service = service; }
  create = async (req, res) => res.status(201).json({ data: serialize(await this.service.create(req.body)) });
  list = async (req, res) => { const result = await this.service.list(req.query); res.json({ items: result.items.map((item) => serialize(item)), total: result.total, limit: req.query.limit, offset: req.query.offset }); };
  update = async (req, res) => res.json({ data: serialize(await this.service.update(req.params.id, req.body)) });
  remove = async (req, res) => { await this.service.remove(req.params.id); res.status(204).end(); };
}
module.exports = { EmployeeController, CatalogController };
