const express = require('express');
const { z } = require('zod');
const { validate, authorize, paginationSchema } = require('../middleware');
const { payrollController } = require('../controllers/payrollController');

const payrollFields = {
  employeeId: z.string().min(1), payPeriodStart: z.coerce.date(), payPeriodEnd: z.coerce.date(),
  grossPay: z.coerce.number().nonnegative().optional(), deductions: z.coerce.number().nonnegative().optional(),
  netPay: z.coerce.number().nonnegative().optional(), status: z.string().min(1).max(40).optional(), paidAt: z.coerce.date().optional()
};
const createSchema = z.object(payrollFields).strict();
const patchSchema = z.object(payrollFields).partial().strict().refine((value) => Object.keys(value).length > 0, 'At least one field is required');
function createPayrollRouter(service) {
  const router = express.Router(); const controller = payrollController(service); const hr = authorize('HR');
  router.post('/', hr, validate(createSchema), controller.create);
  router.get('/', hr, validate(paginationSchema, 'query'), controller.list);
  router.get('/:id', hr, controller.get);
  router.patch('/:id', hr, validate(patchSchema), controller.update);
  router.delete('/:id', hr, controller.remove);
  return router;
}
module.exports = { createPayrollRouter, createSchema, patchSchema };
