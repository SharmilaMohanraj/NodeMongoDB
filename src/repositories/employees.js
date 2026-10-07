const { BaseRepository } = require('./baseRepository');

const dto = (employee) => employee && ({ id: employee._id.toString(), role: employee.role, managerId: employee.managerId ? employee.managerId.toString() : null });
function repository(db) {
  const collection = db.collection('employees');
  return {
    async findEmployeeById(employeeId) { return dto(await collection.findOne({ _id: BaseRepository.objectId(employeeId) })); },
    async employeeExists(employeeId) { return Boolean(await collection.findOne({ _id: BaseRepository.objectId(employeeId) }, { projection: { _id: 1 } })); },
    async listManagedEmployeeIds(managerId) { return (await collection.find({ managerId: BaseRepository.objectId(managerId) }, { projection: { _id: 1 } }).toArray()).map((employee) => employee._id.toString()); },
  };
}
let configuredRepository;
function configureEmployeesRepository(db) { configuredRepository = repository(db); return configuredRepository; }
function active() { if (!configuredRepository) throw new Error('Employees repository is not configured'); return configuredRepository; }
module.exports = { configureEmployeesRepository, findEmployeeById: (id) => active().findEmployeeById(id), employeeExists: (id) => active().employeeExists(id), listManagedEmployeeIds: (id) => active().listManagedEmployeeIds(id), repository };
