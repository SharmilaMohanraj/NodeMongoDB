const express = require('express');
const { authenticate } = require('../middleware');
const { PayrollRepository } = require('../repositories/payrollRepository');
const { ReviewCycleRepository } = require('../repositories/reviewCycleRepository');
const { ReportRepository } = require('../repositories/reportRepository');
const { PayrollService } = require('../services/payrollService');
const { ReviewCycleService } = require('../services/reviewCycleService');
const { ReportService } = require('../services/reportService');
const { createPayrollRouter } = require('./payrollRoutes');
const { createReviewCycleRouter } = require('./reviewCycleRoutes');
const { createReportRouter } = require('./reportRoutes');

/** A self-contained router, mounted by the application at /api/v1. */
function createCompensationRouter({ db, config }) {
  const router = express.Router();
  const payroll = new PayrollService(new PayrollRepository(db), db.collection('employees'));
  const cycles = new ReviewCycleService(new ReviewCycleRepository(db));
  const reports = new ReportService(new ReportRepository(db, 'attendance'), new ReportRepository(db, 'leave_balances'));
  router.use(authenticate(config));
  router.use('/payroll-records', createPayrollRouter(payroll));
  router.use('/review-cycles', createReviewCycleRouter(cycles));
  router.use('/reports', createReportRouter(reports));
  return router;
}
module.exports = { createCompensationRouter };
