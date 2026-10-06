const express = require('express');
const { validate, authorize, paginationSchema } = require('../middleware');
const { reportController } = require('../controllers/reportController');
function createReportRouter(service) {
  const router = express.Router(); const controller = reportController(service); const hr = authorize('HR');
  router.get('/attendance', hr, validate(paginationSchema, 'query'), controller.attendance);
  router.get('/leave-balances', hr, validate(paginationSchema, 'query'), controller.leaveBalances);
  return router;
}
module.exports = { createReportRouter };
