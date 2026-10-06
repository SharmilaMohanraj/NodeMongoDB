const { BaseRepository } = require('./baseRepository');

class ReviewCycleRepository extends BaseRepository {
  constructor(db) { super(db, 'review_cycles'); }
  async create(cycle) { const result = await this.collection.insertOne(cycle); return this.collection.findOne({ _id: result.insertedId }); }
  async update(id, changes) { await this.collection.updateOne({ _id: BaseRepository.objectId(id) }, { $set: changes }); return this.findById(id); }
  async remove(id) { const result = await this.collection.deleteOne({ _id: BaseRepository.objectId(id) }); return result.deletedCount === 1; }
}
module.exports = { ReviewCycleRepository };
