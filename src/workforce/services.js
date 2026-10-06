const { ObjectId } = require('mongodb');
const { BaseRepository } = require('../repositories/baseRepository');
const { AuthenticationError, AuthorizationError, ConflictError, NotFoundError, ValidationError } = require('../errors');

const authEmployeeId = (auth) => {
  const id = auth?.employeeId || auth?.sub || auth?.id;
  if (!id || !ObjectId.isValid(id)) throw new AuthenticationError('Access token does not contain a valid employee identity');
  return new ObjectId(id);
};
const isHr = (auth) => auth?.role === 'HR';
const isManager = (auth) => auth?.role === 'MANAGER';
const day = (value, field) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new ValidationError(`${field} must be a valid date`);
  return date;
};

class AttendanceService {
  constructor(db) { const { AttendanceRepository } = require('./repositories'); this.attendance = new AttendanceRepository(db); }
  async checkIn(auth) {
    const employeeId = authEmployeeId(auth);
    if (await this.attendance.findOpen(employeeId)) throw new ConflictError('An open attendance record already exists');
    const now = new Date();
    const record = { employeeId, checkInAt: now, checkOutAt: null, createdAt: now, updatedAt: now };
    const result = await this.attendance.create(record);
    return { ...record, _id: result.insertedId };
  }
  async checkOut(auth) {
    const record = await this.attendance.closeOpen(authEmployeeId(auth), new Date(), new Date());
    if (!record) throw new ConflictError('No open attendance record exists');
    return record;
  }
  async list(auth, page) {
    const filter = isHr(auth) ? {} : { employeeId: authEmployeeId(auth) };
    if (!isHr(auth) && !['EMPLOYEE', 'MANAGER'].includes(auth?.role)) throw new AuthorizationError();
    return this.attendance.list(filter, page, { checkInAt: -1 });
  }
}

class LeaveService {
  constructor(db) {
    const { LeaveRequestRepository, LeaveBalanceRepository } = require('./repositories');
    this.requests = new LeaveRequestRepository(db);
    this.balances = new LeaveBalanceRepository(db);
    this.employees = db.collection('employees');
  }
  async create(auth, input) {
    const employeeId = authEmployeeId(auth);
    const startDate = day(input.startDate, 'startDate');
    const endDate = day(input.endDate, 'endDate');
    if (endDate < startDate) throw new ValidationError('endDate must be on or after startDate');
    const now = new Date();
    const request = { employeeId, startDate, endDate, reason: input.reason, status: 'PENDING', reviewedBy: null, reviewedAt: null, createdAt: now, updatedAt: now };
    const result = await this.requests.create(request);
    return { ...request, _id: result.insertedId };
  }
  async list(auth, page) {
    let filter;
    const employeeId = authEmployeeId(auth);
    if (isHr(auth)) filter = {};
    else if (auth?.role === 'EMPLOYEE') filter = { employeeId };
    else if (isManager(auth)) {
      const subordinateIds = await this.employees.find({ managerId: employeeId }, { projection: { _id: 1 } }).toArray();
      filter = { employeeId: { $in: [employeeId, ...subordinateIds.map((employee) => employee._id)] } };
    } else throw new AuthorizationError();
    return this.requests.list(filter, page, { createdAt: -1 });
  }
  async review(auth, requestId, status) {
    if (!isManager(auth)) throw new AuthorizationError('Only a direct manager may review leave requests');
    const managerId = authEmployeeId(auth);
    const request = await this.requests.findById(requestId);
    if (!request) throw new NotFoundError('Leave request not found');
    const employee = await this.employees.findOne({ _id: request.employeeId }, { projection: { managerId: 1 } });
    if (!employee || !employee.managerId || !employee.managerId.equals(managerId)) throw new AuthorizationError('Only the requestor’s direct manager may review this leave request');
    const now = new Date();
    const updated = await this.requests.transitionPending(requestId, { status, reviewedBy: managerId, reviewedAt: now, updatedAt: now });
    if (!updated) throw new ConflictError('Only pending leave requests can be reviewed');
    return updated;
  }
  async upsertBalance(auth, employeeIdString, pathYear, input) {
    if (!isHr(auth)) throw new AuthorizationError('Only HR may update leave balances');
    const employeeId = BaseRepository.objectId(employeeIdString);
    if (pathYear !== input.year) throw new ValidationError('Path year must match body year');
    if (!await this.employees.findOne({ _id: employeeId }, { projection: { _id: 1 } })) throw new NotFoundError('Employee not found');
    if (input.usedDays > input.allocatedDays) throw new ValidationError('usedDays cannot exceed allocatedDays');
    const now = new Date();
    return this.balances.upsert(employeeId, input.year, { allocatedDays: input.allocatedDays, usedDays: input.usedDays, updatedAt: now });
  }
}

module.exports = { AttendanceService, LeaveService, authEmployeeId };
