class ReportService {
  constructor(attendanceRepository, leaveBalanceRepository) { this.attendanceRepository = attendanceRepository; this.leaveBalanceRepository = leaveBalanceRepository; }
  attendance(page) { return this.attendanceRepository.listWithEmployees({}, page); }
  leaveBalances(page) { return this.leaveBalanceRepository.listWithEmployees({}, page); }
}
module.exports = { ReportService };
