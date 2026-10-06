const { ObjectId } = require('mongodb');
const { BaseRepository } = require('./baseRepository');

class ReportRepository extends BaseRepository {
  constructor(db, name) { super(db, name); }
  async listWithEmployees(filter, page) {
    const { items, total } = await this.list(filter, page, { date: -1, createdAt: -1 });
    const ids = [...new Set(items.map((item) => item.employeeId).filter((id) => id && ObjectId.isValid(id)).map(String))];
    if (!ids.length) return { items, total };
    const employees = await this.collection.db.collection('employees').find({ _id: { $in: ids.map((id) => new ObjectId(id)) } }).toArray();
    const byId = new Map(employees.map((employee) => [String(employee._id), employee]));
    return { items: items.map((item) => ({ ...item, employee: byId.get(String(item.employeeId)) || null })), total };
  }
}
module.exports = { ReportRepository };
