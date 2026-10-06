const { BaseRepository } = require('./baseRepository');

const persistedFields = ['employeeId', 'periodStart', 'periodEnd', 'amount', 'status', 'paidAt', 'createdAt', 'updatedAt'];
const persisted = (record) => Object.fromEntries(
  persistedFields.filter((field) => record[field] !== undefined).map((field) => [field, record[field]])
);

class PayrollRepository extends BaseRepository {
  constructor(db) { super(db, 'payroll_records'); }
  // Whitelist fields here as a final persistence boundary for the canonical payroll contract.
  async create(record) { const result = await this.collection.insertOne(persisted(record)); return this.collection.findOne({ _id: result.insertedId }); }
  async update(id, changes) { await this.collection.updateOne({ _id: BaseRepository.objectId(id) }, { $set: persisted(changes) }); return this.findById(id); }
  async remove(id) { const result = await this.collection.deleteOne({ _id: BaseRepository.objectId(id) }); return result.deletedCount === 1; }
}
module.exports = { PayrollRepository };
