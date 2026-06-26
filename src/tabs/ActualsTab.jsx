// Actuals: RPD comparison across two periods, drill All teams > Director > Pod > Account.
import { useState } from "react";
import { B } from "../constants/brand.js";
import { fmt, fmtK, fmtD, fmtH } from "../lib/format.js";
import { groupTotal } from "../lib/period.js";
import { Tag, HelpIcon, Spinner } from "../components/index.js";

export default function ActualsTab({ periodA, periodB, dataA, dataB, setAuditKey }) {
  const [drillPath, setDrillPath] = useState([]);
  const [podView, setPodView] = useState("pod");
  const wdA = periodA?.wd || 1;
  const wdB = periodB?.wd || 1;

  const pA = periodA, pB = periodB;
  const lA = pA?.label || "Period A", lB = pB?.label || "Period B";
  const dirName = drillPath.find((d) => d.type === "director")?.name;
  const podName = drillPath.find((d) => d.type === "pod")?.name;
  let rows = [], colLabel = "Team";

  if (!dirName) {
    colLabel = "Team";
    const groups = ["Aldus Behan", "Meghan Saunders"];
    rows = groups.map((g) => {
      const aG = groupTotal(dataA?.pmMap, [g]);
      const bG = groupTotal(dataB?.pmMap, [g]);
      return {
        id: g, label: g.split(" ")[0], fullLabel: g,
        revA: aG.rev, revB: bG.rev, hrsA: aG.hrs,
        rpdA: aG.rev / wdA, rpdB: bG.rev / wdB,
        creditedHrs: 0,
        drillable: true, drillType: "director",
      };
    });
  } else if (dirName && !podName) {
    colLabel = "Pod lead";
    const pms = dataA?.pmMap?.[dirName]?.pms || {};
    const pmsB = dataB?.pmMap?.[dirName]?.pms || {};
    rows = Object.entries(pms).sort((a, b) => b[1].revenue - a[1].revenue).map(([pm, d]) => {
      const dB = pmsB[pm] || { revenue: 0, hours: 0 };
      const creditKey = `${dirName}::${pm}`;
      return {
        id: pm, label: pm.split(" ")[0] + " " + pm.split(" ").slice(-1)[0], fullLabel: pm,
        revA: d.revenue, revB: dB.revenue, hrsA: d.hours,
        rpdA: d.revenue / wdA, rpdB: dB.revenue / wdB,
        creditedHrs: dataA?.creditMap?.[creditKey] || 0,
        drillable: true, drillType: "pod",
      };
    });
  } else if (podName) {
    colLabel = "Account";
    const projA = (dataA?.projList || []).filter((p) => p.pm === podName && p.grp === dirName);
    const projBMap = {};
    (dataB?.projList || []).filter((p) => p.pm === podName && p.grp === dirName).forEach((p) => { projBMap[p.projId] = (projBMap[p.projId] || 0) + (p.revenue || 0); });
    rows = projA.sort((a, b) => (b.revenue || 0) - (a.revenue || 0)).map((p) => ({
      id: p.projId, label: p.acct || p.proj || "Unknown", fullLabel: p.proj,
      revA: p.revenue || 0, revB: projBMap[p.projId] || 0, hrsA: p.hours || 0,
      rpdA: (p.revenue || 0) / wdA, rpdB: (projBMap[p.projId] || 0) / wdB,
      creditedHrs: 0, credited: p.credited, drillable: false,
    }));
  }

  let headlineRevA = 0, headlineRevB = 0, headlineHrsA = 0;
  if (!dirName) {
    const aT = groupTotal(dataA?.pmMap, ["Aldus Behan", "Meghan Saunders", "Lane Four"]);
    const bT = groupTotal(dataB?.pmMap, ["Aldus Behan", "Meghan Saunders", "Lane Four"]);
    headlineRevA = aT.rev; headlineRevB = bT.rev; headlineHrsA = aT.hrs;
  } else if (!podName) {
    const aG = groupTotal(dataA?.pmMap, [dirName]);
    const bG = groupTotal(dataB?.pmMap, [dirName]);
    headlineRevA = aG.rev; headlineRevB = bG.rev; headlineHrsA = aG.hrs;
  } else {
    rows.forEach((r) => { headlineRevA += r.revA; headlineRevB += r.revB; headlineHrsA += r.hrsA; });
  }
  const headlineRpdA = headlineRevA / wdA, headlineRpdB = headlineRevB / wdB;
  const headlineDelta = headlineRpdB > 0 ? ((headlineRpdA - headlineRpdB) / headlineRpdB * 100) : null;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 10, fontSize: 12, fontFamily: "'Open Sans',sans-serif" }}>
        <span style={{ color: B.teal, cursor: "pointer" }} onClick={() => setDrillPath([])}>All teams</span>
        {dirName && <>
          <span style={{ color: "#ccc" }}>›</span>
          <span style={{ color: podName ? B.teal : B.black, fontWeight: podName ? 400 : 600, cursor: podName ? "pointer" : "default" }}
            onClick={() => podName && setDrillPath([{ type: "director", name: dirName }])}>{dirName.split(" ")[0]}</span>
        </>}
        {podName && <>
          <span style={{ color: "#ccc" }}>›</span>
          <span style={{ color: B.black, fontWeight: 600 }}>{podName.split(" ")[0]}</span>
        </>}
      </div>

      {dataA && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 10, marginBottom: 14 }}>
          {[
            { label: `${lA} RPD`, val: fmt(headlineRpdA), sub: `${fmtK(headlineRevA)} revenue`, help: "Revenue per day", calc: `${lA} revenue ÷ ${wdA} working days`, ak: "rpd" },
            { label: `${lB} RPD`, val: fmt(headlineRpdB), sub: `${fmtK(headlineRevB)} revenue`, help: "Revenue per day", calc: `${lB} revenue ÷ ${wdB} working days`, ak: "rpd" },
            { label: `${lA} vs ${lB}`, val: headlineDelta !== null ? fmtD(headlineDelta) : "—", valColor: headlineDelta === null ? "#aaa" : headlineDelta >= 0 ? B.green : B.red, sub: "RPD variance", help: "RPD variance", calc: "(A RPD − B RPD) ÷ B RPD × 100", ak: "variance" },
            { label: `${lA} hours`, val: fmtH(headlineHrsA), sub: `${fmtK(headlineRevB)} rev in ${lB}`, help: "Billable hours", calc: "Approved billable timecard splits" },
          ].map(({ label, val, sub, valColor, help, calc, ak }, i) => (
            <div key={i} style={{ background: B.offwhite, borderRadius: 8, padding: "11px 13px", fontFamily: "'Open Sans',sans-serif" }}>
              <div style={{ fontSize: 10, color: "#888", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4, display: "flex", alignItems: "center" }}>
                {label} <HelpIcon tip={help} calc={calc} auditKey={ak} onAudit={setAuditKey} />
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: valColor || B.black, lineHeight: 1, fontFamily: "'Poppins',sans-serif" }}>{val}</div>
              <div style={{ fontSize: 11, color: "#aaa", marginTop: 3 }}>{sub}</div>
            </div>
          ))}
        </div>
      )}

      {dirName && !podName && (
        <div style={{ display: "flex", gap: 6, marginBottom: 12, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "#aaa", fontFamily: "'Open Sans',sans-serif" }}>View by:</span>
          {["pod", "project"].map((v) => (
            <button key={v} onClick={() => setPodView(v)} style={{
              fontSize: 11, padding: "3px 12px", borderRadius: 20, cursor: "pointer", fontFamily: "'Open Sans',sans-serif",
              background: podView === v ? B.black : "transparent", color: podView === v ? B.white : "#888",
              border: `0.5px solid ${podView === v ? B.black : B.lgray}`,
            }}>{v === "pod" ? "By pod" : "By project"}</button>
          ))}
        </div>
      )}

      {!dataA ? <Spinner msg={`Loading ${lA}...`} /> : (
        <div style={{ background: B.white, border: `0.5px solid ${B.lgray}`, borderRadius: 12, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 88px 88px 88px 80px 60px 56px 28px", padding: "6px 14px", background: B.offwhite, borderBottom: `0.5px solid ${B.lgray}` }}>
            {[colLabel, `${lA} rev`, `${lB} rev`, `${lA} RPD`, `${lA} vs ${lB}`, "Days A/B", `${lA} hrs`, "↑↓"].map((h, i) => (
              <div key={i} style={{ fontSize: 10, color: "#aaa", textTransform: "uppercase", letterSpacing: ".04em", fontFamily: "'Open Sans',sans-serif", textAlign: i > 0 ? "right" : "left" }}>{h}</div>
            ))}
          </div>
          {(podView === "project" && dirName && !podName
            ? (dataA?.projList || []).filter((p) => p.grp === dirName).sort((a, b) => (b.revenue || 0) - (a.revenue || 0)).map((p) => {
              const bP = (dataB?.projList || []).find((x) => x.projId === p.projId);
              return {
                id: p.projId, label: p.acct || p.proj, fullLabel: p.proj,
                revA: p.revenue || 0, revB: bP?.revenue || 0, hrsA: p.hours || 0,
                rpdA: (p.revenue || 0) / wdA, rpdB: (bP?.revenue || 0) / wdB,
                credited: p.credited, drillable: false,
              };
            })
            : rows
          ).map((row, i) => {
            const delta = row.rpdB > 0 ? ((row.rpdA - row.rpdB) / row.rpdB * 100) : null;
            const dColor = delta === null ? "#aaa" : delta >= 0 ? B.green : B.red;
            const trend = delta === null ? "—" : delta >= 2 ? "▲" : delta <= -2 ? "▼" : "→";
            const tColor = delta === null ? "#ccc" : delta >= 2 ? B.green : delta <= -2 ? B.red : "#aaa";
            return (
              <div key={row.id || i}
                onClick={() => { if (!row.drillable) return; if (row.drillType === "director") setDrillPath([{ type: "director", name: row.fullLabel }]); else if (row.drillType === "pod") setDrillPath((p) => [...p, { type: "pod", name: row.fullLabel }]); }}
                style={{ display: "grid", gridTemplateColumns: "2fr 88px 88px 88px 80px 60px 56px 28px", padding: "9px 14px", borderBottom: `0.5px solid ${B.lgray}`, cursor: row.drillable ? "pointer" : "default", fontFamily: "'Open Sans',sans-serif", transition: "background .1s" }}
                onMouseEnter={(e) => { if (row.drillable) e.currentTarget.style.background = B.offwhite; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: row.drillable ? B.teal : B.black, display: "flex", alignItems: "center", gap: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {row.label}
                  {row.drillable && <span style={{ fontSize: 10, color: "#ccc" }}>›</span>}
                  {row.credited && <Tag color={B.purpleTx} bg={B.purpleBg}>credited</Tag>}
                </div>
                <div style={{ fontSize: 12, textAlign: "right" }}>{fmtK(row.revA)}</div>
                <div style={{ fontSize: 12, textAlign: "right", color: "#aaa" }}>{fmtK(row.revB)}</div>
                <div style={{ fontSize: 12, fontWeight: 600, textAlign: "right" }}>{fmt(row.rpdA)}</div>
                <div style={{ fontSize: 12, fontWeight: 600, textAlign: "right", color: dColor }}>{delta !== null ? fmtD(delta) : "—"}</div>
                <div style={{ fontSize: 11, textAlign: "right", color: "#aaa" }}>{wdA}/{wdB}</div>
                <div style={{ fontSize: 12, textAlign: "right", color: "#888" }}>{fmtH(row.hrsA)}</div>
                <div style={{ fontSize: 14, textAlign: "center", color: tColor }}>{trend}</div>
              </div>
            );
          })}

          {dirName && !podName && (() => {
            const totalCredit = Object.entries(dataA?.creditMap || {}).filter(([k]) => k.startsWith(dirName)).reduce((s, [, v]) => s + v, 0);
            if (totalCredit === 0) return null;
            return (
              <div style={{ padding: "6px 14px", background: "#FAFAFA", borderTop: `0.5px solid ${B.lgray}`, display: "flex", alignItems: "center", gap: 8, fontFamily: "'Open Sans',sans-serif" }}>
                <span style={{ fontSize: 10, color: "#aaa", textTransform: "uppercase", letterSpacing: ".04em" }}>Credited time</span>
                <Tag color={B.purpleTx} bg={B.purpleBg}>{fmtH(totalCredit)} hrs</Tag>
                <HelpIcon tip="Credited hours" calc="Approved timecards with pse__Time_Credited__c = true. Shown separately — not included in RPD." auditKey="rpd" onAudit={setAuditKey} />
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
