// Utilization: billable / credited / vacation hours vs capacity, grouped by
// director, pod, or person. Data comes from useUtilization; this tab owns the
// period selector, grouping view, sort, and expand/collapse state.
import { useState, useEffect } from "react";
import { B, MONTHS } from "../constants/brand.js";
import { ac, ini, fmtK } from "../lib/format.js";
import { Spinner } from "../components/index.js";
import { useUtilization } from "../hooks/useUtilization.js";

export default function UtilizationTab({ H, hState }) {
  const today = new Date();
  const { uData, loading, load } = useUtilization(H, hState);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [view, setView] = useState("director");
  const [sort, setSort] = useState("name");
  const [sortDir, setSortDir] = useState(1);
  const [expanded, setExpanded] = useState({});

  const ucol = (p) => p >= 90 ? { bg: B.greenBg, tx: B.greenTx } : p >= 70 ? { bg: B.amberBg, tx: B.amberTx } : { bg: B.redBg, tx: B.redTx };

  useEffect(() => { load(year, month); }, []);

  const sortFn = (a, b) => {
    if (sort === "util") return (b.util - a.util) * sortDir;
    if (sort === "hrs") return (b.b - a.b) * sortDir;
    if (sort === "rev") return (b.rev - a.rev) * sortDir;
    return a.name.localeCompare(b.name) * sortDir;
  };
  const toggleSort = (f) => { if (sort === f) setSortDir((d) => d * -1); else { setSort(f); setSortDir(1); } };
  const sa = (f) => sort === f ? (sortDir === 1 ? " ↑" : " ↓") : "";

  const cols = "160px 68px 1fr 58px 58px 58px 68px";
  const thS = { fontSize: 9, color: "#aaa", textTransform: "uppercase", letterSpacing: ".04em", padding: "6px 12px", cursor: "pointer", whiteSpace: "nowrap", fontFamily: "'Open Sans',sans-serif" };

  if (loading) return <Spinner msg="Loading utilization data..." />;
  if (!uData) return (
    <div style={{ textAlign: "center", padding: 40 }}>
      <button onClick={() => load(year, month)} style={{ fontSize: 12, padding: "8px 20px", background: B.teal, color: B.white, border: "none", borderRadius: 6, cursor: "pointer" }}>Load utilization</button>
    </div>
  );

  const { people, wd, wde, cap, m, y } = uData;
  const lbl = MONTHS[m - 1] + " " + y;
  const tB = people.reduce((s, p) => s + p.b, 0), tC = people.reduce((s, p) => s + p.cr, 0), tV = people.reduce((s, p) => s + p.v, 0), tR = people.reduce((s, p) => s + p.rev, 0);
  const tCap = people.length * cap, tU = tCap > 0 ? ((tB + tC) / tCap * 100) : 0;
  const tu = ucol(tU);

  const bD = {}, bP = {};
  people.forEach((p) => {
    const dn = p.dirName || "Unassigned", pk = dn + ":::" + (p.podName || "Direct");
    if (!bD[dn]) bD[dn] = { b: 0, cr: 0, v: 0, rev: 0, n: 0 };
    bD[dn].b += p.b; bD[dn].cr += p.cr; bD[dn].v += p.v; bD[dn].rev += p.rev; bD[dn].n++;
    if (!bP[pk]) bP[pk] = { name: p.podName || "Direct", dir: dn, b: 0, cr: 0, v: 0, rev: 0, n: 0 };
    bP[pk].b += p.b; bP[pk].cr += p.cr; bP[pk].v += p.v; bP[pk].rev += p.rev; bP[pk].n++;
  });

  const sorted = [...people].sort(sortFn);

  const Bar = ({ b, cr, v, total }) => {
    const bP = total > 0 ? Math.min((b / total) * 100, 100) : 0, crP = total > 0 ? Math.min((cr / total) * 100, 8) : 0, vP = total > 0 ? Math.min((v / total) * 100, 20) : 0;
    return (
      <div style={{ padding: "0 8px", display: "flex", alignItems: "center" }}>
        <div style={{ flex: 1, height: 6, background: B.lgray, borderRadius: 3, display: "flex", overflow: "hidden" }}>
          <div style={{ width: `${bP}%`, background: B.teal, height: "100%" }} />
          <div style={{ width: `${crP}%`, background: B.purpleBg, height: "100%" }} />
          <div style={{ width: `${vP}%`, background: B.yellow, height: "100%" }} />
        </div>
      </div>
    );
  };

  const PersonRow = ({ p, indent }) => {
    const c = ucol(p.util), a = ac(p.name);
    return (
      <div style={{ display: "grid", gridTemplateColumns: cols, padding: `6px 12px 6px ${indent ? "26px" : "12px"}`, borderBottom: `0.5px solid ${B.lgray}`, alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, overflow: "hidden" }}>
          <div style={{ width: 18, height: 18, borderRadius: "50%", background: a.bg, color: a.tx, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700, flexShrink: 0 }}>{ini(p.name)}</div>
          <span style={{ fontSize: 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "'Open Sans',sans-serif" }}>{p.name.split(" ")[0]} {p.name.split(" ").slice(-1)[0]}</span>
        </div>
        <div style={{ textAlign: "right" }}><span style={{ fontSize: 11, fontWeight: 700, padding: "2px 6px", borderRadius: 5, background: c.bg, color: c.tx }}>{Math.round(p.util)}%</span></div>
        <Bar b={p.b} cr={p.cr} v={p.v} total={cap} />
        <div style={{ textAlign: "right", fontSize: 11, fontFamily: "'Open Sans',sans-serif" }}>{Math.round(p.b)}</div>
        <div style={{ textAlign: "right", fontSize: 11, color: "#888", fontFamily: "'Open Sans',sans-serif" }}>{Math.round(p.cr) || "—"}</div>
        <div style={{ textAlign: "right", fontSize: 11, color: p.v > 0 ? B.amber : "#ccc", fontFamily: "'Open Sans',sans-serif" }}>{Math.round(p.v) || "—"}</div>
        <div style={{ textAlign: "right", fontSize: 11, fontFamily: "'Open Sans',sans-serif" }}>{fmtK(p.rev)}</div>
      </div>
    );
  };

  const GroupRow = ({ name, d, util, ppl2, gkey }) => {
    const c = ucol(util), dCap = d.n * cap;
    const isExp = expanded[gkey];
    return (
      <div style={{ borderBottom: `0.5px solid ${B.lgray}` }}>
        <div onClick={() => setExpanded((e) => ({ ...e, [gkey]: !e[gkey] }))} style={{ display: "grid", gridTemplateColumns: cols, padding: "8px 12px", background: B.offwhite, cursor: "pointer", alignItems: "center" }}>
          <div style={{ fontSize: 12, fontWeight: 700, fontFamily: "'Poppins',sans-serif", display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: 10, color: "#bbb", transform: isExp ? "rotate(90deg)" : "none", transition: "transform .15s", display: "inline-block" }}>▶</span>
            {name.trim()}
            <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 5, background: B.lgray, color: "#888" }}>{d.n}</span>
          </div>
          <div style={{ textAlign: "right", fontSize: 12, fontWeight: 700, color: c.tx, fontFamily: "'Poppins',sans-serif" }}>{Math.round(util)}%</div>
          <Bar b={d.b} cr={d.cr} v={d.v} total={dCap} />
          <div style={{ textAlign: "right", fontSize: 11 }}>{Math.round(d.b)}</div>
          <div style={{ textAlign: "right", fontSize: 11, color: "#888" }}>{Math.round(d.cr) || "—"}</div>
          <div style={{ textAlign: "right", fontSize: 11, color: d.v > 0 ? B.amber : "#ccc" }}>{Math.round(d.v) || "—"}</div>
          <div style={{ textAlign: "right", fontSize: 11 }}>{fmtK(d.rev)}</div>
        </div>
        {isExp && ppl2.map((p) => <PersonRow key={p.name} p={p} indent />)}
      </div>
    );
  };

  let tableRows;
  if (view === "director") {
    tableRows = ["Aldus Behan", "Meghan Saunders", "Unassigned"].filter((dn) => bD[dn]).map((dn) => {
      const d = bD[dn], dc = d.n * cap, du = dc > 0 ? ((d.b + d.cr) / dc * 100) : 0;
      return <GroupRow key={dn} name={dn} d={d} util={du} ppl2={sorted.filter((p) => (p.dirName || "Unassigned") === dn)} gkey={dn} />;
    });
  } else if (view === "pod") {
    tableRows = ["Aldus Behan", "Meghan Saunders", "Unassigned"].filter((dn) => bD[dn]).flatMap((dn) => {
      const header = <div key={"hdr-" + dn} style={{ background: "#F0FAFA", borderBottom: `0.5px solid ${B.lgray}`, borderTop: `0.5px solid ${B.lgray}`, padding: "5px 12px", fontSize: 10, fontWeight: 700, fontFamily: "'Poppins',sans-serif", color: B.teal }}>{dn.split(" ")[0]}</div>;
      const pods = Object.entries(bP).filter(([k]) => k.startsWith(dn + ":::")).map(([k, pod]) => {
        const pc = pod.n * cap, pu = pc > 0 ? ((pod.b + pod.cr) / pc * 100) : 0;
        return <GroupRow key={k} name={"  " + pod.name} d={pod} util={pu} ppl2={sorted.filter((p) => (p.dirName || "Unassigned") === dn && (p.podName || "Direct") === pod.name)} gkey={k} />;
      });
      return [header, ...pods];
    });
  } else {
    tableRows = sorted.map((p) => <PersonRow key={p.name} p={p} indent={false} />);
  }

  const monthOpts = [];
  for (let i = 0; i < 24; i++) {
    let mo = today.getMonth() + 1 - i, yr = today.getFullYear();
    while (mo <= 0) { mo += 12; yr--; }
    monthOpts.push({ value: `${yr}-${mo}`, label: `${MONTHS[mo - 1]} ${yr}`, yr, mo });
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "'Poppins',sans-serif" }}>Utilization</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <select value={`${year}-${month}`} onChange={(e) => { const [yr, mo] = e.target.value.split("-").map(Number); setYear(yr); setMonth(mo); load(yr, mo); }}
            style={{ fontSize: 11, padding: "4px 8px", border: `0.5px solid ${B.lgray}`, borderRadius: 6, background: B.white, fontFamily: "'Open Sans',sans-serif" }}>
            {monthOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <div style={{ display: "flex", border: `0.5px solid ${B.lgray}`, borderRadius: 6, overflow: "hidden" }}>
            {["director", "pod", "person"].map((v) => (
              <button key={v} onClick={() => setView(v)} style={{ fontSize: 10, padding: "4px 9px", background: view === v ? B.teal : "transparent", color: view === v ? B.white : "#888", border: "none", cursor: "pointer" }}>{v[0].toUpperCase() + v.slice(1)}</button>
            ))}
          </div>
          <button onClick={() => load(year, month)} style={{ fontSize: 11, padding: "5px 10px", border: `0.5px solid ${B.lgray}`, borderRadius: 6, background: "transparent", cursor: "pointer" }}>↺</button>
        </div>
      </div>

      {wde < wd && <div style={{ fontSize: 10, color: "#888", background: B.offwhite, borderRadius: 7, padding: "5px 10px", marginBottom: 10 }}>📅 {lbl} · {wde} of {wd} working days elapsed · Utilization vs capacity to date</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 8, marginBottom: 14 }}>
        {[
          { label: "Team utilization", val: Math.round(tU) + "%", sub: `${lbl} · ${wde} days`, valColor: tu.tx },
          { label: "Billable hours", val: Math.round(tB).toLocaleString(), sub: `+ ${Math.round(tC)} credited` },
          { label: "Vacation hours", val: Math.round(tV).toLocaleString(), sub: `${people.filter((p) => p.v > 0).length} people out`, valColor: B.amber },
          { label: "Revenue to date", val: fmtK(tR), sub: "CAD · approved" },
        ].map(({ label, val, sub, valColor }) => (
          <div key={label} style={{ background: B.offwhite, borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ fontSize: 10, color: "#888", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 3, fontFamily: "'Open Sans',sans-serif" }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Poppins',sans-serif", lineHeight: 1, color: valColor || B.black }}>{val}</div>
            <div style={{ fontSize: 10, color: "#aaa", marginTop: 2, fontFamily: "'Open Sans',sans-serif" }}>{sub}</div>
          </div>
        ))}
      </div>

      <div style={{ background: B.white, border: `0.5px solid ${B.lgray}`, borderRadius: 10, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: cols, background: B.offwhite, borderBottom: `0.5px solid ${B.lgray}` }}>
          <div style={{ ...thS }} onClick={() => toggleSort("name")}>Name{sa("name")}</div>
          <div style={{ ...thS, textAlign: "right" }} onClick={() => toggleSort("util")}>Util%{sa("util")}</div>
          <div style={{ ...thS }}>
            <span style={{ display: "inline-flex", gap: 8, fontSize: 9 }}>
              <span>▓ Billable</span>
              <span style={{ opacity: .5 }}>▓ Credited</span>
              <span style={{ color: B.amber }}>▓ Vacation</span>
            </span>
          </div>
          <div style={{ ...thS, textAlign: "right" }} onClick={() => toggleSort("hrs")}>Hrs{sa("hrs")}</div>
          <div style={{ ...thS, textAlign: "right" }}>Credit</div>
          <div style={{ ...thS, textAlign: "right" }}>Vac</div>
          <div style={{ ...thS, textAlign: "right" }} onClick={() => toggleSort("rev")}>Rev{sa("rev")}</div>
        </div>
        {tableRows}
      </div>

      <div style={{ marginTop: 8, fontSize: 10, color: "#aaa", fontFamily: "'Open Sans',sans-serif" }}>
        Capacity = {wde} elapsed working days × 8 hrs · CA holidays applied · Approved timecards only
      </div>
    </div>
  );
}
