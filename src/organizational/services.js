const bcrypt = require('bcryptjs');
const { BaseRepository } = require('../repositories/baseRepository');
const { EmployeeRepository } = require('../repositories/employeeRepository');
const { DepartmentRepository } = require('../repositories/departmentRepository');
const { DesignationRepository } = require('../repositories/designationRepository');
const { NotFoundError, ConflictError, ValidationError } = require('../errors');

const documentFromUpdate = (result) => result && (result.value === undefined ? result : result.value);

class EmployeeService {
  constructor({ db, employeeRepository, departmentRepository, designationRepository } = {}) {
    this.employees = employeeRepository || new EmployeeRepository(db);
    this.departments = departmentRepository || new DepartmentRepository(db);
    this.designations = designationRepository || new DesignationRepository(db);
  }
  async validateReferences(values, employeeId) {
    if (values.departmentId !== undefined && !await this.departments.findById(values.departmentId)) throw new ValidationError('Department does not exist');
    if (values.designationId !== undefined && !await this.designations.findById(values.designationId)) throw new ValidationError('Designation does not exist');
    if (values.managerId) {
      if (employeeId && values.managerId === employeeId) throw new ValidationError('An employee cannot be their own manager');
      const manager = await this.employees.findById(values.managerId);
      if (!manager || manager.role !== 'MANAGER') throw new ValidationError('Manager does not exist or is not a manager');
    }
  }
  async create(values) {
    await this.validateReferences(values);
    const now = new Date();
    const document = { ...values, email: values.email.toLowerCase(), passwordHash: await bcrypt.hash(values.password, 12), createdAt: now, updatedAt: now };
    delete document.password;
    for (const field of ['managerId', 'departmentId', 'designationId']) document[field] = document[field] ? BaseRepository.objectId(document[field]) : null;
    try { return await this.employees.create(document); } catch (error) { if (error && error.code === 11000) throw new ConflictError('An employee with that email already exists'); throw error; }
  }
  async update(id, values) {
    await this.employees.findById(id).then((employee) => { if (!employee) throw new NotFoundError('Employee not found'); });
    await this.validateReferences(values, id);
    const changes = { ...values, updatedAt: new Date() };
    if (changes.email) changes.email = changes.email.toLowerCase();
    if (changes.password !== undefined) { changes.passwordHash = await bcrypt.hash(changes.password, 12); delete changes.password; }
    for (const field of ['managerId', 'departmentId', 'designationId']) if (changes[field] !== undefined) changes[field] = changes[field] ? BaseRepository.objectId(changes[field]) : null;
    try {
      const employee = documentFromUpdate(await this.employees.update(id, changes));
      if (!employee) throw new NotFoundError('Employee not found');
      return employee;
    } catch (error) { if (error && error.code === 11000) throw new ConflictError('An employee with that email already exists'); throw error; }
  }
  async get(id) { const employee = await this.employees.findById(id); if (!employee) throw new NotFoundError('Employee not found'); return employee; }
  list(page) { return this.employees.list({}, page, { lastName: 1, firstName: 1 }); }
  subordinates(managerId, page) { return this.employees.directSubordinates(managerId, page); }
}

class CatalogService {
  constructor({ db, repository, Repository } = {}) { this.repository = repository || new Repository(db); }
  async create(values) { const now = new Date(); return this.repository.create({ ...values, createdAt: now, updatedAt: now }); }
  list(page) { return this.repository.list({}, page, { name: 1 }); }
  async update(id, values) { const item = documentFromUpdate(await this.repository.update(id, { ...values, updatedAt: new Date() })); if (!item) throw new NotFoundError('Resource not found'); return item; }
  async remove(id) { const result = await this.repository.remove(id); if (!result.deletedCount) throw new NotFoundError('Resource not found'); }
}
class DepartmentService extends CatalogService { constructor(options = {}) { super({ ...options, Repository: DepartmentRepository }); } }
class DesignationService extends CatalogService { constructor(options = {}) { super({ ...options, Repository: DesignationRepository }); } }
module.exports = { EmployeeService, DepartmentService, DesignationService };
