const pino = require('pino');
const { loadConfig } = require('./config'); const { connectDb, closeDb } = require('./db'); const { createApp } = require('./app');
async function start() { const config = loadConfig(); const logger = pino({ level: config.logLevel }); const db = await connectDb(config); const app = createApp({ db, config, logger }); const server = app.listen(config.port, '0.0.0.0', () => logger.info({ port: config.port }, 'API listening')); const shutdown = async () => { server.close(async () => { await closeDb(); process.exit(0); }); }; process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown); }
start().catch((error) => { pino().error({ err: error }, 'Startup failed'); process.exit(1); });
