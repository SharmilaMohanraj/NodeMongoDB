const { ObjectId } = require('mongodb');

/** Read-only lookups over the existing `employees` collection. */
class EmployeesRepository {
  constructor(db) { this.collection = db.collection('employees'); }

  /** Returns the employee document, or null when the id is malformed or unknown. */
  async findEmployeeById(employeeId) {
    if (!ObjectId.isValid(employeeId)) return null;
    return this.collection.findOne({ _id: new ObjectId(employeeId) }, { projection: { passwordHash: 0 } });
  }

  async employeeExists(employeeId) {
    if (!ObjectId.isValid(employeeId)) return false;
    return (await this.collection.countDocuments({ _id: new ObjectId(employeeId) }, { limit: 1 })) > 0;
  }

  /** ObjectIds of the manager's direct reports only (no transitive descendants). */
  async listManagedEmployeeIds(managerId) {
    if (!ObjectId.isValid(managerId)) return [];
    const rows = await this.collection.find({ managerId: new ObjectId(managerId) }, { projection: { _id: 1 } }).toArray();
    return rows.map((row) => row._id);
  }
}

const createEmployeesRepository = (db) => new EmployeesRepository(db);
module.exports = { EmployeesRepository, createEmployeesRepository };
