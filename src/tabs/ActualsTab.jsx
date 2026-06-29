// Actuals: two-period comparison with an inline accordion drill (Director -> Pod ->
// Account). Per period A, period B, and delta for: revenue/RPD, billable hours,
// vacation hours, and credited hours.
//
// Presentation + two aggregate sources only (no model/field change):
//   - billable hours: reuse pmMap/projList hours (add period B + delta).
//   - vacation: 'Internal - Vacation Time' is one internal project, so it can't
//     attach to the project-manager hierarchy. It is attributed by RESOURCE to a
//     pod/director via the shared hierarchy H (vacResMap). Account level is N/A.
//   - credited (pse__Time_Credited__c = true, never in RPD): pod/director from
//     creditMap; account from creditProjMap (periodCreditedByProject). Hours only.
import { useState } from "react";
import { B } from "../constants/brand.js";
import { fmt, fmtK, fmtD, fmtH } from "../lib/format.js";
import { groupTotal } from "../lib/period.js";
import { getEnabledHols, calcWD, calcWDElapsed } from "../lib/holidays.js";
import { Tag, HelpIcon, Spinner } from "../components/index.js";

const DIRS = ["Aldus Behan", "Meghan Saunders"];
const DIV = "2px solid #cfd6dd"; // group divider (stronger than the 0.5px row lines)

export default function ActualsTab({ periodA, periodB, dataA, dataB, setAuditKey, H, hState }) {
  const [expanded, setExpanded] = useState({});
  const [podView, setPodView] = useState("pod");
  const wdA = periodA?.wd || 1, wdB = periodB?.wd || 1;
  const lA = periodA?.label || "Period A", lB = periodB?.label || "Period B";
  const mA = lA.split(" ")[0], mB = lB.split(" ")[0]; // short month labels
  const toggle = (id) => setExpanded((e) => ({ ...e, [id]: !e[id] }));
  const sH = (a, b) => { const d = Math.round(a || 0) - Math.round(b || 0); return (d > 0 ? "+" : "") + d; };

  // Month-end projection: only when period A is the current, in-progress month.
  // revenue to date = period-A revenue (the full-month query equals to-date here
  // because no approved billable timecard is dated past today). Day counts use the
  // shared working-day math (calcWDElapsed = 1st..today, calcWD = full month).
  const now = new Date();
  const isCurrentA = !!periodA && periodA.year === now.getFullYear() && periodA.month === now.getMonth() + 1;
  const holsA = getEnabledHols(periodA?.year, "CA", hState || {});
  const wdElapsed = isCurrentA ? calcWDElapsed(periodA.year, periodA.month, holsA) : 0;
  const wdTotalA = isCurrentA ? calcWD(periodA.year, periodA.month, holsA) : wdA;
  const wdRemaining = Math.max(0, wdTotalA - wdElapsed);
  const showProj = isCurrentA && wdElapsed > 0 && wdRemaining > 0;
  const projectRev = (revToDate) => revToDate + (revToDate / wdElapsed) * wdRemaining;
  // RPD used for the A-vs-B comparison. When A is the in-progress month, compare
  // B's actual RPD against A's PROJECTED full-month RPD (projected revenue / total
  // working days) so the delta reflects where A is heading, not partial-vs-full.
  // For a closed month this is just the actual RPD (revenue / working days).
  const cmpRpdA = (revToDateA) => (showProj ? projectRev(revToDateA) / wdTotalA : revToDateA / wdA);

  // Name column is FIXED (it only needs a pod name + chevron + indent); the metric
  // columns flex (minmax min..1fr) to share the rest of the width evenly, so the
  // table fills the page with no big left gap and no scroll at ~1440px. Free space
  // spreads across the metric columns, keeping wider columns (revenue) wider.
  const NAME_W = 300;
  const metricMin = showProj
    ? [56, 56, 60, 56, 56, 48, 48, 44, 44, 44, 44, 44, 44]  // revA revB proj rpdA rpdB var days | h h | v v | c c
    : [56, 56, 56, 56, 48, 48, 44, 44, 44, 44, 44, 44];     // revA revB rpdA rpdB var days | ...
  const COLS = [`${NAME_W}px`, ...metricMin.map((w) => `minmax(${w}px, 1fr)`)].join(" ");
  const MINW = NAME_W + metricMin.reduce((a, b) => a + b, 0);

  // Resource -> director / pod from the shared hierarchy (for vacation attribution).
  const resDir = {}, resPod = {};
  (H?.directors || []).forEach((d) => {
    if (!DIRS.includes(d.name)) return;
    (d.directMembers || []).forEach((m) => { resDir[m] = d.name; resPod[m] = "(direct)"; });
    (d.pods || []).forEach((p) => (p.members || []).forEach((m) => { resDir[m] = d.name; resPod[m] = p.name; }));
  });
  const vacAgg = (vacResMap) => {
    const byDir = {}, byPod = {}; let all = 0;
    Object.entries(vacResMap || {}).forEach(([r, h]) => {
      const dir = resDir[r]; if (!dir) return;
      byDir[dir] = (byDir[dir] || 0) + h; byPod[`${dir}::${resPod[r]}`] = (byPod[`${dir}::${resPod[r]}`] || 0) + h; all += h;
    });
    return { byDir, byPod, all };
  };
  const vA = vacAgg(dataA?.vacResMap), vB = vacAgg(dataB?.vacResMap);
  const credDir = (cm, g) => Object.entries(cm || {}).reduce((s, [k, h]) => (k.split("::")[0] === g ? s + h : s), 0);
  const credAll = (cm) => Object.entries(cm || {}).reduce((s, [k, h]) => { const g = k.split("::")[0]; return (g === "Aldus Behan" || g === "Meghan Saunders" || g === "Lane Four") ? s + h : s; }, 0);
  const bHrs = {}; (dataB?.projList || []).forEach((p) => { bHrs[p.projId] = (bHrs[p.projId] || 0) + (p.hours || 0); });

  // Headline (all teams).
  const aT = groupTotal(dataA?.pmMap, ["Aldus Behan", "Meghan Saunders", "Lane Four"]);
  const bT = groupTotal(dataB?.pmMap, ["Aldus Behan", "Meghan Saunders", "Lane Four"]);
  const hRpdA = aT.rev / wdA, hRpdB = bT.rev / wdB;
  const hDelta = hRpdB > 0 ? ((cmpRpdA(aT.rev) - hRpdB) / hRpdB * 100) : null;
  const credAllA = credAll(dataA?.creditMap), credAllB = credAll(dataB?.creditMap);

  const mk = (x) => ({ ...x, rpdA: (x.revA || 0) / wdA, rpdB: (x.revB || 0) / wdB });
  const projRevB = (fn) => { const m = {}; (dataB?.projList || []).filter(fn).forEach((p) => { m[p.projId] = (m[p.projId] || 0) + (p.revenue || 0); }); return m; };

  // Flattened rows.
  const rows = [];
  if (dataA) {
    DIRS.forEach((g) => {
      const aG = groupTotal(dataA?.pmMap, [g]), bG = groupTotal(dataB?.pmMap, [g]);
      const dirId = `dir:${g}`;
      rows.push(mk({ id: dirId, depth: 0, label: g.split(" ")[0], revA: aG.rev, revB: bG.rev, hrsA: aG.hrs, hrsB: bG.hrs, vacA: vA.byDir[g] || 0, vacB: vB.byDir[g] || 0, credA: credDir(dataA?.creditMap, g), credB: credDir(dataB?.creditMap, g), hasChildren: true }));
      if (!expanded[dirId]) return;

      if (podView === "project") {
        const rB = projRevB((p) => p.grp === g);
        (dataA?.projList || []).filter((p) => p.grp === g).sort((a, b) => (b.revenue || 0) - (a.revenue || 0)).forEach((p) =>
          rows.push(mk({ id: `${dirId}|proj:${p.projId}`, depth: 1, label: p.acct || p.proj || "Unknown", revA: p.revenue || 0, revB: rB[p.projId] || 0, hrsA: p.hours || 0, hrsB: bHrs[p.projId] || 0, vacA: null, vacB: null, credA: dataA?.creditProjMap?.[p.projId] || 0, credB: dataB?.creditProjMap?.[p.projId] || 0, credited: p.credited, hasChildren: false })));
        return;
      }

      const pms = dataA?.pmMap?.[g]?.pms || {}, pmsB = dataB?.pmMap?.[g]?.pms || {};
      Object.entries(pms).sort((a, b) => b[1].revenue - a[1].revenue).forEach(([pm, d]) => {
        const dB = pmsB[pm] || { revenue: 0, hours: 0 };
        const podId = `${dirId}|pod:${pm}`;
        rows.push(mk({ id: podId, depth: 1, label: pm.split(" ")[0] + " " + pm.split(" ").slice(-1)[0], revA: d.revenue, revB: dB.revenue, hrsA: d.hours, hrsB: dB.hours, vacA: vA.byPod[`${g}::${pm}`] || 0, vacB: vB.byPod[`${g}::${pm}`] || 0, credA: dataA?.creditMap?.[`${g}::${pm}`] || 0, credB: dataB?.creditMap?.[`${g}::${pm}`] || 0, hasChildren: true }));
        if (!expanded[podId]) return;
        const rB = projRevB((p) => p.pm === pm && p.grp === g);
        (dataA?.projList || []).filter((p) => p.pm === pm && p.grp === g).sort((a, b) => (b.revenue || 0) - (a.revenue || 0)).forEach((p) =>
          rows.push(mk({ id: `${podId}|acct:${p.projId}`, depth: 2, label: p.acct || p.proj || "Unknown", revA: p.revenue || 0, revB: rB[p.projId] || 0, hrsA: p.hours || 0, hrsB: bHrs[p.projId] || 0, vacA: null, vacB: null, credA: dataA?.creditProjMap?.[p.projId] || 0, credB: dataB?.creditProjMap?.[p.projId] || 0, credited: p.credited, hasChildren: false })));
      });
    });
  }

  const anyOpen = Object.values(expanded).some(Boolean);
  // Sub-headers are short; the band above names the group. Homogeneous groups
  // (hours/vacation/credited) just label month / month / delta.
  const headers = ["Team / pod / account", `${mA} rev`, `${mB} rev`, ...(showProj ? [`${mA} proj`] : []), `${mA} RPD`, `${mB} RPD`, showProj ? "Δ% proj" : "Δ%", "Days", mA, mB, mA, mB, mA, mB];

  // Headline hour cards (all teams).
  const hourCards = [
    { label: "Billable hours", a: aT.hrs, b: bT.hrs },
    { label: "Vacation hours", a: vA.all, b: vB.all },
    { label: "Credited hours", a: credAllA, b: credAllB },
  ];

  // divL = strong left border marking the first column of a metric group.
  // Every cell gets right padding so right-aligned numbers never touch a divider
  // or column edge; group-first cells get extra left padding off the divider line.
  const numCell = (txt, opts = {}) => <div title={opts.title} style={{ fontSize: 12, textAlign: "right", color: opts.color || B.black, fontWeight: opts.bold ? 600 : 400, borderLeft: opts.divL ? DIV : "none", paddingLeft: opts.divL ? 14 : 0, paddingRight: 12 }}>{txt}</div>;

  // Metric-group spans. Revenue = revA, revB, [proj], rpdA, rpdB, variance, days.
  const revSpan = showProj ? 7 : 6;
  const gFirst = new Set([1, 1 + revSpan, 1 + revSpan + 2, 1 + revSpan + 4]); // first col index of rev/hrs/vac/cred groups (hrs/vac/cred are 2 wide)
  // Per-column delta semantics: revenue/RPD/hours up = good (green), down = bad (red);
  // vacation/credited are neutral (no good/bad). Zero is neutral. Brand green/red.
  const upDown = (d) => (d > 0 ? B.green : d < 0 ? B.red : "#666");
  const bands = [["Revenue", revSpan], ["Hours", 2], ["Vacation", 2], ["Credited", 2]];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, fontSize: 12, fontFamily: "'Open Sans',sans-serif" }}>
        <span style={{ color: B.black, fontWeight: 600 }}>All teams</span>
        {anyOpen && <span onClick={() => setExpanded({})} style={{ color: B.teal, cursor: "pointer" }}>Collapse all</span>}
      </div>

      {dataA && (() => {
        const cards = [
          { label: `${mA} RPD`, val: fmt(hRpdA), sub: `${fmtK(aT.rev)} revenue`, help: "Revenue per day", calc: `${lA} revenue ÷ ${wdA} working days`, ak: "rpd" },
          { label: `${mB} RPD`, val: fmt(hRpdB), sub: `${fmtK(bT.rev)} revenue`, help: "Revenue per day", calc: `${lB} revenue ÷ ${wdB} working days`, ak: "rpd" },
          { label: showProj ? `${mA} (proj) vs ${mB}` : `${mA} vs ${mB}`, val: hDelta !== null ? fmtD(hDelta) : "—", valColor: hDelta === null ? "#aaa" : hDelta >= 0 ? B.green : B.red, sub: showProj ? "Projected RPD variance" : "RPD variance", help: showProj ? "Projected RPD variance" : "RPD variance", calc: showProj ? `(${mA} projected RPD − ${mB} RPD) ÷ ${mB} RPD × 100` : "(A RPD − B RPD) ÷ B RPD × 100", ak: "variance" },
        ];
        if (showProj) cards.push({ label: `${mA} projected`, val: fmtK(projectRev(aT.rev)), valColor: B.teal, sub: `${wdElapsed} of ${wdTotalA} working days in`, help: "Projected month-end revenue", calc: `${mA} revenue to date + (RPD to date × ${wdRemaining} working days remaining)`, ak: "rpd" });
        return (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, 240px)", justifyContent: "start", gap: 16, marginBottom: 16 }}>
          {cards.map(({ label, val, sub, valColor, help, calc, ak }, i) => (
            <div key={i} style={{ background: B.offwhite, borderRadius: 8, padding: "11px 13px", fontFamily: "'Open Sans',sans-serif" }}>
              <div style={{ fontSize: 10, color: "#888", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4, display: "flex", alignItems: "center" }}>{label} <HelpIcon tip={help} calc={calc} auditKey={ak} onAudit={setAuditKey} /></div>
              <div style={{ fontSize: 20, fontWeight: 700, color: valColor || B.black, lineHeight: 1, fontFamily: "'Poppins',sans-serif" }}>{val}</div>
              <div style={{ fontSize: 11, color: "#aaa", marginTop: 3 }}>{sub}</div>
            </div>
          ))}
        </div>
        );
      })()}

      {dataA && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, 240px)", justifyContent: "start", gap: 16, marginBottom: 16 }}>
          {hourCards.map(({ label, a, b }) => (
            <div key={label} style={{ background: B.offwhite, borderRadius: 8, padding: "11px 13px", fontFamily: "'Open Sans',sans-serif" }}>
              <div style={{ fontSize: 10, color: "#888", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1, fontFamily: "'Poppins',sans-serif" }}>{fmtH(a)} <span style={{ fontSize: 11, fontWeight: 400, color: "#aaa" }}>{mA}</span></div>
              <div style={{ fontSize: 11, color: "#aaa", marginTop: 3 }}>{mB}: {fmtH(b)} · Δ {sH(a, b)}</div>
            </div>
          ))}
        </div>
      )}

      {dataA && (
        <div style={{ display: "flex", gap: 6, marginBottom: 12, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "#aaa", fontFamily: "'Open Sans',sans-serif" }}>View by:</span>
          {["pod", "project"].map((v) => (
            <button key={v} onClick={() => { setPodView(v); setExpanded({}); }} style={{ fontSize: 11, padding: "3px 12px", borderRadius: 20, cursor: "pointer", fontFamily: "'Open Sans',sans-serif", background: podView === v ? B.black : "transparent", color: podView === v ? B.white : "#888", border: `0.5px solid ${podView === v ? B.black : B.lgray}` }}>{v === "pod" ? "By pod" : "By project"}</button>
          ))}
        </div>
      )}

      {!dataA ? <Spinner msg={`Loading ${lA}...`} /> : (
        <div style={{ overflowX: "auto", background: B.white, border: `0.5px solid ${B.lgray}`, borderRadius: 12 }}>
          <div style={{ minWidth: MINW, width: "100%" }}>
            {/* Group band: spans the sub-columns; same grid template so dividers
                line up with the header and every data row through expand/collapse. */}
            <div style={{ display: "grid", gridTemplateColumns: COLS, background: B.offwhite, borderBottom: `0.5px solid ${B.lgray}` }}>
              <div style={{ position: "sticky", left: 0, zIndex: 2, background: B.offwhite, padding: "5px 14px", fontSize: 9.5, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: ".05em", fontFamily: "'Open Sans',sans-serif", borderRight: `0.5px solid ${B.lgray}` }}>Team</div>
              {bands.map(([label, span]) => (
                <div key={label} style={{ gridColumn: `span ${span}`, background: B.offwhite, borderLeft: DIV, padding: "5px 8px", textAlign: "center", fontSize: 11, fontWeight: 700, color: B.black, fontFamily: "'Poppins',sans-serif" }}>{label}</div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: COLS, padding: "6px 14px", background: B.offwhite, borderBottom: `0.5px solid ${B.lgray}` }}>
              {headers.map((h, i) => (
                <div key={i} style={{ position: i === 0 ? "sticky" : "static", left: 0, background: i === 0 ? B.offwhite : "transparent", zIndex: i === 0 ? 1 : 0, fontSize: 9.5, color: "#aaa", textTransform: "uppercase", letterSpacing: ".03em", fontFamily: "'Open Sans',sans-serif", textAlign: i > 0 ? "right" : "left", whiteSpace: "nowrap", borderLeft: gFirst.has(i) ? DIV : "none", paddingLeft: gFirst.has(i) ? 14 : 0, paddingRight: i > 0 ? 12 : 0 }}>{h}</div>
              ))}
            </div>

            {rows.map((row) => {
              const delta = row.rpdB > 0 ? ((cmpRpdA(row.revA) - row.rpdB) / row.rpdB * 100) : null;
              const dColor = delta === null ? "#aaa" : upDown(delta);
              const hrsDelta = Math.round(row.hrsA || 0) - Math.round(row.hrsB || 0);
              const open = !!expanded[row.id];
              const vacNA = row.vacA === null;
              return (
                <div key={row.id} onClick={() => { if (row.hasChildren) toggle(row.id); }}
                  style={{ display: "grid", gridTemplateColumns: COLS, padding: "9px 14px", borderBottom: `0.5px solid ${B.lgray}`, cursor: row.hasChildren ? "pointer" : "default", fontFamily: "'Open Sans',sans-serif", background: open && row.depth === 0 ? B.offwhite : "transparent" }}
                  onMouseEnter={(e) => { if (row.hasChildren && !(open && row.depth === 0)) e.currentTarget.style.background = B.offwhite; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = open && row.depth === 0 ? B.offwhite : "transparent"; }}>
                  <div style={{ position: "sticky", left: 0, zIndex: 1, background: "inherit", fontSize: row.depth === 0 ? 12.5 : 12, fontWeight: row.depth === 2 ? 500 : 600, color: row.hasChildren ? B.teal : B.black, display: "flex", alignItems: "center", gap: 6, paddingLeft: row.depth * 18, paddingRight: 8, overflow: "hidden", borderRight: `0.5px solid ${B.lgray}` }}>
                    {row.hasChildren ? <span style={{ flex: "none", width: 12, fontSize: 9, color: "#bbb", transition: "transform .15s", transform: open ? "rotate(90deg)" : "rotate(0deg)" }}>▶</span> : <span style={{ flex: "none", width: 12 }} />}
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.label}</span>
                    {row.credited && <Tag color={B.purpleTx} bg={B.purpleBg}>credited</Tag>}
                  </div>
                  {numCell(fmtK(row.revA), { divL: true })}
                  {numCell(fmtK(row.revB), { color: "#aaa" })}
                  {showProj && numCell(fmtK(projectRev(row.revA)), { bold: true, color: B.teal })}
                  {numCell(fmt(row.rpdA), { bold: true })}
                  {numCell(fmt(row.rpdB), { color: "#aaa" })}
                  {numCell(delta !== null ? fmtD(delta) : "—", { bold: true, color: dColor, title: showProj ? `${mA} projected RPD vs ${mB} actual RPD` : undefined })}
                  {numCell(`${wdA}/${wdB}`, { color: "#aaa" })}
                  {numCell(fmtH(row.hrsA), { divL: true, color: hrsDelta > 0 ? B.green : hrsDelta < 0 ? B.red : B.black })}
                  {numCell(fmtH(row.hrsB), { color: "#aaa" })}
                  {numCell(vacNA ? "—" : fmtH(row.vacA), { color: vacNA ? "#ccc" : B.black, divL: true })}
                  {numCell(vacNA ? "—" : fmtH(row.vacB), { color: "#aaa" })}
                  {numCell(fmtH(row.credA), { divL: true })}
                  {numCell(fmtH(row.credB), { color: "#aaa" })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ marginTop: 8, fontSize: 10, color: "#aaa", fontFamily: "'Open Sans',sans-serif", lineHeight: 1.5 }}>
        {showProj && <span style={{ color: B.teal }}>{mA} is in progress, so the "Δ% proj" comparison uses {mA}'s projected full-month RPD vs {mB}, not its partial actual. </span>}
        Hours are raw (no dollar value). Vacation is attributed to a pod/director by the people in it (shared hierarchy), so it has no account-level value. Credited time is shown separately and is never included in RPD.
      </div>
    </div>
  );
}
