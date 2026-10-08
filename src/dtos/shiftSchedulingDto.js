/** API representations of shift-scheduling documents. Persistence documents never leave the service boundary. */
const iso = (value) => (value instanceof Date ? value.toISOString() : value ?? null);
const text = (value) => (value == null ? null : value.toString());

const shiftTemplateDto = (doc) => ({
  id: text(doc._id), name: doc.name, startTime: doc.startTime, endTime: doc.endTime, applicableDays: doc.applicableDays, createdAt: iso(doc.createdAt)
});

const shiftAssignmentDto = (doc) => ({
  id: text(doc._id), employeeId: text(doc.employeeId), shiftTemplateId: text(doc.shiftTemplateId),
  startDate: doc.startDate, endDate: doc.endDate, assignedBy: text(doc.assignedBy), createdAt: iso(doc.createdAt)
});

const attendanceRecordDto = (doc) => ({
  id: text(doc._id), employeeId: text(doc.employeeId), attendanceDate: doc.attendanceDate, shiftAssignmentId: text(doc.shiftAssignmentId),
  checkInAt: iso(doc.checkInAt), checkOutAt: iso(doc.checkOutAt), unscheduled: doc.unscheduled, overtimeFlagged: doc.overtimeFlagged,
  earlyOvertimeMinutes: doc.earlyOvertimeMinutes, lateOvertimeMinutes: doc.lateOvertimeMinutes, overtimeMinutes: doc.overtimeMinutes
});

const shiftRowDto = (row) => ({
  employeeId: row.employeeId, assignmentId: row.assignmentId, templateId: row.templateId, date: row.date,
  scheduledStartAt: row.scheduledStartAt, scheduledEndAt: row.scheduledEndAt
});

const overtimeRowDto = (row) => ({ employeeId: row.employeeId, overtimeMinutes: row.overtimeMinutes, overtimeHours: row.overtimeHours });

const pageDto = (result, mapItem) => ({ items: result.items.map(mapItem), total: result.total, offset: result.offset, limit: result.limit });

module.exports = { shiftTemplateDto, shiftAssignmentDto, attendanceRecordDto, shiftRowDto, overtimeRowDto, pageDto };
