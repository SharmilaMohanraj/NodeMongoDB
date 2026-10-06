const { BaseRepository } = require('./baseRepository');

class EmployeeRepository extends BaseRepository {
  constructor(db) { super(db, 'employees'); }
  findByEmail(email) { return this.collection.findOne({ email }); }
  async create(document) { const result = await this.collection.insertOne(document); return { ...document, _id: result.insertedId }; }
  async update(id, changes) {
    const result = await this.collection.findOneAndUpdate(
      { _id: BaseRepository.objectId(id) }, { $set: changes }, { returnDocument: 'after' },
    );
    return result;
  }
  async directSubordinates(managerId, page) { return this.list({ managerId: BaseRepository.objectId(managerId) }, page, { lastName: 1, firstName: 1 }); }
}
module.exports = { EmployeeRepository };
