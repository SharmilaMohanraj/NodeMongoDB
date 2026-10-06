const { ObjectId } = require('mongodb');
const { NotFoundError, ValidationError } = require('../errors');

const ensureChronological = (record) => {
  const { periodStart, periodEnd } = record;
  if (periodStart === undefined || periodEnd === undefined) return;
  const start = periodStart instanceof Date ? periodStart : new Date(`${periodStart}T00:00:00.000Z`);
  const end = periodEnd instanceof Date ? periodEnd : new Date(`${periodEnd}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    throw new ValidationError('periodEnd must be on or after periodStart');
  }
};
class PayrollService {
  constructor(repository, employees) { this.repository = repository; this.employees = employees; }
  async employeeId(employeeId) {
    if (!ObjectId.isValid(employeeId)) throw new ValidationError('Invalid employee id');
    const id = new ObjectId(employeeId);
    if (!await this.employees.findOne({ _id: id }, { projection: { _id: 1 } })) throw new NotFoundError('Employee not found');
    return id;
  }
  async create(input) { const employeeId = await this.employeeId(input.employeeId); ensureChronological(input); const now = new Date(); return this.repository.create({ ...input, employeeId, createdAt: now, updatedAt: now }); }
  async list(page) { return this.repository.list({}, page, { periodStart: -1, createdAt: -1 }); }
  async get(id) { const item = await this.repository.findById(id); if (!item) throw new NotFoundError('Payroll record not found'); return item; }
  async update(id, changes) { const existing = await this.get(id); const employeeId = changes.employeeId ? await this.employeeId(changes.employeeId) : undefined; ensureChronological({ ...existing, ...changes }); const item = await this.repository.update(id, { ...changes, ...(employeeId ? { employeeId } : {}), updatedAt: new Date() }); if (!item) throw new NotFoundError('Payroll record not found'); return item; }
  async remove(id) { if (!await this.repository.remove(id)) throw new NotFoundError('Payroll record not found'); }
}
module.exports = { PayrollService };
