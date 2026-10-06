const createEmployeeRouter = require('./employees');
const createDepartmentRouter = require('./departments');
const createDesignationRouter = require('./designations');

// The caller mounts these routers below /api/v1 (for example, at /employees).
function createOrganizationalRouters(dependencies = {}) {
  return {
    employees: createEmployeeRouter(dependencies),
    departments: createDepartmentRouter(dependencies),
    designations: createDesignationRouter(dependencies),
  };
}
module.exports = createOrganizationalRouters;
module.exports.createOrganizationalRouters = createOrganizationalRouters;
