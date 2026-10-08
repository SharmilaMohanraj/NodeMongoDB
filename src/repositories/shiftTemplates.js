const { ObjectId } = require('mongodb');
const { ConflictError, ValidationError } = require('../errors');
const { isValidTime, isValidWeekday } = require('../utils/scheduleTime');

const COLLECTION = 'shift_templates';
const DUPLICATE_KEY = 11000;

/** Data access for shift templates (reusable shift timings + weekday applicability). */
class ShiftTemplatesRepository {
  constructor(db) { this.collection = db.collection(COLLECTION); }

  /** Creates the unique-name index. Idempotent; call once at start-up. */
  ensureIndexes() { return this.collection.createIndex({ name: 1 }, { unique: true, name: 'uniq_shift_template_name' }); }

  static normalize(input) {
    const name = typeof input?.name === 'string' ? input.name.trim() : '';
    if (!name) throw new ValidationError('Shift template name is required');
    if (!isValidTime(input.startTime)) throw new ValidationError('startTime must be a 24-hour HH:mm time');
    if (!isValidTime(input.endTime)) throw new ValidationError('endTime must be a 24-hour HH:mm time');
    const days = input.applicableDays;
    if (!Array.isArray(days) || days.length === 0 || !days.every(isValidWeekday)) throw new ValidationError('applicableDays must be a non-empty array of integers 0-6');
    return { name, startTime: input.startTime, endTime: input.endTime, applicableDays: [...new Set(days)].sort((a, b) => a - b) };
  }

  async createShiftTemplate(input) {
    const document = { ...ShiftTemplatesRepository.normalize(input), createdAt: new Date() };
    try {
      const result = await this.collection.insertOne(document);
      return { ...document, _id: result.insertedId };
    } catch (error) {
      if (error?.code === DUPLICATE_KEY) throw new ConflictError(`A shift template named "${document.name}" already exists`, { cause: error });
      throw error;
    }
  }

  async findShiftTemplateById(id) {
    if (!ObjectId.isValid(id)) return null;
    return this.collection.findOne({ _id: new ObjectId(id) });
  }

  /** Batch lookup used when expanding assignments into concrete shifts. */
  async findShiftTemplatesByIds(ids) {
    const valid = [...new Set(ids.map(String))].filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
    if (valid.length === 0) return [];
    return this.collection.find({ _id: { $in: valid } }).toArray();
  }

  async listShiftTemplates({ offset, limit }) {
    const [items, total] = await Promise.all([
      this.collection.find({}).sort({ createdAt: 1, _id: 1 }).skip(offset).limit(limit).toArray(),
      this.collection.countDocuments({})
    ]);
    return { items, offset, limit, total };
  }
}

const createShiftTemplatesRepository = (db) => new ShiftTemplatesRepository(db);
module.exports = { ShiftTemplatesRepository, createShiftTemplatesRepository };
