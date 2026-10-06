const dotenv = require('dotenv');
dotenv.config();
const required = (name) => { const value = process.env[name]; if (!value) throw new Error(`Missing required configuration: ${name}`); return value; };
const loadConfig = ({ validate = true } = {}) => ({
  port: Number(process.env.PORT || 8000),
  mongoUri: validate ? required('MONGODB_URI') : process.env.MONGODB_URI,
  mongoDbName: process.env.MONGODB_DB || 'hrdb',
  jwtSecret: validate ? required('JWT_SECRET') : process.env.JWT_SECRET,
  jwtExpiresIn: '30m',
  logLevel: process.env.LOG_LEVEL || 'info'
});
module.exports = { loadConfig };
