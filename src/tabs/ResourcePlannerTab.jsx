// Resource planner: people x weeks committed-hours grid, forward 16 weeks, for the
// Aldus + Meghan directorates. Rows nest director -> pod -> person (collapsible,
// same as Utilization). Each cell = committed scheduled hours that week, colored
// vs that week's working-day capacity. Read-only first pass.
//
// NOTE: committed hours are summed raw from overlapping PSA assignments, so people
// with multiple concurrent 40h placeholder assignments read well over 100%. That
// over-capacity signal is intentional (it surfaces assignments that need right-
// sizing in Salesforce); the per-cell assignment count is in the hover title.
import { useState, useEffect } from "react";
import { B } from "../constants/brand.js";
import { Spinner } from "../components/index.js";
import { useResourcePlanner } from "../hooks/useResourcePlanner.js";
import { DIRECTORS, DIRS } from "../constants/teams.js";

const NAME_W = 168, CELL_W = 52;

export default function ResourcePlannerTab({ H, hState }) {
  const { weeks, capacity, cells, loading, loadMsg, load } = useResourcePlanner(H, hState);
  const [expanded, setExpanded] = useState({});

  useEffect(() => { if (!cells) load(); }, []);

  // Cell color vs that week's capacity. Over capacity = red (overbooked),
  // at capacity = green, under = available (light blue), empty = muted.
  const cellColor = (h, cap) => {
    if (!h) return { bg: "transparent", tx: "#ccc" };
    const r = cap > 0 ? h / cap : 0;
    if (r > 1.05) return { bg: B.redBg, tx: B.redTx };
    if (r >= 0.85) return { bg: B.greenBg, tx: B.greenTx };
    return { bg: B.blueBg, tx: B.blueTx };
  };

  if (loading || !cells) return <Spinner msg={loadMsg || "Loading resource planner..."} />;

  // Sum a set of members' cells into one row of {h, n} per week.
  const sumRows = (members) => weeks.map((_, i) => {
    let h = 0, n = 0;
    members.forEach((m) => { const c = cells[m]?.[i]; if (c) { h += c.h; n += c.n; } });
    return { h, n };
  });

  const cols = `${NAME_W}px repeat(${weeks.length}, ${CELL_W}px)`;
  const dirsInScope = (H?.directors || []).filter((d) => DIRECTORS.includes(d.name));

  const Cell = ({ c, cap, bold }) => {
    const col = cellColor(c.h, cap);
    return (
      <div title={c.h ? `${Math.round(c.h)}h committed from ${c.n} assignment${c.n === 1 ? "" : "s"} (capacity ${cap}h)` : `No commitments (capacity ${cap}h)`}
        style={{ textAlign: "center", fontSize: 11, padding: "5px 0", background: col.bg, color: col.tx, fontWeight: bold ? 700 : 400, fontFamily: bold ? "'Poppins',sans-serif" : "'Open Sans',sans-serif", borderRight: `0.5px solid ${B.lgray}` }}>
        {c.h ? Math.round(c.h) : "—"}
      </div>
    );
  };

  const Row = ({ label, count, row, capRow, level, gkey, onToggle, isExp }) => (
    <div style={{ display: "grid", gridTemplateColumns: cols, borderBottom: `0.5px solid ${B.lgray}`, alignItems: "center", background: level === 0 ? B.offwhite : level === 1 ? "#F0FAFA" : B.white }}>
      <div onClick={onToggle} style={{ position: "sticky", left: 0, zIndex: 1, background: "inherit", padding: `7px 10px 7px ${10 + level * 14}px`, display: "flex", alignItems: "center", gap: 5, cursor: onToggle ? "pointer" : "default", borderRight: `0.5px solid ${B.lgray}`, overflow: "hidden" }}>
        {onToggle && <span style={{ fontSize: 9, color: "#bbb", transform: isExp ? "rotate(90deg)" : "none", display: "inline-block" }}>▶</span>}
        <span style={{ fontSize: level < 2 ? 12 : 11, fontWeight: level < 2 ? 700 : 400, fontFamily: level < 2 ? "'Poppins',sans-serif" : "'Open Sans',sans-serif", color: level === 1 ? B.teal : B.black, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
        {count != null && <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 5, background: B.lgray, color: "#888" }}>{count}</span>}
      </div>
      {row.map((c, i) => <Cell key={i} c={c} cap={capRow[i]} bold={level < 2} />)}
    </div>
  );

  const tableRows = [];
  dirsInScope.forEach((dir) => {
    const dKey = dir.name;
    const dExp = expanded[dKey] ?? true;
    const dMembers = [...(dir.directMembers || []), ...(dir.pods || []).flatMap((p) => p.members || [])];
    const dCap = weeks.map((_, i) => dMembers.length * capacity[i]);
    tableRows.push(<Row key={dKey} label={dir.name} count={dMembers.length} row={sumRows(dMembers)} capRow={dCap} level={0} gkey={dKey} isExp={dExp}
      onToggle={() => setExpanded((e) => ({ ...e, [dKey]: !(e[dKey] ?? true) }))} />);
    if (!dExp) return;
    // Pods (in the teams.js order) then any direct members.
    const podNames = DIRS[dir.name]?.pods || (dir.pods || []).map((p) => p.name);
    podNames.forEach((pn) => {
      const pod = (dir.pods || []).find((p) => p.name === pn);
      const members = pod?.members || [];
      if (!members.length) return;
      const pKey = `${dKey}:::${pn}`;
      const pExp = expanded[pKey] ?? false;
      const pCap = weeks.map((_, i) => members.length * capacity[i]);
      tableRows.push(<Row key={pKey} label={pn} count={members.length} row={sumRows(members)} capRow={pCap} level={1} gkey={pKey} isExp={pExp}
        onToggle={() => setExpanded((e) => ({ ...e, [pKey]: !(e[pKey] ?? false) }))} />);
      if (!pExp) return;
      members.forEach((m) => {
        const short = m.split(" ")[0] + " " + (m.split(" ").slice(-1)[0] || "");
        tableRows.push(<Row key={pKey + "::" + m} label={short} row={cells[m] || weeks.map(() => ({ h: 0, n: 0 }))} capRow={capacity} level={2} />);
      });
    });
    const direct = dir.directMembers || [];
    if (direct.length) {
      const pKey = `${dKey}:::__direct`;
      const pExp = expanded[pKey] ?? false;
      const pCap = weeks.map((_, i) => direct.length * capacity[i]);
      tableRows.push(<Row key={pKey} label={dir.name.split(" ")[0] + " (direct)"} count={direct.length} row={sumRows(direct)} capRow={pCap} level={1} gkey={pKey} isExp={pExp}
        onToggle={() => setExpanded((e) => ({ ...e, [pKey]: !(e[pKey] ?? false) }))} />);
      if (pExp) direct.forEach((m) => {
        const short = m.split(" ")[0] + " " + (m.split(" ").slice(-1)[0] || "");
        tableRows.push(<Row key={pKey + "::" + m} label={short} row={cells[m] || weeks.map(() => ({ h: 0, n: 0 }))} capRow={capacity} level={2} />);
      });
    }
  });

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "'Poppins',sans-serif" }}>Resource planner</div>
        <button onClick={load} style={{ fontSize: 11, padding: "5px 10px", border: `0.5px solid ${B.lgray}`, borderRadius: 6, background: "transparent", cursor: "pointer" }}>↺ Reload</button>
      </div>

      <div style={{ fontSize: 11, color: "#888", background: B.offwhite, borderRadius: 8, padding: "6px 12px", marginBottom: 10, fontFamily: "'Open Sans',sans-serif" }}>
        Committed scheduled hours per week, {weeks[0].label} to {weeks[weeks.length - 1].label} ({weeks.length} weeks). Aldus + Meghan only. Scheduled + billable assignments.
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 10, fontSize: 10, color: "#888", fontFamily: "'Open Sans',sans-serif", flexWrap: "wrap" }}>
        {[["Under capacity", B.blueBg, B.blueTx], ["At capacity", B.greenBg, B.greenTx], ["Over capacity", B.redBg, B.redTx]].map(([l, bg, tx]) => (
          <span key={l} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ width: 11, height: 11, borderRadius: 3, background: bg, border: `0.5px solid ${tx}` }} />{l}</span>
        ))}
      </div>

      <div style={{ overflowX: "auto", border: `0.5px solid ${B.lgray}`, borderRadius: 10 }}>
        <div style={{ minWidth: NAME_W + weeks.length * CELL_W }}>
          {/* Header: week labels + capacity */}
          <div style={{ display: "grid", gridTemplateColumns: cols, background: B.white, borderBottom: `1px solid ${B.lgray}` }}>
            <div style={{ position: "sticky", left: 0, zIndex: 2, background: B.white, padding: "6px 10px", fontSize: 10, color: "#aaa", textTransform: "uppercase", letterSpacing: ".04em", borderRight: `0.5px solid ${B.lgray}` }}>Person</div>
            {weeks.map((w, i) => (
              <div key={w.iso} style={{ textAlign: "center", padding: "5px 0", borderRight: `0.5px solid ${B.lgray}` }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: B.black, fontFamily: "'Poppins',sans-serif" }}>{w.label}</div>
                <div style={{ fontSize: 8, color: "#bbb" }}>{capacity[i]}h</div>
              </div>
            ))}
          </div>
          {tableRows}
        </div>
      </div>

      <div style={{ marginTop: 8, fontSize: 10, color: "#aaa", fontFamily: "'Open Sans',sans-serif" }}>
        Capacity = working days that week × 8h (CA holidays applied). Cell = summed committed hours; hover for the assignment count. Group rows roll up to (members × weekly capacity).
      </div>
    </div>
  );
}
