const { ObjectId } = require('mongodb');
const { ValidationError } = require('../errors');
class BaseRepository {
  constructor(db, name) { this.collection = db.collection(name); }
  static objectId(value) { if (!ObjectId.isValid(value)) throw new ValidationError('Invalid resource id'); return new ObjectId(value); }
  async findById(id) { return this.collection.findOne({ _id: BaseRepository.objectId(id) }); }
  async list(filter, { offset, limit }, sort = { createdAt: -1 }) { const [items, total] = await Promise.all([this.collection.find(filter).sort(sort).skip(offset).limit(limit).toArray(), this.collection.countDocuments(filter)]); return { items, total }; }
}
module.exports = { BaseRepository };
