// Excel export of the resource planner view (SheetJS). Pure logic + file download.
//
// Sheet "Plan": one row per person, one column per week (committed + overlay summed
// into the displayed number), with director/pod columns, a row total, and a weekly
// total row. Sheet "Committed vs overlay": the same people broken out into separate
// committed and overlay rows so the hypotheticals are auditable.
//
// Writing rules: dynamic week labels ("Jun 22 wk"), sentence case headers, no em
// dashes. Filename: resource-plan-[today].xlsx.
//
// SheetJS is heavy and only needed on export, so it is loaded lazily (dynamic
// import) instead of at module load. This keeps it off the app's startup path.

const r = (n) => Math.round(n || 0);
const sum = (a) => a.reduce((x, y) => x + y, 0);

function todayStamp() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// people: [{ name, dir, pod, hypo, committed:[], overlay:[], total:[] }] in display order.
// weeks:  [{ label }]  (label like "Jun 22")
export async function exportPlan({ weeks, people }) {
  const mod = await import("xlsx");
  const XLSX = mod.utils ? mod : mod.default; // CJS/ESM interop
  const wkCols = weeks.map((w) => `${w.label} wk`);
  const nameOf = (p) => (p.hypo ? `${p.name} (hypothetical)` : p.name);

  // Sheet 1: Plan (committed + overlay summed).
  const head1 = ["Director", "Pod", "Person", ...wkCols, "Row total"];
  const body1 = people.map((p) => {
    const t = p.total.map(r);
    return [p.dir, p.pod, nameOf(p), ...t, sum(t)];
  });
  const colTotals = weeks.map((_, i) => sum(people.map((p) => r(p.total[i]))));
  const weeklyTotalRow = ["", "", "Weekly total", ...colTotals, sum(colTotals)];
  const ws1 = XLSX.utils.aoa_to_sheet([head1, ...body1, weeklyTotalRow]);
  ws1["!cols"] = [{ wch: 16 }, { wch: 16 }, { wch: 22 }, ...wkCols.map(() => ({ wch: 9 })), { wch: 10 }];
  ws1["!freeze"] = { xSplit: 3, ySplit: 1 };

  // Sheet 2: committed vs overlay, separate rows per person.
  const head2 = ["Director", "Pod", "Person", "Type", ...wkCols, "Row total"];
  const body2 = [];
  people.forEach((p) => {
    const com = p.committed.map(r), ovl = p.overlay.map(r);
    const comHas = com.some((x) => x), ovlHas = ovl.some((x) => x);
    if (comHas || !ovlHas) body2.push([p.dir, p.pod, nameOf(p), "Committed", ...com, sum(com)]);
    if (ovlHas) body2.push([p.dir, p.pod, nameOf(p), "Overlay", ...ovl, sum(ovl)]);
  });
  const ws2 = XLSX.utils.aoa_to_sheet([head2, ...body2]);
  ws2["!cols"] = [{ wch: 16 }, { wch: 16 }, { wch: 22 }, { wch: 11 }, ...wkCols.map(() => ({ wch: 9 })), { wch: 10 }];
  ws2["!freeze"] = { xSplit: 4, ySplit: 1 };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws1, "Plan");
  XLSX.utils.book_append_sheet(wb, ws2, "Committed vs overlay");
  XLSX.writeFile(wb, `resource-plan-${todayStamp()}.xlsx`);
}
