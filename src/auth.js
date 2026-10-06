const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { AuthenticationError } = require('./errors');
const { employeeDto } = require('./dto');
class AuthService {
  constructor(db, config) { this.employees = db.collection('employees'); this.config = config; }
  async login({ email, password }) {
    const employee = await this.employees.findOne({ email: email.toLowerCase() });
    if (!employee || !await bcrypt.compare(password, employee.passwordHash)) throw new AuthenticationError('Invalid email or password');
    const token = jwt.sign({ employeeId: employee._id.toString(), role: employee.role }, this.config.jwtSecret, { expiresIn: this.config.jwtExpiresIn });
    return { accessToken: token, tokenType: 'Bearer', expiresIn: 1800, employee: employeeDto(employee) };
  }
}
module.exports = { AuthService };
