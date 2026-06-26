import { useState } from "react";
import { B } from "../constants/brand.js";
import { fmt, fmtH, ini, ac } from "../lib/format.js";

// Per-person utilization drill-down. Slide-in panel that breaks one person's
// month down to the project and the individual timecard split, so the headline
// utilization number can be reconciled line-by-line against Salesforce.
//
// Utilization = (billable + credited + vacation) / capacity. So a timecard split
// counts toward utilization if it is billable client work (billable + project not
// 'Internal%'), OR credited, OR vacation ('Internal - Vacation Time'). Everything
// else (other non-billable internal time) is shown but flagged not counted, so the
// audit is complete rather than pre-filtered.
const isVacation = (r) => /vacation/i.test(r.proj || "");
const counts = (r) => isVacation(r) || r.credited || (r.billable && !/^Internal/i.test(r.proj));

export default function UtilPersonPanel({ person, rows, lbl, cap, loading, onClose }) {
  const [showRaw, setShowRaw] = useState(false);
  if (!person) return null;
  const a = ac(person.name);

  // Roll the raw timecards up by project, splitting hours into the buckets that
  // map to the utilization numerator (billable / credited / vacation) vs. other.
  const byProj = {};
  (rows || []).forEach((r) => {
    if (!byProj[r.proj]) byProj[r.proj] = { proj: r.proj, grp: r.grp, pm: r.pm, src: r.src, billH: 0, credH: 0, vacH: 0, otherH: 0, rev: 0, n: 0 };
    const p = byProj[r.proj];
    p.n++; p.rev += r.rev;
    if (isVacation(r)) p.vacH += r.hours;
    else if (r.credited) p.credH += r.hours;
    else if (r.billable && !/^Internal/i.test(r.proj)) p.billH += r.hours;
    else p.otherH += r.hours;
    if (!p.src && r.src) p.src = r.src;
  });
  // A project's counted hours = what flows into utilization.
  const countedOf = (p) => p.billH + p.credH + p.vacH;
  const projects = Object.values(byProj).sort((x, y) => (countedOf(y) - countedOf(x)) || (y.otherH - x.otherH));

  // Headline uses the same aggregates as the table (b/cr/v) so the panel and the
  // row always agree, even if billable+credited overlap on a split.
  const numer = (person.b || 0) + (person.cr || 0) + (person.v || 0);
  const util = cap > 0 ? Math.min(Math.round((numer / cap) * 100), 150) : 0;
  const wdays = Math.round(cap / 8);

  const Cell = ({ children, style }) => <div style={{ fontSize: 11, fontFamily: "'Open Sans',sans-serif", ...style }}>{children}</div>;
  const stat = (label, val, color) => (
    <div style={{ background: B.offwhite, borderRadius: 7, padding: "8px 10px", flex: 1 }}>
      <div style={{ fontSize: 9, color: "#888", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 2, fontFamily: "'Open Sans',sans-serif" }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 700, fontFamily: "'Poppins',sans-serif", lineHeight: 1, color: color || B.black }}>{val}</div>
    </div>
  );

  return (
    <div style={{ position: "fixed", top: 0, right: 0, width: 460, maxWidth: "100vw", height: "100vh", background: B.white, borderLeft: `1px solid ${B.lgray}`, zIndex: 1000, overflowY: "auto", padding: 22, boxSizing: "border-box", fontFamily: "'Open Sans',sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{ width: 26, height: 26, borderRadius: "50%", background: a.bg, color: a.tx, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700 }}>{ini(person.name)}</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "'Poppins',sans-serif", color: B.black }}>{person.name}</div>
            <div style={{ fontSize: 10, color: "#aaa" }}>{[person.dirName, person.podName].filter(Boolean).join(" · ") || "Unassigned"} · {lbl}</div>
          </div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: "#aaa", lineHeight: 1 }}>×</button>
      </div>

      {loading ? (
        <div style={{ fontSize: 12, color: "#888", padding: "20px 0" }}>Loading timecards...</div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            {stat("Utilization", util + "%", util >= 90 ? B.greenTx : util >= 70 ? B.amberTx : B.redTx)}
            {stat("Billable hrs", fmtH(person.b))}
            {stat("Vacation hrs", fmtH(person.v), person.v > 0 ? B.amber : B.black)}
            {stat("Revenue", fmt(person.rev))}
          </div>

          <div style={{ background: B.tealLt, borderRadius: 7, padding: "8px 11px", marginBottom: 16, fontSize: 11, color: "#444", lineHeight: 1.6 }}>
            <strong style={{ color: B.black }}>Utilization = (billable + credited + vacation) ÷ capacity</strong><br />
            = ({fmtH(person.b)} billable + {fmtH(person.cr)} credited + {fmtH(person.v)} vacation) ÷ {fmtH(cap)}h ({wdays} working days × 8) = <strong>{util}%</strong>
          </div>

          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".05em", color: "#aaa", marginBottom: 7 }}>By project</div>
          <div style={{ border: `0.5px solid ${B.lgray}`, borderRadius: 8, overflow: "hidden", marginBottom: 16 }}>
            {projects.map((p) => {
              const counted = countedOf(p);
              const c = counted > 0;
              return (
                <div key={p.proj} style={{ padding: "9px 12px", borderBottom: `0.5px solid ${B.lgray}`, background: c ? B.white : B.offwhite }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: B.black, fontFamily: "'Open Sans',sans-serif" }}>{p.proj}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, fontFamily: "'Poppins',sans-serif", whiteSpace: "nowrap" }}>{fmtH(counted)}h</div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 3 }}>
                    <div style={{ fontSize: 10, color: "#999" }}>{[p.grp, p.pm].filter(Boolean).join(" · ")}{p.rev ? " · " + fmt(p.rev) : ""}</div>
                    <div style={{ display: "flex", gap: 4, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      {p.billH > 0 && (p.credH > 0 || p.vacH > 0) && <span style={{ fontSize: 8, padding: "1px 5px", borderRadius: 4, background: B.tealLt, color: B.greenTx }}>{fmtH(p.billH)}h billable</span>}
                      {p.credH > 0 && <span style={{ fontSize: 8, padding: "1px 5px", borderRadius: 4, background: B.purpleBg, color: B.purpleTx }}>{fmtH(p.credH)}h credited</span>}
                      {p.vacH > 0 && <span style={{ fontSize: 8, padding: "1px 5px", borderRadius: 4, background: B.amberBg, color: B.amberTx }}>{fmtH(p.vacH)}h vacation</span>}
                      {p.otherH > 0 && <span style={{ fontSize: 8, padding: "1px 5px", borderRadius: 4, background: B.lgray, color: "#777" }}>{fmtH(p.otherH)}h non-bill</span>}
                      {!p.src && p.billH > 0 && <span style={{ fontSize: 8, padding: "1px 5px", borderRadius: 4, background: B.amberBg, color: B.amberTx }}>no source</span>}
                      <span style={{ fontSize: 8, padding: "1px 5px", borderRadius: 4, background: c ? B.greenBg : B.redBg, color: c ? B.greenTx : B.redTx, fontWeight: 700 }}>{c ? "counts" : "excluded"}</span>
                    </div>
                  </div>
                </div>
              );
            })}
            {!projects.length && <div style={{ padding: 14, fontSize: 11, color: "#999" }}>No approved timecards in {lbl}.</div>}
          </div>

          <button onClick={() => setShowRaw((s) => !s)} style={{ fontSize: 11, padding: "5px 11px", border: `0.5px solid ${B.lgray}`, borderRadius: 6, background: "transparent", cursor: "pointer", color: "#666", marginBottom: 10, fontFamily: "'Open Sans',sans-serif" }}>
            {showRaw ? "▾ Hide" : "▸ Show"} timecard splits ({(rows || []).length})
          </button>

          {showRaw && (
            <div style={{ border: `0.5px solid ${B.lgray}`, borderRadius: 8, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "62px 1fr 42px 50px", background: B.offwhite, borderBottom: `0.5px solid ${B.lgray}`, padding: "5px 10px", fontSize: 9, color: "#aaa", textTransform: "uppercase", letterSpacing: ".04em" }}>
                <div>Date</div><div>Project / Split Id</div><div style={{ textAlign: "right" }}>Hrs</div><div style={{ textAlign: "right" }}>Rev</div>
              </div>
              {(rows || []).map((r) => (
                <div key={r.id} style={{ display: "grid", gridTemplateColumns: "62px 1fr 42px 50px", padding: "5px 10px", borderBottom: `0.5px solid ${B.lgray}`, alignItems: "center", background: counts(r) ? B.white : B.offwhite }}>
                  <Cell style={{ color: "#888", fontSize: 10 }}>{r.date}</Cell>
                  <div style={{ overflow: "hidden" }}>
                    <Cell style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {r.credited && <span style={{ color: B.purpleTx }}>◆ </span>}
                      {!r.billable && !r.credited && <span style={{ color: "#bbb" }}>○ </span>}
                      {r.proj}
                    </Cell>
                    <Cell style={{ fontSize: 9, color: "#bbb", fontFamily: "monospace" }}>{r.id}</Cell>
                  </div>
                  <Cell style={{ textAlign: "right" }}>{r.hours}</Cell>
                  <Cell style={{ textAlign: "right", color: "#888" }}>{r.rev ? fmt(r.rev) : "—"}</Cell>
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: 14, fontSize: 10, color: "#aaa", lineHeight: 1.6 }}>
            ◆ credited · ○ non-billable. Source object: pse__Timecard__c (Timecard Split), approved only, by resource for the month. The utilization numerator is three buckets:
            <span style={{ fontFamily: "monospace", color: "#888", display: "block", marginTop: 4 }}>billable: pse__Billable__c = true AND NOT Project LIKE 'Internal%'<br />credited: pse__Time_Credited__c = true AND NOT Project LIKE 'Internal%'<br />vacation: Project = 'Internal - Vacation Time'</span>
          </div>
        </>
      )}
    </div>
  );
}
