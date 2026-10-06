const { NotFoundError, ValidationError } = require('../errors');
const chronological = (cycle) => { if (cycle.startDate && cycle.endDate && cycle.startDate > cycle.endDate) throw new ValidationError('startDate must be before or equal to endDate'); };
class ReviewCycleService {
  constructor(repository) { this.repository = repository; }
  async create(input) { chronological(input); const now = new Date(); return this.repository.create({ ...input, createdAt: now, updatedAt: now }); }
  async list(page) { return this.repository.list({}, page, { startDate: -1, createdAt: -1 }); }
  async get(id) { const item = await this.repository.findById(id); if (!item) throw new NotFoundError('Review cycle not found'); return item; }
  async update(id, changes) { const existing = await this.get(id); chronological({ ...existing, ...changes }); const item = await this.repository.update(id, { ...changes, updatedAt: new Date() }); if (!item) throw new NotFoundError('Review cycle not found'); return item; }
  async remove(id) { if (!await this.repository.remove(id)) throw new NotFoundError('Review cycle not found'); }
}
module.exports = { ReviewCycleService };
