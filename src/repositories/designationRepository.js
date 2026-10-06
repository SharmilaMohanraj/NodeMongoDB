const { BaseRepository } = require('./baseRepository');

class DesignationRepository extends BaseRepository {
  constructor(db) { super(db, 'designations'); }
  async create(document) { const result = await this.collection.insertOne(document); return { ...document, _id: result.insertedId }; }
  update(id, changes) { return this.collection.findOneAndUpdate({ _id: BaseRepository.objectId(id) }, { $set: changes }, { returnDocument: 'after' }); }
  async remove(id) { return this.collection.deleteOne({ _id: BaseRepository.objectId(id) }); }
}
module.exports = { DesignationRepository };
