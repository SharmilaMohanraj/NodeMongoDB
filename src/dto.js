const serialize = (document, hidden = []) => { if (!document) return null; const copy = { ...document, id: document._id.toString() }; delete copy._id; hidden.forEach((key) => delete copy[key]); for (const key of Object.keys(copy)) if (copy[key] && typeof copy[key].toHexString === 'function') copy[key] = copy[key].toHexString(); return copy; };
const employeeDto = (document) => serialize(document, ['passwordHash']);
const payrollDto = (document) => {
  const output = serialize(document);
  // Calendar payroll dates are returned as ISO date strings, rather than leaking Date
  // implementation details or any fields from the superseded split-pay schema.
  for (const field of ['periodStart', 'periodEnd']) {
    if (output[field] instanceof Date) output[field] = output[field].toISOString().slice(0, 10);
    else if (typeof output[field] === 'string' && !Number.isNaN(new Date(output[field]).getTime())) output[field] = new Date(output[field]).toISOString().slice(0, 10);
  }
  for (const legacyField of ['payPeriodStart', 'payPeriodEnd', 'grossPay', 'deductions', 'netPay']) delete output[legacyField];
  return output;
};
module.exports = { serialize, employeeDto, payrollDto };
