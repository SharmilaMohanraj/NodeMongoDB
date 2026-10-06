const { BaseRepository } = require('./baseRepository');

class PayrollRepository extends BaseRepository {
  constructor(db) { super(db, 'payroll_records'); }
  async create(record) { const result = await this.collection.insertOne(record); return this.collection.findOne({ _id: result.insertedId }); }
  async update(id, changes) { await this.collection.updateOne({ _id: BaseRepository.objectId(id) }, { $set: changes }); return this.findById(id); }
  async remove(id) { const result = await this.collection.deleteOne({ _id: BaseRepository.objectId(id) }); return result.deletedCount === 1; }
}
module.exports = { PayrollRepository };
