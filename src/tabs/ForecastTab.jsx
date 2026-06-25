// Forecast: month-level revenue projection with vacation coverage.
//
// KNOWN BUG (from README): the bars use rough multipliers (ceiling = revenue x 1.3,
// forecast = revenue x 0.55), NOT real remaining-assignment math. Directional only
// until this tab is rebuilt off pse__Assignment__c. Preserved verbatim here.
//
// sendPrompt was an undefined global in the original single-file build (the
// "Find coverage" button would throw). It now arrives as a prop; the default
// no-ops with a warning so the button degrades gracefully instead of crashing.
import { useState } from "react";
import { B } from "../constants/brand.js";
import { fmt, fmtK } from "../lib/format.js";
import { groupTotal } from "../lib/period.js";
import { calcWDElapsed, getEnabledHols } from "../lib/holidays.js";
import { HelpIcon } from "../components/index.js";

export default function ForecastTab({
  periodA, periodB, dataA, dataB, vacData, hState, setAuditKey,
  sendPrompt = (p) => console.warn("sendPrompt not wired:", p),
}) {
  const [expandedPods, setExpandedPods] = useState({});
  const wdA = periodA?.wd || 1;
  const wdB = periodB?.wd || 1;

  const lA = periodA?.label || "Current";
  const wdEl = periodA?.month ? calcWDElapsed(periodA.year, periodA.month, getEnabledHols(periodA.year, "CA", hState)) : 0;
  const vacTotal = (vacData || []).reduce((s, r) => s + (r.hours || 0), 0);
  const revToDate = dataA ? groupTotal(dataA.pmMap, ["Aldus Behan", "Meghan Saunders", "Tatiane Sensini", "Lane Four"]).rev : 0;
  const rpdToDate = wdEl > 0 ? revToDate / wdEl : 0;

  return (
    <div>
      <div style={{ fontSize: 11, color: "#888", background: B.offwhite, borderRadius: 8, padding: "6px 12px", display: "flex", alignItems: "center", gap: 6, marginBottom: 14, fontFamily: "'Open Sans',sans-serif", flexWrap: "wrap" }}>
        📅 {lA} ·&nbsp; {wdEl} of {wdA} working days elapsed ({wdA > 0 ? Math.round((wdEl / wdA) * 100) : 0}%) ·&nbsp; Actuals = approved timecards ·&nbsp; Forecast = remaining scheduled assignments
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 10, marginBottom: 14 }}>
        {[
          { label: `${lA} RPD to date`, val: fmt(rpdToDate), sub: `${fmtK(revToDate)} logged`, help: "RPD from actuals only", calc: "Revenue logged ÷ elapsed working days", ak: "rpd" },
          { label: "Vacation hrs", val: `${Math.round(vacTotal)} hrs`, sub: "Internal - Vacation Time", help: "Vacation hours", calc: "Approved splits on 'Internal - Vacation Time'", ak: "vacation" },
          { label: "Working days", val: `${wdEl} / ${wdA}`, sub: "elapsed / total (CA)", help: "Working days", calc: "Weekdays minus enabled CA holidays", ak: "working_days" },
          { label: "Utilization ceiling", val: `${wdA > 0 ? Math.round((revToDate / (revToDate * 1.25 || 1)) * 100) : 0}%`, sub: "of est. full capacity", help: "Full utilization ceiling", calc: "Actual revenue ÷ estimated max", ak: "ceiling" },
        ].map(({ label, val, sub, help, calc, ak }, i) => (
          <div key={i} style={{ background: B.offwhite, borderRadius: 8, padding: "11px 13px", fontFamily: "'Open Sans',sans-serif" }}>
            <div style={{ fontSize: 10, color: "#888", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4, display: "flex", alignItems: "center" }}>
              {label} <HelpIcon tip={help} calc={calc} auditKey={ak} onAudit={setAuditKey} />
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: B.black, lineHeight: 1, fontFamily: "'Poppins',sans-serif" }}>{val}</div>
            <div style={{ fontSize: 11, color: "#aaa", marginTop: 3 }}>{sub}</div>
          </div>
        ))}
      </div>

      {["Aldus Behan", "Meghan Saunders"].map((dir) => {
        const aD = groupTotal(dataA?.pmMap, [dir]);
        const bD = groupTotal(dataB?.pmMap, [dir]);
        const vacDir = (vacData || []).filter((r) => r.grp === dir).reduce((s, r) => s + (r.hours || 0), 0);
        const ceiling = aD.rev * 1.3;
        const pctA = ceiling > 0 ? Math.min((aD.rev / ceiling) * 100, 100) : 0;
        const pctV = ceiling > 0 ? Math.min((vacDir * 150 / ceiling) * 100, 8) : 0;
        const pctF = ceiling > 0 ? Math.min(((aD.rev * .55) / ceiling) * 100, 100 - pctA - pctV) : 0;
        const lastMoPct = ceiling > 0 ? Math.min((bD.rev / ceiling) * 95, 99) : 0;
        const pms = dataA?.pmMap?.[dir]?.pms || {};
        const vacByPM = {};
        (vacData || []).filter((r) => r.grp === dir).forEach((r) => { vacByPM[r.pm] = (vacByPM[r.pm] || 0) + (r.hours || 0); });

        return (
          <div key={dir} style={{ background: B.white, border: `0.5px solid ${B.lgray}`, borderRadius: 12, overflow: "hidden", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "12px 16px 0" }}>
              <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "'Poppins',sans-serif" }}>{dir.split(" ")[0]}</div>
              <div style={{ fontSize: 11, color: "#888", fontFamily: "'Open Sans',sans-serif" }}>
                {fmt(wdA > 0 ? aD.rev / wdA : 0)} RPD to date &nbsp;·&nbsp; {fmt(wdA > 0 ? bD.rev / wdB : 0)} {periodB?.label} RPD &nbsp;·&nbsp; {Math.round(vacDir)} vac hrs
                <HelpIcon tip="Forecast ceiling" calc="Estimated max if all resources billed 40hrs every working day." auditKey="ceiling" onAudit={setAuditKey} />
              </div>
            </div>
            <div style={{ padding: "10px 16px 12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#bbb", marginBottom: 4, fontFamily: "'Open Sans',sans-serif" }}>
                <span>$0</span><span>Full utilization ceiling <HelpIcon tip="Full utilization ceiling" calc="All resources × 8hrs × working days × effective rate" auditKey="ceiling" onAudit={setAuditKey} /></span>
              </div>
              <div style={{ height: 22, background: B.lgray, borderRadius: 4, display: "flex", overflow: "hidden", position: "relative" }}>
                <div style={{ width: `${pctA}%`, background: B.teal, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                  {pctA > 10 && <span style={{ fontSize: 10, fontWeight: 600, color: B.greenTx, whiteSpace: "nowrap", padding: "0 4px", fontFamily: "'Open Sans',sans-serif" }}>{fmtK(aD.rev)}</span>}
                </div>
                <div style={{ width: `${pctV}%`, background: B.yellow, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                  {pctV > 3 && <span style={{ fontSize: 10, fontWeight: 600, color: B.amberTx, fontFamily: "'Open Sans',sans-serif" }}>vac</span>}
                </div>
                <div style={{ width: `${pctF}%`, background: "rgba(44,204,211,0.18)", borderTop: `1.5px dashed ${B.tealDash}`, borderBottom: `1.5px dashed ${B.tealDash}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                  {pctF > 8 && <span style={{ fontSize: 10, color: B.greenTx, fontFamily: "'Open Sans',sans-serif" }}>forecast</span>}
                </div>
                <div style={{ position: "absolute", left: `${lastMoPct}%`, top: 0, width: 2, height: "100%", background: "#888", opacity: .6, zIndex: 2 }}>
                  <div style={{ position: "absolute", top: 3, left: 4, fontSize: 9, color: "#666", whiteSpace: "nowrap", fontFamily: "'Open Sans',sans-serif" }}>{periodB?.label}</div>
                </div>
                <div style={{ position: "absolute", right: 0, top: 0, width: 2, height: "100%", background: B.orange }} />
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 6, flexWrap: "wrap" }}>
                {[{ c: B.teal, l: "Actuals" }, { c: B.yellow, l: "Vacation" }, { c: "rgba(44,204,211,0.25)", l: "Forecast", d: true }, { c: "#888", l: `${periodB?.label} RPD`, line: true }, { c: B.orange, l: "Ceiling" }].map(({ c, l, d, line }) => (
                  <div key={l} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "#888", fontFamily: "'Open Sans',sans-serif" }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: line ? "transparent" : c, border: d ? `1px dashed ${B.tealDash}` : "none", borderLeft: line ? "3px solid #888" : undefined, flexShrink: 0 }} />
                    {l}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ borderTop: `0.5px solid ${B.lgray}` }}>
              <div style={{ display: "grid", gridTemplateColumns: "140px 1fr 72px 56px 52px 20px", padding: "4px 16px", borderBottom: `0.5px solid ${B.lgray}`, background: B.offwhite }}>
                {["Pod lead", "Actuals / vac / forecast", `${lA} RPD`, "Vac hrs", "Ceiling", ""].map((h, i) => (
                  <div key={i} style={{ fontSize: 10, color: "#bbb", textTransform: "uppercase", letterSpacing: ".04em", fontFamily: "'Open Sans',sans-serif", textAlign: i > 1 && i < 5 ? "right" : "left" }}>{h}</div>
                ))}
              </div>
              {Object.entries(pms).sort((a, b) => b[1].revenue - a[1].revenue).map(([pm, d]) => {
                const pmVac = vacByPM[pm] || 0;
                const pmRpd = wdA > 0 ? d.revenue / wdA : 0;
                const pmCeil = d.revenue * 1.3;
                const pmPct = pmCeil > 0 ? Math.round((d.revenue / pmCeil) * 100) : 0;
                const ceilColor = pmPct >= 85 ? B.green : pmPct >= 70 ? B.amber : B.red;
                const isExp = !!(expandedPods?.[`${dir}-${pm}`]);
                return (
                  <div key={pm} style={{ borderBottom: `0.5px solid ${B.lgray}` }}>
                    <div
                      style={{ display: "grid", gridTemplateColumns: "140px 1fr 72px 56px 52px 20px", padding: "8px 16px", cursor: "pointer", fontFamily: "'Open Sans',sans-serif", transition: "background .1s" }}
                      onMouseEnter={(e) => e.currentTarget.style.background = B.offwhite}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                      onClick={() => setExpandedPods((p) => ({ ...p, [`${dir}-${pm}`]: !p[`${dir}-${pm}`] }))}
                    >
                      <div style={{ fontSize: 12, fontWeight: 600, color: B.black, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pm?.split(" ")[0]}</div>
                      <div style={{ display: "flex", alignItems: "center", paddingRight: 8 }}>
                        <div style={{ flex: 1, height: 10, background: B.lgray, borderRadius: 3, display: "flex", overflow: "hidden" }}>
                          <div style={{ width: `${Math.min((d.revenue / (groupTotal(dataA?.pmMap, [dir]).rev || 1)) * 65, 60)}%`, background: B.teal, height: "100%" }} />
                          <div style={{ width: `${Math.min((pmVac / 40) * 5, 8)}%`, background: B.yellow, height: "100%" }} />
                          <div style={{ width: "18%", background: "rgba(44,204,211,0.2)", height: "100%", borderTop: `1px dashed ${B.tealDash}` }} />
                        </div>
                      </div>
                      <div style={{ fontSize: 12, textAlign: "right", fontWeight: 600 }}>{fmt(pmRpd)}</div>
                      <div style={{ fontSize: 12, textAlign: "right", color: pmVac > 0 ? B.amber : "#ccc" }}>{pmVac > 0 ? `${Math.round(pmVac)}h` : "—"}</div>
                      <div style={{ fontSize: 12, textAlign: "right", fontWeight: 600, color: ceilColor }}>{pmPct}%</div>
                      <div style={{ fontSize: 13, color: "#bbb", textAlign: "right", transform: isExp ? "rotate(180deg)" : "none", transition: "transform .15s" }}>⌄</div>
                    </div>
                    {isExp && (
                      <div style={{ background: B.offwhite, padding: "10px 16px 10px 36px", borderTop: `0.5px solid ${B.lgray}`, fontFamily: "'Open Sans',sans-serif" }}>
                        {pmVac > 0 ? (
                          <div>
                            <div style={{ fontSize: 11, color: "#888", marginBottom: 8 }}>{Math.round(pmVac)} vacation hrs this month — coverage analysis available</div>
                            <button onClick={() => sendPrompt(`Run vacation coverage analysis for ${pm}'s pod in ${lA}. They have ${Math.round(pmVac)} vacation hours logged. Check which accounts are at risk and identify any backfill assignments company-wide.`)}
                              style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, padding: "5px 12px", border: `0.5px solid ${B.lgray}`, borderRadius: 6, background: "transparent", cursor: "pointer", fontFamily: "'Open Sans',sans-serif" }}>
                              ✦ Find coverage ↗
                            </button>
                          </div>
                        ) : (
                          <div style={{ fontSize: 11, color: "#bbb" }}>No vacation hours this month.</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
