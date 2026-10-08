const { MongoClient } = require('mongodb');
const { ShiftTemplatesRepository } = require('./repositories/shiftTemplates');
const { ShiftAssignmentsRepository } = require('./repositories/shiftAssignments');
const { AttendanceRecordsRepository } = require('./repositories/attendanceRecords');
let client; let db;
async function connectDb(config) { client = new MongoClient(config.mongoUri); await client.connect(); db = client.db(config.mongoDbName); await Promise.all([db.collection('employees').createIndex({ email: 1 }, { unique: true }), db.collection('leave_balances').createIndex({ employeeId: 1, year: 1 }, { unique: true }), new ShiftTemplatesRepository(db).ensureIndexes(), new ShiftAssignmentsRepository(db).ensureIndexes(), new AttendanceRecordsRepository(db).ensureIndexes()]); return db; }
function getDb() { if (!db) throw new Error('Database is not connected'); return db; }
function collection(name) { return getDb().collection(name); }
async function closeDb() { if (client) await client.close(); client = undefined; db = undefined; }
module.exports = { connectDb, getDb, collection, closeDb };
