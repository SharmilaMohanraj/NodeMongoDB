const express = require('express');
const { authorize, validate, paginationSchema } = require('../middleware');
const { DesignationService } = require('../organizational/services');
const { CatalogController } = require('../organizational/controllers');
const { designationCreateSchema, designationUpdateSchema, idParamsSchema } = require('../organizational/schemas');

function createDesignationRouter(options = {}) {
  const suppliedService = typeof options.create === 'function' ? options : options.service;
  const router = express.Router();
  const controller = new CatalogController(suppliedService || new DesignationService({ db: options.db }));
  router.post('/', authorize('HR'), validate(designationCreateSchema), controller.create);
  router.get('/', validate(paginationSchema, 'query'), controller.list);
  router.patch('/:id', authorize('HR'), validate(idParamsSchema, 'params'), validate(designationUpdateSchema), controller.update);
  router.delete('/:id', authorize('HR'), validate(idParamsSchema, 'params'), controller.remove);
  return router;
}
module.exports = createDesignationRouter;
module.exports.createDesignationRouter = createDesignationRouter;
