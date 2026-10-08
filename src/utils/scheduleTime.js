/**
 * Pure calendar/time helpers for shift scheduling.
 *
 * Conventions: calendar dates are "YYYY-MM-DD" strings, shift times are 24-hour
 * "HH:mm" strings, weekdays are 0-6 (Sunday = 0, as in Date#getUTCDay) and every
 * calculation is done in UTC so results never depend on the server time zone.
 */
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const MS_PER_MINUTE = 60 * 1000;
const MS_PER_DAY = 24 * 60 * MS_PER_MINUTE;

const isValidDate = (value) => {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};
const isValidTime = (value) => typeof value === 'string' && TIME_PATTERN.test(value);
const isValidMonth = (value) => typeof value === 'string' && MONTH_PATTERN.test(value);
const isValidWeekday = (value) => Number.isInteger(value) && value >= 0 && value <= 6;

const toDateString = (date) => date.toISOString().slice(0, 10);
const weekdayOf = (dateString) => new Date(`${dateString}T00:00:00.000Z`).getUTCDay();
const addDays = (dateString, days) => toDateString(new Date(new Date(`${dateString}T00:00:00.000Z`).getTime() + days * MS_PER_DAY));
const daysBetween = (fromDate, toDate) => Math.round((new Date(`${toDate}T00:00:00.000Z`) - new Date(`${fromDate}T00:00:00.000Z`)) / MS_PER_DAY);
const maxDate = (a, b) => (a >= b ? a : b);
const minDate = (a, b) => (a <= b ? a : b);

/** Inclusive list of calendar dates between two YYYY-MM-DD strings. */
const eachDate = (fromDate, toDate) => {
  const dates = [];
  for (let date = fromDate; date <= toDate; date = addDays(date, 1)) dates.push(date);
  return dates;
};

/** First and last calendar day of a YYYY-MM month. */
const monthBounds = (month) => {
  const [year, monthNumber] = month.split('-').map(Number);
  const last = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return { first: `${month}-01`, last: `${month}-${String(last).padStart(2, '0')}` };
};

/** True when the shift ends on the following calendar day (endTime <= startTime). */
const isOvernight = (startTime, endTime) => endTime <= startTime;

/** Concrete UTC start/end instants of a shift that starts on `date`. */
const shiftWindow = (date, startTime, endTime) => {
  const startAt = new Date(`${date}T${startTime}:00.000Z`);
  const endDate = isOvernight(startTime, endTime) ? addDays(date, 1) : date;
  const endAt = new Date(`${endDate}T${endTime}:00.000Z`);
  return { startAt, endAt };
};

/** Whole minutes (floored) from `earlier` to `later`; negative when later precedes earlier. */
const minutesBetween = (earlier, later) => Math.floor((later.getTime() - earlier.getTime()) / MS_PER_MINUTE);

const paginate = (rows, { offset, limit }) => ({ items: rows.slice(offset, offset + limit), total: rows.length, offset, limit });

module.exports = {
  MS_PER_MINUTE, isValidDate, isValidTime, isValidMonth, isValidWeekday, toDateString, weekdayOf, addDays, daysBetween,
  maxDate, minDate, eachDate, monthBounds, isOvernight, shiftWindow, minutesBetween, paginate
};
