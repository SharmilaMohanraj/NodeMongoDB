const { serialize, employeeDto } = require('../dto');
const reportController = (service) => {
  const response = (method) => async (req, res) => {
    const result = await service[method](req.query);
    res.json({ items: result.items.map((item) => {
      const output = serialize(item);
      if (item.employee) output.employee = employeeDto(item.employee);
      return output;
    }), total: result.total, limit: req.query.limit, offset: req.query.offset });
  };
  return { attendance: response('attendance'), leaveBalances: response('leaveBalances') };
};
module.exports = { reportController };
