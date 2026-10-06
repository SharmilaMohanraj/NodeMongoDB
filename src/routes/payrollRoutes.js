const express = require('express');
const { z } = require('zod');
const { validate, authorize, paginationSchema } = require('../middleware');
const { payrollController } = require('../controllers/payrollController');

// Payroll periods are calendar dates, not arbitrary JavaScript-date input.  Keeping this
// strict also prevents the former payPeriod*/split-pay contract from being accepted.
const isoDate = z.string().date().transform((value) => new Date(`${value}T00:00:00.000Z`));
const payrollFields = {
  employeeId: z.string().min(1),
  periodStart: isoDate,
  periodEnd: isoDate,
  amount: z.number().finite().nonnegative(),
  status: z.string().min(1).max(40).optional(),
  paidAt: z.coerce.date().optional()
};
const chronological = (value) => value.periodStart && value.periodEnd
  ? value.periodEnd >= value.periodStart
  : true;
const createSchema = z.object(payrollFields).strict()
  .refine(chronological, { message: 'periodEnd must be on or after periodStart', path: ['periodEnd'] });
const patchSchema = z.object(payrollFields).partial().strict()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required')
  .refine(chronological, { message: 'periodEnd must be on or after periodStart', path: ['periodEnd'] });
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
