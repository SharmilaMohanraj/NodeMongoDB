const express = require('express');
const { authorize, validate, paginationSchema } = require('../middleware');
const { EmployeeService } = require('../organizational/services');
const { EmployeeController } = require('../organizational/controllers');
const { employeeCreateSchema, employeeUpdateSchema, idParamsSchema } = require('../organizational/schemas');

function createEmployeeRouter(options = {}) {
  // A ready-made service is accepted for tests/composition; production may inject db.
  const suppliedService = typeof options.create === 'function' ? options : options.service;
  const controller = new EmployeeController(suppliedService || new EmployeeService({ db: options.db }));
  const router = express.Router();
  router.get('/subordinates', authorize('MANAGER'), validate(paginationSchema, 'query'), controller.subordinates);
  router.post('/', authorize('HR'), validate(employeeCreateSchema), controller.create);
  router.get('/', authorize('HR'), validate(paginationSchema, 'query'), controller.list);
  router.get('/:id', validate(idParamsSchema, 'params'), controller.get);
  router.patch('/:id', authorize('HR'), validate(idParamsSchema, 'params'), validate(employeeUpdateSchema), controller.update);
  return router;
}
module.exports = createEmployeeRouter;
module.exports.createEmployeeRouter = createEmployeeRouter;
