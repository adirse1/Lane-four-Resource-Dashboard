// Holiday calendar (CA + US, 2024-2027) and all working-day math.
// This is the ONE source for working days. Holidays toggled OFF in the Options
// tab count as working days. Fiscal year starts Jul 1 (Q1 Jul-Sep ... Q4 Apr-Jun).
// Canada does not observe Easter Monday (only Good Friday).

import { MONTHS } from "../constants/brand.js";

export const HOLIDAYS = {
  2024: {
    CA: [
      { name: "New Year's Day", date: "2024-01-01" }, { name: "Family Day (ON)", date: "2024-02-19" },
      { name: "Good Friday", date: "2024-03-29" }, { name: "Victoria Day", date: "2024-05-20" },
      { name: "Canada Day", date: "2024-07-01" }, { name: "Civic Holiday (ON)", date: "2024-08-05" },
      { name: "Labour Day", date: "2024-09-02" }, { name: "National Day for Truth", date: "2024-09-30" },
      { name: "Thanksgiving", date: "2024-10-14" }, { name: "Remembrance Day", date: "2024-11-11" },
      { name: "Christmas Day", date: "2024-12-25" },
    ],
    US: [
      { name: "New Year's Day", date: "2024-01-01" }, { name: "MLK Jr. Day", date: "2024-01-15" },
      { name: "Presidents' Day", date: "2024-02-19" }, { name: "Memorial Day", date: "2024-05-27" },
      { name: "Juneteenth", date: "2024-06-19" }, { name: "Independence Day", date: "2024-07-04" },
      { name: "Labour Day", date: "2024-09-02" }, { name: "Columbus Day", date: "2024-10-14" },
      { name: "Veterans Day", date: "2024-11-11" }, { name: "Thanksgiving", date: "2024-11-28" },
      { name: "Christmas Day", date: "2024-12-25" },
    ],
  },
  2025: {
    CA: [
      { name: "New Year's Day", date: "2025-01-01" }, { name: "Family Day (ON)", date: "2025-02-17" },
      { name: "Good Friday", date: "2025-04-18" }, { name: "Victoria Day", date: "2025-05-19" },
      { name: "Canada Day", date: "2025-07-01" }, { name: "Civic Holiday (ON)", date: "2025-08-04" },
      { name: "Labour Day", date: "2025-09-01" }, { name: "National Day for Truth", date: "2025-09-30" },
      { name: "Thanksgiving", date: "2025-10-13" }, { name: "Remembrance Day", date: "2025-11-11" },
      { name: "Christmas Day", date: "2025-12-25" },
    ],
    US: [
      { name: "New Year's Day", date: "2025-01-01" }, { name: "MLK Jr. Day", date: "2025-01-20" },
      { name: "Presidents' Day", date: "2025-02-17" }, { name: "Memorial Day", date: "2025-05-26" },
      { name: "Juneteenth", date: "2025-06-19" }, { name: "Independence Day", date: "2025-07-04" },
      { name: "Labour Day", date: "2025-09-01" }, { name: "Columbus Day", date: "2025-10-13" },
      { name: "Veterans Day", date: "2025-11-11" }, { name: "Thanksgiving", date: "2025-11-27" },
      { name: "Christmas Day", date: "2025-12-25" },
    ],
  },
  2026: {
    CA: [
      { name: "New Year's Day", date: "2026-01-01" }, { name: "Family Day (ON)", date: "2026-02-16" },
      { name: "Good Friday", date: "2026-04-03" }, { name: "Victoria Day", date: "2026-05-18" },
      { name: "Canada Day", date: "2026-07-01" }, { name: "Civic Holiday (ON)", date: "2026-08-03" },
      { name: "Labour Day", date: "2026-09-07" }, { name: "National Day for Truth", date: "2026-09-30" },
      { name: "Thanksgiving", date: "2026-10-12" }, { name: "Remembrance Day", date: "2026-11-11" },
      { name: "Christmas Day", date: "2026-12-25" },
    ],
    US: [
      { name: "New Year's Day", date: "2026-01-01" }, { name: "MLK Jr. Day", date: "2026-01-19" },
      { name: "Presidents' Day", date: "2026-02-16" }, { name: "Memorial Day", date: "2026-05-25" },
      { name: "Juneteenth", date: "2026-06-19" }, { name: "Independence Day", date: "2026-07-03" },
      { name: "Labour Day", date: "2026-09-07" }, { name: "Columbus Day", date: "2026-10-12" },
      { name: "Veterans Day", date: "2026-11-11" }, { name: "Thanksgiving", date: "2026-11-26" },
      { name: "Christmas Day", date: "2026-12-25" },
    ],
  },
  2027: {
    CA: [
      { name: "New Year's Day", date: "2027-01-01" }, { name: "Family Day (ON)", date: "2027-02-15" },
      { name: "Good Friday", date: "2027-03-26" }, { name: "Victoria Day", date: "2027-05-24" },
      { name: "Canada Day", date: "2027-07-01" }, { name: "Civic Holiday (ON)", date: "2027-08-02" },
      { name: "Labour Day", date: "2027-09-06" }, { name: "National Day for Truth", date: "2027-09-30" },
      { name: "Thanksgiving", date: "2027-10-11" }, { name: "Remembrance Day", date: "2027-11-11" },
      { name: "Christmas Day", date: "2027-12-27" },
    ],
    US: [
      { name: "New Year's Day", date: "2027-01-01" }, { name: "MLK Jr. Day", date: "2027-01-18" },
      { name: "Presidents' Day", date: "2027-02-15" }, { name: "Memorial Day", date: "2027-05-31" },
      { name: "Juneteenth", date: "2027-06-18" }, { name: "Independence Day", date: "2027-07-05" },
      { name: "Labour Day", date: "2027-09-06" }, { name: "Columbus Day", date: "2027-10-11" },
      { name: "Veterans Day", date: "2027-11-11" }, { name: "Thanksgiving", date: "2027-11-25" },
      { name: "Christmas Day", date: "2027-12-27" },
    ],
  },
};

// ── Working day helpers (driven by Options holiday toggles) ─────────────────────
export function getEnabledHols(year, country, hState) {
  return (HOLIDAYS[year]?.[country] || []).filter((h) => hState[`${year}-${country}-${h.date}`] !== false);
}

export function calcWD(year, month, hols) {
  const hSet = new Set((hols || []).map((h) => h.date));
  let c = 0, days = new Date(year, month, 0).getDate();
  for (let d = 1; d <= days; d++) {
    const dow = new Date(year, month - 1, d).getDay();
    if (dow === 0 || dow === 6) continue;
    const k = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (!hSet.has(k)) c++;
  }
  return c;
}

export function calcWDElapsed(year, month, hols) {
  const today = new Date(), hSet = new Set((hols || []).map((h) => h.date));
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month;
  const lastDay = isCurrentMonth ? today.getDate() : new Date(year, month, 0).getDate();
  let c = 0;
  for (let d = 1; d <= lastDay; d++) {
    const dow = new Date(year, month - 1, d).getDay();
    if (dow === 0 || dow === 6) continue;
    const k = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (!hSet.has(k)) c++;
  }
  return c;
}

// Working days (Mon-Fri minus holidays) in the 7-day week starting at weekStart
// (a Monday). holDates is a Set of "YYYY-MM-DD" strings of enabled holidays. Used
// by the resource planner to size weekly capacity without hardcoding holidays.
export function calcWDWeek(weekStart, holDates) {
  let c = 0;
  for (let i = 0; i < 5; i++) {
    const d = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (!holDates.has(k)) c++;
  }
  return c;
}

export function calcQWD(year, qNum, hState) {
  const FISCAL_Q = {
    1: [{ y: year, m: 7 }, { y: year, m: 8 }, { y: year, m: 9 }],
    2: [{ y: year, m: 10 }, { y: year, m: 11 }, { y: year, m: 12 }],
    3: [{ y: year + 1, m: 1 }, { y: year + 1, m: 2 }, { y: year + 1, m: 3 }],
    4: [{ y: year + 1, m: 4 }, { y: year + 1, m: 5 }, { y: year + 1, m: 6 }],
  };
  const months = FISCAL_Q[qNum] || [];
  return months.reduce((sum, { y, m }) => {
    const h = getEnabledHols(y, "CA", hState);
    return sum + calcWD(y, m, h);
  }, 0);
}

// ── Period option generators ───────────────────────────────────────────────────
export function genMonthOpts(hState) {
  const today = new Date(), opts = [];
  for (let i = 0; i < 24; i++) {
    let m = today.getMonth() + 1 - i, y = today.getFullYear();
    while (m <= 0) { m += 12; y--; }
    const hols = getEnabledHols(y, "CA", hState);
    const wd = calcWD(y, m, hols);
    opts.push({ id: `${y}-${m}`, label: `${MONTHS[m - 1]} ${y}`, year: y, month: m, wd });
  }
  return opts;
}

export function genQuarterOpts(hState) {
  const today = new Date(), opts = [];
  const FISCAL_Q_LABELS = { 1: "Q1 (Jul–Sep)", 2: "Q2 (Oct–Dec)", 3: "Q3 (Jan–Mar)", 4: "Q4 (Apr–Jun)" };
  for (let i = 0; i < 8; i++) {
    const cm = today.getMonth() + 1, cy = today.getFullYear();
    let fq, fy;
    if (cm >= 7) { fq = 1; fy = cy; }
    else if (cm >= 4) { fq = 4; fy = cy - 1; }
    else if (cm >= 1) { fq = 3; fy = cy - 1; }
    let q = fq - i, y = fy;
    while (q <= 0) { q += 4; y--; }
    const wd = calcQWD(y, q, hState);
    const FISCAL_Q_MONTHS = {
      1: [{ y, m: 7 }, { y, m: 8 }, { y, m: 9 }],
      2: [{ y, m: 10 }, { y, m: 11 }, { y, m: 12 }],
      3: [{ y: y + 1, m: 1 }, { y: y + 1, m: 2 }, { y: y + 1, m: 3 }],
      4: [{ y: y + 1, m: 4 }, { y: y + 1, m: 5 }, { y: y + 1, m: 6 }],
    };
    const mths = FISCAL_Q_MONTHS[q];
    const startM = mths[0], endM = mths[2];
    const rangeLabel = `${MONTHS[startM.m - 1]} ${startM.y}–${MONTHS[endM.m - 1]} ${endM.y}`;
    opts.push({ id: `${y}-Q${q}`, label: `FY${y + 1} ${FISCAL_Q_LABELS[q]}`, subLabel: rangeLabel, year: y, qNum: q, wd, months: mths });
  }
  return opts;
}
