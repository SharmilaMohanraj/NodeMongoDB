const serialize = (document, hidden = []) => { if (!document) return null; const copy = { ...document, id: document._id.toString() }; delete copy._id; hidden.forEach((key) => delete copy[key]); for (const key of Object.keys(copy)) if (copy[key] && typeof copy[key].toHexString === 'function') copy[key] = copy[key].toHexString(); return copy; };
const employeeDto = (document) => serialize(document, ['passwordHash']);
module.exports = { serialize, employeeDto };
