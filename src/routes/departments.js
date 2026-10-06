const express = require('express');
const { authorize, validate, paginationSchema } = require('../middleware');
const { DepartmentService } = require('../organizational/services');
const { CatalogController } = require('../organizational/controllers');
const { departmentCreateSchema, departmentUpdateSchema, idParamsSchema } = require('../organizational/schemas');

function createDepartmentRouter(options = {}) {
  const suppliedService = typeof options.create === 'function' ? options : options.service;
  const router = express.Router();
  const controller = new CatalogController(suppliedService || new DepartmentService({ db: options.db }));
  router.post('/', authorize('HR'), validate(departmentCreateSchema), controller.create);
  router.get('/', validate(paginationSchema, 'query'), controller.list);
  router.patch('/:id', authorize('HR'), validate(idParamsSchema, 'params'), validate(departmentUpdateSchema), controller.update);
  router.delete('/:id', authorize('HR'), validate(idParamsSchema, 'params'), controller.remove);
  return router;
}
module.exports = createDepartmentRouter;
module.exports.createDepartmentRouter = createDepartmentRouter;
