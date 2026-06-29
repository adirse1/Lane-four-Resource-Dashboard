// Resource planner: weekly capacity heatmap, forward 16 weeks, Aldus + Meghan.
// Rows nest director -> pod -> person -> project. Committed hours are READ-ONLY
// (heatmap-shaded by utilization = hours / team capacity). The scenario overlay
// (local React state only, never saved to Salesforce) adds editable hypothetical
// people / projects, fill-right drag, and overlay-only pod reassignment; overlay
// sums into the heatmap. See useResourcePlanner.
//
// Visual design follows the high-fidelity heatmap handoff, adapted to Lane Four
// brand: Poppins/Open Sans, brand teal accents. The green/blue/red capacity scale
// is kept as a functional data visualization.
import { useState, useEffect, useRef } from "react";
import { B } from "../constants/brand.js";
import { Spinner } from "../components/index.js";
import { useResourcePlanner } from "../hooks/useResourcePlanner.js";
import { exportPlan } from "../lib/exportPlan.js";
import { DIRECTORS, DIRS } from "../constants/teams.js";

const DIRECT = "(direct)";
const OV = B.orange;                    // overlay accent (brand red/orange)
const OV_BG = "rgba(253,210,110,0.22)"; // overlay row tint (brand yellow)
const OV_FILL = "rgba(255,92,57,0.18)";
const TEAL_TX = "#0B8F95";              // readable brand teal for text/accents
const HEAD = "'Poppins',sans-serif", BODY = "'Open Sans',sans-serif";
// Neutral chrome tokens from the design handoff.
const T = {
  ink: "#0f172a", ink2: "#334155", muted: "#64748b", proj: "#7c8794", cap: "#aab4c0",
  caps: "#94a3b8", faint: "#9aa4b0", empty: "#cdd5df", over: "#be123c",
  border: "#e7eaee", cellline: "#f1f3f5", rowline: "#eef1f4",
  groupBg: "#f7f9fb", groupHover: "#f1f6f9", memberHover: "#f3faf8",
  chipG: "#e4e9ef", chipGtx: "#475569", chipM: "#eef2f6", chipMtx: "#8794a3",
};
const EDGE = "6px 0 8px -8px rgba(15,23,42,.16)";

export default function ResourcePlannerTab({ H, hState }) {
  const {
    weeks, capacity, data, loading, loadMsg, error, load,
    overlayPeople, overlayAsgs, overlayHoursFor, overlayMoves,
    addOverlayPerson, removeOverlayPerson, addOverlayAsg, setOverlayCell, removeOverlayAsg,
    moveOverlayPerson, resetOverlayMove, saveScenario, listScenarios, loadScenario,
    projForecast, setForecastCell, resetForecast,
  } = useResourcePlanner(H, hState);

  // Route an edit to the right state: "ov:<asgId>" = overlay assignment cell,
  // "pf:<person>||<project>" = forecast override on a committed assignment.
  const dispatchEdit = (editId, i, val) => {
    if (editId.startsWith("ov:")) setOverlayCell(editId.slice(3), i, val);
    else if (editId.startsWith("pf:")) { const rest = editId.slice(3), s = rest.indexOf("||"); setForecastCell(rest.slice(0, s), rest.slice(s + 2), i, val); }
  };

  const [expanded, setExpanded] = useState({});
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", dir: "Aldus Behan", pod: "" });
  const [scenStatus, setScenStatus] = useState("");
  const [scenList, setScenList] = useState(null);
  const [density, setDensity] = useState("Comfortable");
  const [colorMode, setColorMode] = useState("Diverging");
  const [showAvail, setShowAvail] = useState(true);
  const [hoverRow, setHoverRow] = useState(null);
  const [dragFill, setDragFill] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const dragFillRef = useRef(null);
  const dragKeyRef = useRef(null);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const up = () => {
      const df = dragFillRef.current;
      if (df) { const lo = Math.min(df.from, df.to), hi = Math.max(df.from, df.to); for (let c = lo; c <= hi; c++) dispatchEdit(df.id, c, df.val); }
      dragFillRef.current = null; setDragFill(null);
    };
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, [setOverlayCell, setForecastCell]);
  const setDrag = (v) => { const nv = typeof v === "function" ? v(dragFillRef.current) : v; dragFillRef.current = nv; setDragFill(nv); };

  const toggle = (k, def) => setExpanded((e) => ({ ...e, [k]: !(e[k] ?? def) }));

  // Heatmap (design math): u = hours / capacity. null -> empty cell.
  const heat = (u) => {
    if (u === null) return { bg: "transparent", color: T.empty, weight: 400 };
    if (colorMode === "Off") {
      if (u > 1.05) return { bg: "transparent", color: T.over, weight: 700 };
      if (u >= 0.85) return { bg: "transparent", color: "#047857", weight: 600 };
      return { bg: "transparent", color: showAvail ? "#2563eb" : T.muted, weight: 400 };
    }
    if (u > 1.05) { const t = Math.min((u - 1.05) / 0.45, 1), L = 92 - t * 14; return { bg: `hsl(3 80% ${L}%)`, color: "#9f1239", weight: 600 }; }
    if (u >= 0.85) { const t = (u - 0.85) / 0.2, L = 90 - t * 6; return { bg: `hsl(158 52% ${L}%)`, color: "#065f46", weight: 500 }; }
    if (colorMode === "Sequential") { const t = Math.max(Math.min(u / 0.85, 1), 0), L = 98 - t * 10; return { bg: `hsl(158 42% ${L}%)`, color: "#3f6212", weight: 400 }; }
    if (!showAvail) return { bg: "transparent", color: T.muted, weight: 400 };
    const t = Math.min(Math.max((0.85 - u) / 0.85, 0), 1), L = 98 - t * 11; return { bg: `hsl(212 66% ${L}%)`, color: "#1e3a8a", weight: 400 };
  };

  if (error) return (
    <div style={{ textAlign: "center", padding: 40 }}>
      <div style={{ fontSize: 12, color: B.redTx, background: B.redBg, borderRadius: 8, padding: "10px 14px", marginBottom: 14, display: "inline-block" }}>Could not load assignments: {error}</div>
      <div><button onClick={load} style={{ fontSize: 12, padding: "8px 20px", background: B.teal, color: B.white, border: "none", borderRadius: 6, cursor: "pointer" }}>Retry</button></div>
    </div>
  );
  if (loading || !data) return <Spinner msg={loadMsg || "Loading resource planner..."} />;

  const rowH = density === "Compact" ? 30 : 38;
  const numFs = density === "Compact" ? "12px" : "13px";
  const GT = `232px repeat(${weeks.length}, minmax(64px, 1fr))`;
  const z = () => weeks.map(() => 0);
  // Effective committed hours for a project that week = forecast override if set,
  // else the Salesforce value. Person committed total rolls up from these.
  const effProj = (personKey, proj, i) => { const o = projForecast[`${personKey}||${proj.proj}`]; return o && o[i] != null ? o[i] : (proj.cells[i] || 0); };
  const committedOf = (m) => { const projs = data[m]?.projects || []; return weeks.map((_, i) => projs.reduce((s, p) => s + effProj(m, p, i), 0)); };

  // Build all person units (real + hypothetical), placed by overlay move if any.
  const allUnits = [];
  const dirsInScope = (H?.directors || []).filter((d) => DIRECTORS.includes(d.name));
  dirsInScope.forEach((dir) => {
    (dir.directMembers || []).forEach((m) => allUnits.push({ key: m, name: m, hypo: false, baseDir: dir.name, basePod: DIRECT }));
    (dir.pods || []).forEach((p) => (p.members || []).forEach((m) => allUnits.push({ key: m, name: m, hypo: false, baseDir: dir.name, basePod: p.name })));
  });
  overlayPeople.forEach((p) => allUnits.push({ key: p.id, name: p.name, hypo: true, removable: true, baseDir: p.dir, basePod: p.pod || DIRECT }));
  allUnits.forEach((u) => {
    const mv = overlayMoves[u.key];
    u.dir = mv ? mv.dir : u.baseDir; u.pod = mv ? mv.pod : u.basePod; u.moved = !!mv;
    const com = u.hypo ? z() : committedOf(u.key);
    const ovl = overlayHoursFor(u.key);
    u.com = com; u.ovl = ovl; u.total = weeks.map((_, i) => com[i] + ovl[i]);
  });
  const unitsIn = (dir, pod) => allUnits.filter((u) => u.dir === dir && (pod == null || u.pod === pod));

  // All editable rows (committed-forecast + overlay), in visual order, for keyboard nav.
  const editOrder = [];
  const focusCell = (id, c) => { const el = document.querySelector("input[data-edit=" + CSS.escape(`${id}__${c}`) + "]"); if (el) { el.focus(); try { el.select(); } catch {} } };
  const onCellKey = (e, id, col) => {
    const N = weeks.length;
    if (e.key === "ArrowRight") { if (col < N - 1) { e.preventDefault(); focusCell(id, col + 1); } }
    else if (e.key === "ArrowLeft") { if (col > 0) { e.preventDefault(); focusCell(id, col - 1); } }
    else if (e.key === "ArrowDown" || e.key === "Enter") { const i = editOrder.indexOf(id); if (i >= 0 && i < editOrder.length - 1) { e.preventDefault(); focusCell(editOrder[i + 1], col); } }
    else if (e.key === "ArrowUp") { const i = editOrder.indexOf(id); if (i > 0) { e.preventDefault(); focusCell(editOrder[i - 1], col); } }
  };

  // Editable cell row body: an array of <input> cells + fill handle. accent is the
  // row color; baseline (optional) flags overridden cells (forecast edits).
  const editCells = (editId, values, accent, baseline) => values.map((h, i) => {
    const df = dragFill, inRange = df && df.id === editId && i >= Math.min(df.from, df.to) && i <= Math.max(df.from, df.to);
    const overridden = baseline ? Math.round(h) !== Math.round(baseline[i] || 0) : false;
    const dashed = accent === OV || overridden;
    return (
      <div key={i} onMouseEnter={() => { if (dragFillRef.current && dragFillRef.current.id === editId) setDrag((f) => ({ ...f, to: i })); }}
        style={{ position: "relative", borderRight: `1px solid ${T.cellline}`, background: inRange ? (accent === OV ? OV_FILL : "rgba(44,204,211,0.16)") : "transparent", height: rowH }}>
        <input data-edit={`${editId}__${i}`} value={h ? h : ""} inputMode="numeric"
          onChange={(e) => dispatchEdit(editId, i, e.target.value)} onKeyDown={(e) => onCellKey(e, editId, i)} onFocus={(e) => { try { e.target.select(); } catch {} }}
          title={baseline ? `Salesforce: ${Math.round(baseline[i] || 0)}h${overridden ? ` (forecast ${Math.round(h)}h)` : ""}` : ""}
          style={{ width: "100%", height: "100%", textAlign: "center", fontSize: numFs, color: accent === OV ? "#8a4b1f" : (overridden ? TEAL_TX : "#475569"), fontWeight: (overridden || (accent === OV && h)) ? 600 : 400, border: "none", background: "transparent", outline: "none", fontFamily: BODY, fontVariantNumeric: "tabular-nums", borderBottom: dashed ? `1px dashed ${accent}` : "none" }} />
        <span onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setDrag({ id: editId, from: i, to: i, val: values[i] }); }}
          title="Drag to fill right" style={{ position: "absolute", right: 1, bottom: 1, width: 6, height: 6, background: accent, borderRadius: 1, cursor: "crosshair" }} />
      </div>
    );
  });

  const chip = (n, group) => <span style={{ marginLeft: 7, flex: "none", fontSize: 10.5, fontWeight: 700, lineHeight: 1, color: group ? T.chipGtx : T.chipMtx, background: group ? T.chipG : T.chipM, borderRadius: 5, padding: "2px 6px" }}>{n}</span>;
  const tagOv = (txt) => <span style={{ marginLeft: 6, fontSize: 8.5, padding: "1px 5px", borderRadius: 4, background: OV_BG, color: "#8a4b1f", fontWeight: 700, flexShrink: 0 }}>{txt}</span>;

  // A grid row: name cell (sticky) + value cells. valueCells is an array of nodes.
  const gridRow = (key, depth, kind, nameInner, valueCells, gkey, nameExtra) => {
    const hov = hoverRow === key;
    const bg = kind === "group" ? (hov ? T.groupHover : T.groupBg) : (hov ? T.memberHover : "#fff");
    return (
      <div key={key} onMouseEnter={() => setHoverRow(key)} onMouseLeave={() => setHoverRow((h) => (h === key ? null : h))}
        style={{ display: "grid", gridTemplateColumns: GT, alignItems: "stretch", borderBottom: `1px solid ${T.rowline}`, background: bg }}>
        <div {...(nameExtra || {})} style={{ position: "sticky", left: 0, zIndex: 2, display: "flex", alignItems: "center", height: rowH, paddingLeft: 14 + depth * 17, paddingRight: 12, background: dropTarget === gkey ? OV_BG : bg, borderRight: `1px solid ${T.border}`, boxShadow: hov ? `inset 3px 0 0 ${B.teal},${EDGE}` : EDGE, overflow: "hidden", ...(nameExtra?.style || {}) }}>
          {nameInner}
        </div>
        {valueCells}
      </div>
    );
  };

  const caret = (open, onClick) => <span onClick={onClick} style={{ flex: "none", width: 16, cursor: onClick ? "pointer" : "default", color: T.caps, fontSize: 10, display: "inline-flex", alignItems: "center", justifyContent: "center", userSelect: "none", transition: "transform .15s ease", transform: open ? "rotate(90deg)" : "rotate(0deg)" }}>{onClick ? "▸" : ""}</span>;
  const spacer = <span style={{ display: "inline-block", width: 16, flex: "none" }} />;

  // Read-only heatmap value cells for a node (total per week + member count).
  const heatCells = (totals, ovls, members) => weeks.map((_, i) => {
    const total = totals[i], ov = ovls ? ovls[i] : 0;
    const empty = !total;
    const cap = members * capacity[i];
    const hc = heat(empty ? null : (cap > 0 ? total / cap : 0));
    return (
      <div key={i} title={empty ? "" : `${Math.round(total)}h of ${cap}h capacity`}
        style={{ display: "flex", alignItems: "center", justifyContent: "center", height: rowH, fontSize: numFs, fontVariantNumeric: "tabular-nums", borderRight: `1px solid ${T.cellline}`, background: hc.bg, color: ov > 0 ? OV : hc.color, fontWeight: hc.weight, borderBottom: ov > 0 ? `2px dashed ${OV}` : "none", fontFamily: BODY }}>
        {empty ? "—" : Math.round(total)}
      </div>
    );
  });

  const addProjectTo = (personKey, expandKey) => {
    const name = window.prompt("Hypothetical project / client name:");
    if (!name) return;
    const wk = window.prompt(`Default hours per week for "${name}":`, "8");
    if (wk === null) return;
    addOverlayAsg(personKey, name, wk);
    setExpanded((e) => ({ ...e, [expandKey]: true }));
  };

  const rows = [];

  const renderPerson = (u, depth) => {
    const pKey = `person:${u.key}`, exp = expanded[pKey] ?? false;
    const projs = u.hypo ? [] : (data[u.key]?.projects || []);
    const asgs = overlayAsgs.filter((a) => a.person === u.key);
    const childCount = projs.length + asgs.length;
    const short = u.name.split(" ")[0] + " " + (u.name.split(" ").slice(-1)[0] || "");
    const overAny = u.total.some((t, i) => t && capacity[i] > 0 && t / capacity[i] > 1.05);
    const nameColor = u.hypo ? "#8a4b1f" : (overAny ? T.over : TEAL_TX);
    const nameExtra = {
      draggable: true,
      onDragStart: (e) => { dragKeyRef.current = u.key; e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", u.key); } catch {} },
      onDragEnd: () => { dragKeyRef.current = null; setDropTarget(null); },
      style: { cursor: "grab" },
    };
    const nameInner = (
      <>
        {childCount > 0 ? caret(exp, () => toggle(pKey, false)) : spacer}
        <span style={{ fontSize: 13, fontWeight: 600, color: nameColor, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: BODY }}>{short}</span>
        {u.hypo && tagOv("hypothetical")}
        {u.moved && tagOv("moved")}
        {childCount > 0 && chip(childCount, false)}
        {u.moved && <button onClick={(e) => { e.stopPropagation(); resetOverlayMove(u.key); }} title="Reset to original pod" style={{ border: "none", background: "none", color: "#999", cursor: "pointer", fontSize: 11, marginLeft: 4 }}>↺</button>}
        {u.removable && <button onClick={(e) => { e.stopPropagation(); removeOverlayPerson(u.key); }} title="Remove hypothetical person" style={{ border: "none", background: "none", color: "#c99", cursor: "pointer", fontSize: 13, marginLeft: 2 }}>×</button>}
      </>
    );
    rows.push(gridRow(pKey, depth, "member", nameInner, heatCells(u.total, u.ovl, 1), null, nameExtra));
    if (!exp) return;

    // Committed assignment rows: editable forecast (baseline = Salesforce value).
    projs.forEach((pr, ci) => {
      const editId = `pf:${u.key}||${pr.proj}`;
      editOrder.push(editId);
      const eff = weeks.map((_, i) => effProj(u.key, pr, i));
      const overridden = pr.cells.some((c, i) => Math.round(eff[i]) !== Math.round(c || 0));
      rows.push(
        <div key={pKey + ":c" + ci} style={{ display: "grid", gridTemplateColumns: GT, alignItems: "stretch", borderBottom: `1px solid ${T.rowline}`, background: "#fff" }}>
          <div style={{ position: "sticky", left: 0, zIndex: 2, display: "flex", alignItems: "center", height: rowH, paddingLeft: 14 + (depth + 1) * 17, paddingRight: 12, background: "#fff", borderRight: `1px solid ${T.border}`, boxShadow: EDGE, overflow: "hidden" }}>
            <span style={{ display: "inline-block", width: 16, flex: "none" }} />
            <span style={{ fontSize: 12.5, fontWeight: overridden ? 600 : 400, color: overridden ? TEAL_TX : T.proj, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: BODY }}>{pr.proj}</span>
            {overridden && tagOv("forecast")}
            {overridden && <button onClick={() => resetForecast(u.key, pr.proj)} title="Reset forecast to Salesforce" style={{ border: "none", background: "none", color: "#999", cursor: "pointer", fontSize: 11, marginLeft: 6 }}>↺</button>}
          </div>
          {editCells(editId, eff, B.teal, pr.cells)}
        </div>
      );
    });

    // Overlay (hypothetical) assignment rows: editable, no baseline.
    asgs.forEach((a) => {
      const editId = `ov:${a.id}`;
      editOrder.push(editId);
      rows.push(
        <div key={pKey + ":o" + a.id} style={{ display: "grid", gridTemplateColumns: GT, alignItems: "stretch", borderBottom: `1px solid ${T.rowline}`, background: OV_BG }}>
          <div style={{ position: "sticky", left: 0, zIndex: 2, display: "flex", alignItems: "center", height: rowH, paddingLeft: 14 + (depth + 1) * 17, paddingRight: 12, background: OV_BG, borderRight: `1px solid ${T.border}`, borderLeft: `3px solid ${OV}`, boxShadow: EDGE, overflow: "hidden" }}>
            <span style={{ fontSize: 12.5, color: "#8a4b1f", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: BODY }}>{a.project}</span>{tagOv("overlay")}
            <button onClick={() => removeOverlayAsg(a.id)} title="Remove overlay" style={{ border: "none", background: "none", color: "#c99", cursor: "pointer", fontSize: 13, marginLeft: 2 }}>×</button>
          </div>
          {editCells(editId, a.hours, OV, null)}
        </div>
      );
    });

    rows.push(
      <div key={pKey + ":add"} style={{ display: "grid", gridTemplateColumns: GT, borderBottom: `1px solid ${T.rowline}`, background: "#fff" }}>
        <div style={{ position: "sticky", left: 0, zIndex: 2, background: "#fff", padding: `5px 12px 5px ${14 + (depth + 1) * 17}px`, borderRight: `1px solid ${T.border}`, boxShadow: EDGE }}>
          <button onClick={() => addProjectTo(u.key, pKey)} style={{ fontSize: 10.5, color: OV, background: "none", border: `0.5px dashed ${OV}`, borderRadius: 5, padding: "2px 8px", cursor: "pointer", fontFamily: BODY }}>+ overlay {u.hypo ? "project" : "adjustment"}</button>
        </div>
        <div style={{ gridColumn: `2 / span ${weeks.length}` }} />
      </div>
    );
  };

  const dropProps = (dir, pod, gkey) => ({
    onDragOver: (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (dropTarget !== gkey) setDropTarget(gkey); },
    onDragLeave: () => setDropTarget((t) => (t === gkey ? null : t)),
    onDrop: (e) => { e.preventDefault(); const k = dragKeyRef.current; if (k) { moveOverlayPerson(k, dir, pod); setExpanded((x) => ({ ...x, [dir]: true, [`${dir}:::${pod}`]: true })); } dragKeyRef.current = null; setDropTarget(null); },
  });

  dirsInScope.forEach((dir) => {
    const dKey = dir.name, dExp = expanded[dKey] ?? true;
    const units = unitsIn(dir.name, null);
    const dTotals = weeks.map((_, i) => units.reduce((s, u) => s + u.total[i], 0));
    const dOvls = weeks.map((_, i) => units.reduce((s, u) => s + u.ovl[i], 0));
    rows.push(gridRow(dKey, 0, "group",
      <>{caret(dExp, () => toggle(dKey, true))}<span style={{ fontSize: 13.5, fontWeight: 700, color: T.ink, fontFamily: HEAD, whiteSpace: "nowrap" }}>{dir.name}</span>{chip(units.length, true)}</>,
      heatCells(dTotals, dOvls, units.length), dKey, dropProps(dir.name, DIRECT, dKey)));
    if (!dExp) return;

    [...(DIRS[dir.name]?.pods || []), DIRECT].forEach((pn) => {
      const podUnits = unitsIn(dir.name, pn);
      if (!podUnits.length) return;
      const podKey = `${dKey}:::${pn}`, podExp = expanded[podKey] ?? false;
      const pTotals = weeks.map((_, i) => podUnits.reduce((s, u) => s + u.total[i], 0));
      const pOvls = weeks.map((_, i) => podUnits.reduce((s, u) => s + u.ovl[i], 0));
      const pnLabel = pn === DIRECT ? dir.name.split(" ")[0] + " (direct)" : pn;
      rows.push(gridRow(podKey, 1, "group",
        <>{caret(podExp, () => toggle(podKey, false))}<span style={{ fontSize: 13, fontWeight: 700, color: TEAL_TX, fontFamily: HEAD, whiteSpace: "nowrap" }}>{pnLabel}</span>{chip(podUnits.length, false)}</>,
        heatCells(pTotals, pOvls, podUnits.length), podKey, dropProps(dir.name, pn, podKey)));
      if (podExp) podUnits.forEach((u) => renderPerson(u, 2));
    });
  });

  // Export rows in display order.
  const allPods = [...(DIRS[form.dir]?.pods || []), DIRECT];
  const exportRows = [];
  dirsInScope.forEach((dir) => [...(DIRS[dir.name]?.pods || []), DIRECT].forEach((pn) =>
    unitsIn(dir.name, pn).forEach((u) => exportRows.push({ name: u.name, hypo: u.hypo, dir: dir.name, pod: pn === DIRECT ? dir.name.split(" ")[0] + " (direct)" : pn, committed: u.com, overlay: u.ovl, total: u.total }))));
  const doExport = async () => {
    setScenStatus("Building Excel...");
    try { await exportPlan({ weeks, people: exportRows }); setScenStatus("Exported Excel"); }
    catch (e) { setScenStatus("Export failed: " + (e?.message || e)); }
  };

  const doSaveScenario = async () => { const n = window.prompt("Save scenario as:"); if (n === null) return; setScenStatus("Saving..."); try { const r = await saveScenario(n); setScenStatus(`Saved "${r?.name || n}"`); } catch (e) { setScenStatus("Save failed: " + (e?.message || e)); } };
  const doOpenScenarios = async () => { setScenStatus("Loading list..."); try { const names = await listScenarios(); setScenList(names); setScenStatus(names.length ? "" : "No saved scenarios yet"); } catch (e) { setScenList(null); setScenStatus("Could not list: " + (e?.message || e)); } };
  const doLoadScenario = async (n) => { setScenStatus(`Loading "${n}"...`); try { await loadScenario(n); setScenList(null); setScenStatus(`Loaded "${n}"`); } catch (e) { setScenStatus("Load failed: " + (e?.message || e)); } };

  const btn = (extra) => ({ fontSize: 11.5, fontWeight: 600, padding: "7px 12px", borderRadius: 8, cursor: "pointer", fontFamily: BODY, ...extra });
  const swatch = (bg, bd) => <span style={{ width: 26, height: 14, borderRadius: 4, background: bg, border: `1px solid ${bd}` }} />;
  const sel = { fontSize: 11.5, padding: "5px 7px", border: `1px solid #d8dee6`, borderRadius: 8, background: "#fff", fontFamily: BODY, color: T.ink2 };

  return (
    <div style={{ fontFamily: BODY }}>
      {/* Section header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-.01em", fontFamily: HEAD, color: T.ink }}>Resource planner</div>
          <div style={{ fontSize: 13, color: T.muted, marginTop: 6, maxWidth: 680, lineHeight: 1.5 }}>
            Committed scheduled hours per week, <strong style={{ color: "#475569", fontWeight: 600 }}>{weeks[0].label} to {weeks[weeks.length - 1].label}</strong> ({weeks.length} weeks). Aldus + Meghan only. Committed is read-only; expand a person for projects or add an overlay to plan.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button onClick={() => setAdding((a) => !a)} style={btn({ border: `1px solid ${OV}`, color: "#8a4b1f", background: OV_BG })}>+ Hypothetical person</button>
          <button onClick={doSaveScenario} style={btn({ border: "1px solid #d8dee6", color: T.ink2, background: "#fff" })}>Save scenario</button>
          <button onClick={() => (scenList ? setScenList(null) : doOpenScenarios())} style={btn({ border: "1px solid #d8dee6", color: T.ink2, background: "#fff" })}>Load scenario</button>
          <button onClick={doExport} style={btn({ border: `1px solid ${B.teal}`, color: B.white, background: B.teal })}>Export Excel</button>
          <button onClick={load} style={btn({ border: "1px solid #b7e6d6", color: TEAL_TX, background: "#ecfdf6" })}>↺ Reload</button>
        </div>
      </div>

      {adding && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", margin: "12px 0 0", padding: "10px 12px", background: OV_BG, borderRadius: 8, border: `0.5px dashed ${OV}` }}>
          <input autoFocus value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Person name (e.g. New Hire)" style={{ fontSize: 12, padding: "5px 8px", border: "1px solid #d8dee6", borderRadius: 6, minWidth: 180, fontFamily: BODY }} />
          <select value={form.dir} onChange={(e) => setForm((f) => ({ ...f, dir: e.target.value, pod: "" }))} style={sel}>{DIRECTORS.map((d) => <option key={d} value={d}>{d}</option>)}</select>
          <select value={form.pod || allPods[0]} onChange={(e) => setForm((f) => ({ ...f, pod: e.target.value }))} style={sel}>{allPods.map((p) => <option key={p} value={p}>{p === DIRECT ? form.dir.split(" ")[0] + " (direct)" : p}</option>)}</select>
          <button onClick={() => { if (!form.name.trim()) return; const pod = form.pod || allPods[0]; addOverlayPerson(form.name.trim(), form.dir, pod); setExpanded((e) => ({ ...e, [form.dir]: true, [`${form.dir}:::${pod}`]: true })); setForm((f) => ({ ...f, name: "" })); setAdding(false); }} style={btn({ border: "none", background: OV, color: "#fff" })}>Add</button>
          <button onClick={() => setAdding(false)} style={btn({ border: "none", background: "none", color: T.muted })}>Cancel</button>
        </div>
      )}

      {scenStatus && <div style={{ fontSize: 11, color: scenStatus.includes("failed") || scenStatus.includes("Could not") ? T.over : T.muted, margin: "10px 0 0" }}>{scenStatus}</div>}
      {scenList && (
        <div style={{ margin: "10px 0 0", padding: "10px 12px", background: "#f7f9fb", borderRadius: 8, border: `1px solid ${T.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: scenList.length ? 8 : 0 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, fontFamily: HEAD }}>Saved scenarios</span>
            <button onClick={() => setScenList(null)} style={{ border: "none", background: "none", color: "#aaa", cursor: "pointer", fontSize: 16 }}>×</button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {scenList.length === 0 && <span style={{ fontSize: 11, color: "#999" }}>None yet. Save one first.</span>}
            {scenList.map((n) => <button key={n} onClick={() => doLoadScenario(n)} style={btn({ border: `1px solid ${B.teal}`, color: TEAL_TX, background: "#fff", padding: "4px 10px" })}>{n}</button>)}
          </div>
        </div>
      )}

      {/* Legend + display knobs */}
      <div style={{ display: "flex", alignItems: "center", gap: 22, margin: "18px 0 14px", flexWrap: "wrap" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: T.caps }}>Capacity</div>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>{swatch("hsl(212 66% 90%)", "hsl(212 50% 80%)")}<span style={{ fontSize: 12.5, color: "#475569", fontWeight: 500 }}>Available</span></span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>{swatch("hsl(158 52% 86%)", "hsl(158 40% 72%)")}<span style={{ fontSize: 12.5, color: "#475569", fontWeight: 500 }}>On plan</span></span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>{swatch("hsl(3 80% 84%)", "hsl(3 65% 72%)")}<span style={{ fontSize: 12.5, color: "#475569", fontWeight: 500 }}>Over capacity</span></span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>{swatch(OV_BG, OV)}<span style={{ fontSize: 12.5, color: "#475569", fontWeight: 500 }}>Overlay (editable)</span></span>
        <div style={{ flex: 1 }} />
        <select value={density} onChange={(e) => setDensity(e.target.value)} style={sel}>{["Comfortable", "Compact"].map((d) => <option key={d}>{d}</option>)}</select>
        <select value={colorMode} onChange={(e) => setColorMode(e.target.value)} style={sel}>{["Diverging", "Sequential", "Off"].map((d) => <option key={d}>{d}</option>)}</select>
        <label style={{ fontSize: 12, color: T.muted, display: "inline-flex", alignItems: "center", gap: 5, cursor: "pointer" }}><input type="checkbox" checked={showAvail} onChange={(e) => setShowAvail(e.target.checked)} />Show availability</label>
      </div>

      {/* Grid */}
      <div style={{ overflow: "auto", maxHeight: 560, border: `1px solid ${T.border}`, borderRadius: 12, position: "relative", background: "#fff" }}>
        <div style={{ display: "grid", gridTemplateColumns: GT, position: "sticky", top: 0, zIndex: 4, background: "#fff" }}>
          <div style={{ position: "sticky", left: 0, top: 0, zIndex: 6, background: "#fff", display: "flex", alignItems: "center", height: 46, paddingLeft: 14, fontSize: 10.5, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: T.caps, borderRight: `1px solid ${T.border}`, borderBottom: `2px solid ${T.border}`, boxShadow: EDGE, fontFamily: HEAD }}>Person / project</div>
          {weeks.map((w, i) => (
            <div key={w.iso} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 46, borderRight: `1px solid ${T.cellline}`, borderBottom: `2px solid ${T.border}`, background: "#fff" }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: T.ink2, letterSpacing: "-.01em", fontFamily: HEAD }}>{w.label}</div>
              <div style={{ fontSize: 9.5, fontWeight: 600, color: T.cap, marginTop: 1 }}>{capacity[i]}h</div>
            </div>
          ))}
        </div>
        {rows}
      </div>

      <div style={{ padding: "14px 2px 4px", fontSize: 11.5, color: T.faint, lineHeight: 1.55 }}>
        Committed hours = each assignment's scheduled hours spread across its span of working days (read-only). Overlay = local planning only, never saved to Salesforce. Capacity = working days that week × 8h (CA holidays applied). Group rows roll up to (members × weekly capacity).
      </div>
    </div>
  );
}
