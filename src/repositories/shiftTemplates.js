const { BaseRepository } = require('./baseRepository');
const { ValidationError } = require('../errors');

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const validTime = (value) => typeof value === 'string' && TIME.test(value);

function validateTemplate(input) {
  if (!input || typeof input.name !== 'string' || !input.name.trim()) throw new ValidationError('name is required');
  if (!validTime(input.startTime) || !validTime(input.endTime)) throw new ValidationError('startTime and endTime must be HH:mm');
  if (!Array.isArray(input.applicableDays) || input.applicableDays.length === 0 || input.applicableDays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) throw new ValidationError('applicableDays must contain weekdays from 0 through 6');
  if (new Set(input.applicableDays).size !== input.applicableDays.length) throw new ValidationError('applicableDays must contain unique values');
}

function repository(db) {
  const collection = db.collection('shift_templates');
  const ensureIndex = () => collection.createIndex({ name: 1 }, { unique: true, name: 'shift_templates_name_unique' });
  return {
    async createShiftTemplate(input) {
      validateTemplate(input);
      await ensureIndex();
      const document = { name: input.name.trim(), startTime: input.startTime, endTime: input.endTime, applicableDays: [...input.applicableDays].sort((a, b) => a - b), createdAt: input.createdAt || new Date() };
      const result = await collection.insertOne(document);
      return { ...document, _id: result.insertedId };
    },
    findShiftTemplateById: (id) => collection.findOne({ _id: BaseRepository.objectId(id) }),
    async listShiftTemplates({ offset = 0, limit = 20 } = {}) {
      const [items, total] = await Promise.all([collection.find({}).sort({ name: 1, _id: 1 }).skip(offset).limit(limit).toArray(), collection.countDocuments({})]);
      return { items, offset, limit, total };
    },
  };
}

let configuredRepository;
function configureShiftTemplateRepository(db) { configuredRepository = repository(db); return configuredRepository; }
function active() { if (!configuredRepository) throw new Error('Shift template repository is not configured'); return configuredRepository; }
module.exports = { configureShiftTemplateRepository, createShiftTemplate: (input) => active().createShiftTemplate(input), findShiftTemplateById: (id) => active().findShiftTemplateById(id), listShiftTemplates: (page) => active().listShiftTemplates(page), repository, validateTemplate, validTime };
