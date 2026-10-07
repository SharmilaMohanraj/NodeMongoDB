const express = require('express');
const pino = require('pino');
const swaggerUi = require('swagger-ui-express');
const { correlation, authenticate, notFound, errorHandler } = require('./middleware');
const { createAuthRouter } = require('./authRoutes');
const { AuthService } = require('./auth');
const createOrganizationalRouters = require('./routes/organizational');
const { createWorkforceRouter } = require('./workforce/routes');
const { createCompensationRouter } = require('./routes/compensationRoutes');
const { createShiftSchedulingRouter } = require('./routes/shiftSchedulingRoutes');
const { spec } = require('./openapi');
function createApp({ db, config, logger = pino({ level: config.logLevel }) }) {
 const app = express(); app.disable('x-powered-by'); app.use(express.json({ limit: '64kb' })); app.use(correlation);
 app.get('/health', (req, res) => res.json({ status: 'ok' })); app.get('/openapi.json', (req, res) => res.json(spec)); app.get('/docs', swaggerUi.setup(spec)); app.use('/docs', swaggerUi.serve, swaggerUi.setup(spec));
 const api = express.Router(); api.use('/auth', createAuthRouter(new AuthService(db, config)));
 const secured = express.Router(); secured.use(authenticate(config)); const organization = createOrganizationalRouters({ db }); secured.use('/employees', organization.employees); secured.use('/departments', organization.departments); secured.use('/designations', organization.designations); api.use(secured);
 api.use(createWorkforceRouter({ db, config })); api.use(createCompensationRouter({ db, config })); app.use('/api/v1', api); app.use('/api', createShiftSchedulingRouter({ db, config })); app.use(notFound); app.use(errorHandler(logger)); return app;
}
module.exports = { createApp };
