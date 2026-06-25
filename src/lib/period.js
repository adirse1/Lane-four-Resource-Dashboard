// Pure helpers shared by the Actuals, Forecast, and Time detail tabs.

// Calendar-month (or fiscal-quarter) date range for a period option.
export function periodRange(p) {
  if (!p) return null;
  if (p.month) {
    const lastDay = new Date(p.year, p.month, 0).getDate();
    return { start: `${p.year}-${String(p.month).padStart(2, "0")}-01`, end: `${p.year}-${String(p.month).padStart(2, "0")}-${lastDay}` };
  }
  if (p.months) {
    const first = p.months[0], last = p.months[2];
    const lastDay = new Date(last.y, last.m, 0).getDate();
    return { start: `${first.y}-${String(first.m).padStart(2, "0")}-01`, end: `${last.y}-${String(last.m).padStart(2, "0")}-${lastDay}` };
  }
  return null;
}

// Sum revenue + hours across one or more SF groups in a period's pmMap.
export function groupTotal(pmMap, groups) {
  let rev = 0, hrs = 0;
  (groups || []).forEach((g) => { rev += (pmMap?.[g]?.revenue || 0); hrs += (pmMap?.[g]?.hours || 0); });
  return { rev, hrs };
}
