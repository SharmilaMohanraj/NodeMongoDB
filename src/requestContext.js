const { AsyncLocalStorage } = require('async_hooks');

const storage = new AsyncLocalStorage();

/** Express middleware that makes the request's correlation id available to every layer below it. */
const bindRequestContext = (req, res, next) => storage.run({ correlationId: req.correlationId }, next);

/**
 * Wraps a pino-compatible logger so that every line carries the current request's
 * correlation id without each layer having to pass it around explicitly.
 */
const withRequestContext = (logger) => {
  const log = (level) => (fields, message) => logger[level]({ ...fields, correlationId: storage.getStore()?.correlationId }, message);
  return { debug: log('debug'), info: log('info'), warn: log('warn'), error: log('error') };
};

module.exports = { bindRequestContext, withRequestContext };
