/**
 * End-to-end verification of the shift-scheduling endpoints against a REAL MongoDB and a REAL booted server.
 *
 * Usage: MMS_PATH=/path/to/node_modules/mongodb-memory-server node scripts/verify-shift-scheduling.js
 *   - MONGODB_URI set  -> uses that MongoDB instead of starting a throw-away mongod via mongodb-memory-server.
 * Writes observed results to tests-artifacts/shift_scheduling_results.json and exits non-zero on any failure.
 * Everything (mongod, server) is started and stopped inside this one process.
 */
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { MongoClient, ObjectId } = require('mongodb');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.VERIFY_PORT || 3000);
const BASE = `http://127.0.0.1:${PORT}`;
const SECRET = 'verify-secret-value-1234567890';
const results = [];

const hhmm = (date) => date.toISOString().slice(11, 16);
const ymd = (date) => date.toISOString().slice(0, 10);
const plusMinutes = (date, minutes) => new Date(date.getTime() + minutes * 60000);
const plusDays = (date, days) => new Date(date.getTime() + days * 86400000);

async function call(name, method, url, { token, body, expect, check } = {}) {
  const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  const response = await fetch(`${BASE}${url}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await response.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  let ok = response.status === expect;
  let detail = `HTTP ${response.status}`;
  if (ok && check) { try { const verdict = check(json); if (verdict !== true) { ok = false; detail += ` assertion failed: ${verdict}`; } } catch (error) { ok = false; detail += ` assertion error: ${error.message}`; } }
  if (!ok && response.status !== expect) detail += ` (expected ${expect}) ${text.slice(0, 200)}`;
  results.push({ name, method, url, expected: expect, actual: response.status, status: ok ? 'PASS' : 'FAIL', detail, responseExcerpt: text.slice(0, 300) });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${method} ${url} -> ${response.status}  ${name}${ok ? '' : `  [${detail}]`}`);
  return json;
}

async function waitForHealth(attempts = 40) {
  for (let i = 0; i < attempts; i += 1) {
    try { const response = await fetch(`${BASE}/health`); if (response.status === 200) return; } catch { /* not up yet */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('Server did not become healthy');
}

async function main() {
  let memory; let uri = process.env.MONGODB_URI;
  if (!uri) {
    const { MongoMemoryServer } = require(process.env.MMS_PATH || 'mongodb-memory-server');
    memory = await MongoMemoryServer.create({ binary: { version: '7.0.14' } });
    uri = memory.getUri();
  }
  const dbName = `shift_verify_${Date.now()}`;
  const server = spawn('node', ['src/server.js'], { cwd: ROOT, stdio: ['ignore', 'ignore', 'ignore'], env: { ...process.env, PORT: String(PORT), MONGODB_URI: uri, MONGODB_DB: dbName, JWT_SECRET: SECRET, LOG_LEVEL: 'silent' } });
  const client = new MongoClient(uri);
  try {
    await client.connect();
    await waitForHealth();
    const db = client.db(dbName);

    // --- seed employees directly (the existing API has its own employee onboarding) ---
    const passwordHash = await bcrypt.hash('Passw0rd!', 4);
    const mk = (key, role, managerId = null) => ({ _id: new ObjectId(), email: `${key}@example.com`, passwordHash, role, managerId, firstName: key, lastName: 'Test', createdAt: new Date() });
    const hr = mk('hr', 'HR'); const manager = mk('manager', 'MANAGER'); const otherManager = mk('othermanager', 'MANAGER');
    const empA = mk('empa', 'EMPLOYEE', manager._id); const empB = mk('empb', 'EMPLOYEE', manager._id);
    const empD = mk('empd', 'EMPLOYEE', manager._id); const empC = mk('empc', 'EMPLOYEE', otherManager._id);
    await db.collection('employees').insertMany([hr, manager, otherManager, empA, empB, empD, empC]);
    const login = async (e) => (await (await fetch(`${BASE}/api/v1/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: e.email, password: 'Passw0rd!' }) })).json()).data.accessToken;
    const [tHr, tMgr, tOther, tA, tB, tD, tC] = await Promise.all([hr, manager, otherManager, empA, empB, empD, empC].map(login));

    const now = new Date(); const today = ymd(now);
    if (hhmm(plusMinutes(now, 70)) < hhmm(now) || hhmm(plusMinutes(now, -130)) > hhmm(now)) throw new Error('Run away from UTC midnight so shift times stay on one calendar day');

    // --- infrastructure ---
    await call('health is public', 'GET', '/health', { expect: 200 });
    await call('swagger docs served', 'GET', '/docs', { expect: 200 });
    await call('openapi json served', 'GET', '/openapi.json', { expect: 200, check: (j) => Boolean(j.paths && j.paths['/api/shifts/me'] && j.paths['/api/overtime-reports/monthly']) || 'new paths missing from OpenAPI' });

    // --- auth / roles ---
    await call('no token rejected', 'GET', '/api/shifts/me', { expect: 401 });
    await call('employee cannot create template', 'POST', '/api/shift-templates', { token: tA, expect: 403, body: { name: 'x', startTime: '09:00', endTime: '17:00', applicableDays: [1] } });
    await call('hr cannot read employee schedule', 'GET', '/api/shifts/me', { token: tHr, expect: 403 });

    // --- templates ---
    const all = [0, 1, 2, 3, 4, 5, 6];
    const t1 = await call('hr creates future-start template', 'POST', '/api/shift-templates', { token: tHr, expect: 201, body: { name: 'Future', startTime: hhmm(plusMinutes(now, 60)), endTime: hhmm(plusMinutes(now, 180)), applicableDays: all }, check: (j) => (j.id && j.name === 'Future' && j.createdAt && Array.isArray(j.applicableDays)) || 'bad body' });
    const t2 = await call('hr creates past-end template', 'POST', '/api/shift-templates', { token: tHr, expect: 201, body: { name: 'Past', startTime: hhmm(plusMinutes(now, -120)), endTime: hhmm(plusMinutes(now, -30)), applicableDays: all } });
    const night = await call('overnight template accepted', 'POST', '/api/shift-templates', { token: tHr, expect: 201, body: { name: 'Night', startTime: '22:00', endTime: '06:00', applicableDays: [1] } });
    await call('duplicate template name -> 409', 'POST', '/api/shift-templates', { token: tHr, expect: 409, body: { name: 'Future', startTime: '09:00', endTime: '17:00', applicableDays: [1] } });
    await call('bad time -> 400', 'POST', '/api/shift-templates', { token: tHr, expect: 400, body: { name: 'Bad', startTime: '25:00', endTime: '17:00', applicableDays: [1] } });
    await call('bad weekday -> 400', 'POST', '/api/shift-templates', { token: tHr, expect: 400, body: { name: 'Bad2', startTime: '09:00', endTime: '17:00', applicableDays: [7] } });
    await call('list templates default paging', 'GET', '/api/shift-templates', { token: tHr, expect: 200, check: (j) => (j.total === 3 && j.offset === 0 && j.limit === 20 && j.items.length === 3) || JSON.stringify(j) });
    await call('list templates offset/limit', 'GET', '/api/shift-templates?offset=1&limit=1', { token: tHr, expect: 200, check: (j) => (j.items.length === 1 && j.total === 3 && j.offset === 1 && j.limit === 1) || JSON.stringify(j) });

    // --- assignments ---
    const body = (e, t, s, en) => ({ employeeId: e._id.toString(), shiftTemplateId: t.id, startDate: s, endDate: en });
    const d = (n) => ymd(plusDays(now, n));
    const asgA = await call('assign template to employee A', 'POST', '/api/shift-assignments', { token: tHr, expect: 201, body: body(empA, t1, d(0), d(20)), check: (j) => (j.id && j.assignedBy === hr._id.toString() && j.startDate === d(0)) || 'bad body' });
    await call('overlap inside range -> 409', 'POST', '/api/shift-assignments', { token: tHr, expect: 409, body: body(empA, t2, d(5), d(6)) });
    await call('overlap on inclusive boundary day -> 409', 'POST', '/api/shift-assignments', { token: tHr, expect: 409, body: body(empA, t2, d(20), d(25)) });
    await call('adjacent range after boundary ok', 'POST', '/api/shift-assignments', { token: tHr, expect: 201, body: body(empA, night, d(21), d(25)) });
    await call('reversed range -> 400', 'POST', '/api/shift-assignments', { token: tHr, expect: 400, body: body(empA, t1, d(5), d(1)) });
    await call('invalid date -> 400', 'POST', '/api/shift-assignments', { token: tHr, expect: 400, body: body(empA, t1, '2026-02-30', '2026-03-01') });
    await call('unknown employee -> 404', 'POST', '/api/shift-assignments', { token: tHr, expect: 404, body: { ...body(empA, t1, d(0), d(1)), employeeId: new ObjectId().toString() } });
    await call('unknown template -> 404', 'POST', '/api/shift-assignments', { token: tHr, expect: 404, body: { ...body(empA, t1, d(0), d(1)), shiftTemplateId: new ObjectId().toString() } });
    await call('assign past-end template to D (today only)', 'POST', '/api/shift-assignments', { token: tHr, expect: 201, body: body(empD, t2, d(0), d(0)) });

    // --- employee schedule ---
    await call('employee upcoming schedule = 14 days', 'GET', '/api/shifts/me?offset=0&limit=20', { token: tA, expect: 200, check: (j) => (j.total === 14 && j.items.length === 14 && j.items[0].date === d(0) && j.items[13].date === d(13) && j.items[0].assignmentId === asgA.id && j.items[0].templateId === t1.id && j.items[0].scheduledStartAt.endsWith('Z')) || JSON.stringify(j).slice(0, 300) });
    await call('employee schedule pagination', 'GET', '/api/shifts/me?offset=10&limit=5', { token: tA, expect: 200, check: (j) => (j.items.length === 4 && j.total === 14 && j.offset === 10 && j.limit === 5) || JSON.stringify(j).slice(0, 300) });
    await call('unassigned employee has empty schedule', 'GET', '/api/shifts/me', { token: tB, expect: 200, check: (j) => (j.total === 0 && j.items.length === 0 && j.limit === 20) || 'not empty' });
    await call('invalid limit -> 400', 'GET', '/api/shifts/me?limit=0', { token: tA, expect: 400 });

    // --- overnight expansion ---
    const nightWeekday = new Date(`${d(21)}T00:00:00Z`).getUTCDay();
    const mondays = []; for (let i = 21; i <= 25; i += 1) if (new Date(`${d(i)}T00:00:00Z`).getUTCDay() === 1) mondays.push(d(i));
    await call('overnight shift ends next calendar day; only applicable weekdays', 'GET', `/api/shifts/team?from=${d(21)}&to=${d(25)}`, { token: tMgr, expect: 200, check: (j) => (j.total === mondays.length && j.items.every((r) => r.scheduledStartAt === `${r.date}T22:00:00.000Z` && r.scheduledEndAt === `${ymd(plusDays(new Date(`${r.date}T00:00:00Z`), 1))}T06:00:00.000Z`)) || `weekday=${nightWeekday} ${JSON.stringify(j).slice(0, 300)}` });

    // --- team schedule ---
    await call('manager team schedule', 'GET', `/api/shifts/team?from=${d(0)}&to=${d(2)}`, { token: tMgr, expect: 200, check: (j) => (j.total === 4 && j.items.some((r) => r.employeeId === empD._id.toString()) && j.items.every((r) => r.employeeId !== empC._id.toString())) || JSON.stringify(j).slice(0, 300) });
    await call('other manager sees nobody', 'GET', `/api/shifts/team?from=${d(0)}&to=${d(2)}`, { token: tOther, expect: 200, check: (j) => j.total === 0 || 'unexpected rows' });
    await call('team schedule requires from/to', 'GET', '/api/shifts/team?from=2026-01-01', { token: tMgr, expect: 400 });
    await call('team schedule strict date format', 'GET', '/api/shifts/team?from=2026-1-1&to=2026-01-02', { token: tMgr, expect: 400 });
    await call('team schedule from > to', 'GET', `/api/shifts/team?from=${d(3)}&to=${d(1)}`, { token: tMgr, expect: 400 });
    await call('employee cannot view team schedule', 'GET', `/api/shifts/team?from=${d(0)}&to=${d(2)}`, { token: tA, expect: 403 });

    // --- check-in / check-out ---
    const inA = await call('check-in early (scheduled)', 'POST', '/api/attendance/check-in', { token: tA, expect: 201, check: (j) => (j.shiftAssignmentId === asgA.id && j.unscheduled === false && j.checkOutAt === null && j.overtimeFlagged === true && j.earlyOvertimeMinutes >= 58 && j.earlyOvertimeMinutes <= 60 && j.overtimeMinutes === j.earlyOvertimeMinutes && j.attendanceDate === today) || JSON.stringify(j) });
    await call('second check-in -> 409', 'POST', '/api/attendance/check-in', { token: tA, expect: 409 });
    await call('check-out before shift end: no late overtime', 'PATCH', '/api/attendance/check-out', { token: tA, expect: 200, check: (j) => (j.id === inA.id && j.checkOutAt && j.lateOvertimeMinutes === 0 && j.overtimeMinutes === j.earlyOvertimeMinutes && j.overtimeFlagged === true) || JSON.stringify(j) });
    await call('check-out when none open -> 404', 'PATCH', '/api/attendance/check-out', { token: tA, expect: 404 });
    const inB = await call('check-in without assignment -> unscheduled', 'POST', '/api/attendance/check-in', { token: tB, expect: 201, check: (j) => (j.shiftAssignmentId === null && j.unscheduled === true && j.overtimeMinutes === 0 && j.overtimeFlagged === false) || JSON.stringify(j) });
    await call('check-out unscheduled: zero overtime', 'PATCH', '/api/attendance/check-out', { token: tB, expect: 200, check: (j) => (j.lateOvertimeMinutes === 0 && j.overtimeMinutes === 0 && j.overtimeFlagged === false) || JSON.stringify(j) });
    await call('check-in after shift start (D)', 'POST', '/api/attendance/check-in', { token: tD, expect: 201, check: (j) => (j.unscheduled === false && j.earlyOvertimeMinutes === 0 && j.overtimeFlagged === false) || JSON.stringify(j) });
    await call('late check-out counts full minutes after end', 'PATCH', '/api/attendance/check-out', { token: tD, expect: 200, check: (j) => (j.lateOvertimeMinutes >= 29 && j.lateOvertimeMinutes <= 31 && j.overtimeMinutes === j.lateOvertimeMinutes && j.overtimeFlagged === true) || JSON.stringify(j) });
    const inC = await call('check-in other team employee', 'POST', '/api/attendance/check-in', { token: tC, expect: 201 });
    await call('hr cannot check in', 'POST', '/api/attendance/check-in', { token: tHr, expect: 403 });

    // --- flag unscheduled ---
    await call('manager flags team record unscheduled', 'PATCH', `/api/attendance/${inA.id}/unscheduled`, { token: tMgr, expect: 200, check: (j) => (j.id === inA.id && j.unscheduled === true) || JSON.stringify(j) });
    await call('manager flagging non-team record -> 403', 'PATCH', `/api/attendance/${inC.id}/unscheduled`, { token: tMgr, expect: 403 });
    await call('unknown attendance -> 404', 'PATCH', `/api/attendance/${new ObjectId()}/unscheduled`, { token: tMgr, expect: 404 });
    await call('malformed attendance id -> 400', 'PATCH', '/api/attendance/not-an-id/unscheduled', { token: tMgr, expect: 400 });
    await call('employee cannot flag', 'PATCH', `/api/attendance/${inB.id}/unscheduled`, { token: tA, expect: 403 });

    // --- monthly report ---
    const month = today.slice(0, 7);
    await call('monthly overtime report', 'GET', `/api/overtime-reports/monthly?month=${month}`, { token: tHr, expect: 200, check: (j) => {
      const byId = Object.fromEntries(j.items.map((r) => [r.employeeId, r]));
      return (j.total === 4 && j.limit === 20 && j.offset === 0 && byId[empA._id.toString()].overtimeMinutes >= 58 && byId[empA._id.toString()].overtimeHours === Math.round(byId[empA._id.toString()].overtimeMinutes / 60 * 100) / 100 && byId[empD._id.toString()].overtimeMinutes >= 29 && byId[empB._id.toString()].overtimeMinutes === 0) || JSON.stringify(j);
    } });
    await call('monthly report pagination', 'GET', `/api/overtime-reports/monthly?month=${month}&offset=3&limit=2`, { token: tHr, expect: 200, check: (j) => (j.items.length === 1 && j.total === 4) || JSON.stringify(j) });
    await call('other month is empty', 'GET', '/api/overtime-reports/monthly?month=2020-01', { token: tHr, expect: 200, check: (j) => j.total === 0 || 'not empty' });
    await call('month required/strict', 'GET', '/api/overtime-reports/monthly?month=2026-13', { token: tHr, expect: 400 });
    await call('report is HR only', 'GET', `/api/overtime-reports/monthly?month=${month}`, { token: tMgr, expect: 403 });

    // --- indexes + one-open-record invariant at the database level ---
    const indexes = await db.collection('attendance_records').indexes();
    const open = indexes.find((i) => i.name === 'uniq_open_record_per_employee');
    results.push({ name: 'open-record unique partial index exists', method: 'DB', url: 'attendance_records', expected: 'index', actual: open ? 'index' : 'missing', status: open ? 'PASS' : 'FAIL', detail: JSON.stringify(open || {}) });
    let dupBlocked = false;
    try { await db.collection('attendance_records').insertOne({ employeeId: empC._id, attendanceDate: today, checkOutAt: null }); } catch (error) { dupBlocked = error.code === 11000; }
    results.push({ name: 'DB rejects a second open record for the same employee', method: 'DB', url: 'attendance_records', expected: 'E11000', actual: dupBlocked ? 'E11000' : 'inserted', status: dupBlocked ? 'PASS' : 'FAIL', detail: '' });

    // --- the literal curl command from the verification checklist ---
    const curlOut = execFileSync('curl', ['-s', '-i', '-H', `Authorization: Bearer ${tA}`, `${BASE}/api/shifts/me?offset=0&limit=20`], { encoding: 'utf8' });
    const curlOk = curlOut.startsWith('HTTP/1.1 200');
    results.push({ name: 'curl -i /api/shifts/me?offset=0&limit=20', method: 'GET', url: '/api/shifts/me?offset=0&limit=20', expected: 200, actual: curlOk ? 200 : 'non-200', status: curlOk ? 'PASS' : 'FAIL', detail: curlOut.split('\r\n')[0] });
    console.log(`${curlOk ? 'PASS' : 'FAIL'}  curl -i shifts/me\n${curlOut.slice(0, 400)}`);
  } finally {
    server.kill('SIGTERM');
    await client.close().catch(() => {});
    if (memory) await memory.stop();
  }
  fs.mkdirSync(path.join(ROOT, 'tests-artifacts'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'tests-artifacts', 'shift_scheduling_results.json'), JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));
  fs.writeFileSync(path.join(ROOT, 'tests-artifacts', 'test_results.json'), JSON.stringify({ generatedAt: new Date().toISOString(), source: 'scripts/verify-shift-scheduling.js against a real mongod and booted server', tests: results }, null, 2));
  const failed = results.filter((r) => r.status !== 'PASS');
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((error) => { console.error('VERIFY ERROR', error); process.exit(2); });
