const express = require('express');
const { z } = require('zod');
const { validate, authorize, paginationSchema } = require('../middleware');
const { reviewCycleController } = require('../controllers/reviewCycleController');

const cycleFields = { name: z.string().trim().min(1).max(160), description: z.string().max(2000).optional(), startDate: z.coerce.date(), endDate: z.coerce.date(), status: z.string().min(1).max(40).optional() };
const createSchema = z.object(cycleFields).strict();
const patchSchema = z.object(cycleFields).partial().strict().refine((value) => Object.keys(value).length > 0, 'At least one field is required');
function createReviewCycleRouter(service) {
  const router = express.Router(); const controller = reviewCycleController(service); const hr = authorize('HR');
  router.get('/', validate(paginationSchema, 'query'), controller.list);
  router.get('/:id', controller.get);
  router.post('/', hr, validate(createSchema), controller.create);
  router.patch('/:id', hr, validate(patchSchema), controller.update);
  router.delete('/:id', hr, controller.remove);
  return router;
}
module.exports = { createReviewCycleRouter, createSchema, patchSchema };
