// Time report: a grouped, configurable report over approved pse__Timecard__c
// splits, with two views.
//   Table  : pick a month and group-by, search the live field list to add
//            columns, drag to reorder. Rows roll up with hours/revenue subtotals.
//   Matrix : a Salesforce-report-builder style layout. Search the describe-driven
//            field list, then drag a dimension into the Rows or Columns well and a
//            measure into Values, and the data pivots with aggregation at each
//            row x column intersection (SOQL stays flat; pivot is client-side).
// Aldus + Meghan scope, read-only SELECT only. Data, query, describe, and pivot
// live in useTimeReport / lib/pivot.js; this is layout + interaction. Drag uses
// native HTML5 drag-and-drop (the house pattern).
import { useState } from "react";
import { B } from "../constants/brand.js";
import { fmt, fmtH } from "../lib/format.js";
import { Spinner } from "../components/index.js";
import { useTimeReport, AGGREGATIONS } from "../hooks/useTimeReport.js";

const REVENUE_HINT = /(amount|revenue)/i;

export default function TimeDetailTab({ monthOpts }) {
  const R = useTimeReport(monthOpts);
  const { available, fieldsLoading, fieldsError, selected, addField, removeField, reorderField,
    numericNames, labelOf, month, setMonth, soql, tree,
    warnings, loading, error, load, rowCount, capped, rowCap,
    tableRowDimIds, addTableRow, removeTableRow, reorderTableRow,
    viewMode, setViewMode, rowDimIds, colDimIds, measureId, measureAgg, setMeasureAgg,
    addToRows, addToCols, removeFromRows, removeFromCols, reorderRows, reorderCols, setMeasure,
    fieldCatalog, dimLabelOf, measureLabelOf, matrix } = R;

  const [expanded, setExpanded] = useState({});
  const [dragIdx, setDragIdx] = useState(null);    // table column reorder
  const [drag, setDrag] = useState(null);          // matrix DnD {from,id,index,kind}
  const [trowDrag, setTrowDrag] = useState(null);  // table Rows well DnD {from,id,index,kind}
  const [query, setQuery] = useState("");
  const [matrixQuery, setMatrixQuery] = useState("");
  const [rowsQuery, setRowsQuery] = useState("");
  const [focused, setFocused] = useState(false);

  const isNum = (n) => numericNames.has(n);

  const selControl = { fontSize: 12, padding: "6px 10px", border: `0.5px solid ${B.lgray}`, borderRadius: 8, background: B.white, fontFamily: "'Open Sans',sans-serif", color: B.black, cursor: "pointer" };
  const toggleBtn = (active) => ({ fontSize: 12, fontWeight: active ? 700 : 500, padding: "6px 12px", border: "none", cursor: "pointer", background: active ? B.teal : "transparent", color: active ? B.white : "#64748b", fontFamily: "'Open Sans',sans-serif" });

  return (
    <div style={{ fontFamily: "'Open Sans',sans-serif", width: "100%" }}>
      {/* Header */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-.01em", fontFamily: "'Poppins',sans-serif" }}>Time report</div>
        <div style={{ fontSize: 13, color: "#64748b", marginTop: 6, maxWidth: 780, lineHeight: 1.5 }}>
          Approved timecard splits for the selected month. Use table view to pick and arrange columns, or matrix view to pivot a row field against a column field with a measure. Aldus and Meghan scope, read only.
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        <div style={{ display: "flex", border: `0.5px solid ${B.lgray}`, borderRadius: 8, overflow: "hidden" }}>
          <button onClick={() => setViewMode("table")} style={toggleBtn(viewMode === "table")}>Table</button>
          <button onClick={() => setViewMode("matrix")} style={toggleBtn(viewMode === "matrix")}>Matrix</button>
        </div>
        <label style={{ fontSize: 11, color: "#888", marginLeft: 6 }}>Month</label>
        <select value={month?.label || ""} onChange={(e) => setMonth(monthOpts.find((m) => m.label === e.target.value))} style={selControl}>
          {(monthOpts || []).map((m) => <option key={m.label} value={m.label}>{m.label}</option>)}
        </select>
        <button onClick={load} style={{ fontSize: 11, padding: "6px 10px", border: `0.5px solid ${B.lgray}`, borderRadius: 8, background: "transparent", cursor: "pointer", marginLeft: "auto" }}>↺ Refresh</button>
      </div>

      {viewMode === "table" ? <>{renderRowsWell()}{renderTablePicker()}</> : renderMatrixBuilder()}

      {/* Warnings (non-blocking) */}
      {warnings.map((w) => (
        <div key={w} style={{ fontSize: 11, color: B.amberTx, background: B.amberBg, border: `0.5px solid ${B.amber}`, borderRadius: 8, padding: "8px 12px", marginBottom: 12 }}>{w}</div>
      ))}

      {/* Generated SOQL (read-only) */}
      <details style={{ marginBottom: 12 }}>
        <summary style={{ fontSize: 11, color: "#888", cursor: "pointer" }}>Generated SOQL (read only)</summary>
        <pre style={{ fontSize: 11, color: "#475569", background: B.offwhite, border: `0.5px solid ${B.lgray}`, borderRadius: 8, padding: "10px 12px", marginTop: 6, whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "ui-monospace,Menlo,Consolas,monospace" }}>{soql}</pre>
      </details>

      {/* Results */}
      {error && <div style={{ fontSize: 12, color: B.redTx, background: B.redBg, borderRadius: 8, padding: "10px 14px" }}>Could not run report: {error}</div>}
      {!error && loading && <Spinner msg="Running report..." />}
      {!error && !loading && (viewMode === "table" ? renderTable() : renderMatrix())}
    </div>
  );

  // ── Table view: Rows well (multi-level grouping) ──────────────────────────────
  function renderRowsWell() {
    const allow = (e) => e.preventDefault();
    const dropToRows = (dropIndex) => {
      if (!trowDrag) return;
      if (trowDrag.from === "palette" && trowDrag.kind === "dimension") addTableRow(trowDrag.id);
      else if (trowDrag.from === "trows") reorderTableRow(trowDrag.index, dropIndex == null ? tableRowDimIds.length - 1 : dropIndex);
      setTrowDrag(null);
    };
    const dropToPalette = () => { if (trowDrag?.from === "trows") removeTableRow(trowDrag.id); setTrowDrag(null); };
    const q = rowsQuery.trim().toLowerCase();
    const dims = fieldCatalog.filter((f) => f.kind === "dimension" && (!q || f.label.toLowerCase().includes(q) || f.id.toLowerCase().includes(q)) && !tableRowDimIds.includes(f.id));
    const activeDrop = trowDrag && (trowDrag.from === "palette" ? trowDrag.kind === "dimension" : true);
    return (
      <div style={{ background: B.offwhite, border: `0.5px solid ${B.lgray}`, borderRadius: 10, padding: "10px 12px", marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: "#aaa", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8 }}>Rows (grouping, in order: outermost first. Drag to reorder, click x to remove)</div>
        <div onDragOver={allow} onDrop={() => dropToRows(null)} style={{ background: B.white, border: `1px dashed ${activeDrop ? B.teal : B.lgray}`, borderRadius: 8, padding: "8px 10px", minHeight: 44, display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center" }}>
          {tableRowDimIds.length ? tableRowDimIds.map((id, i) => (
            <div key={id} draggable onDragStart={() => setTrowDrag({ from: "trows", id, index: i })} onDragEnd={() => setTrowDrag(null)} onDragOver={allow} onDrop={(e) => { e.stopPropagation(); dropToRows(i); }} title={id}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 8px", background: B.offwhite, border: `0.5px solid ${B.lgray}`, borderLeft: `3px solid ${B.teal}`, borderRadius: 5, cursor: "grab", fontSize: 11, userSelect: "none" }}>
              <span style={{ fontSize: 9, color: "#bbb", fontWeight: 700 }}>{i + 1}</span>
              <span style={{ color: B.black }}>{dimLabelOf(id)}</span>
              <button onClick={() => removeTableRow(id)} style={{ fontSize: 13, color: "#ccc", background: "none", border: "none", cursor: "pointer", padding: "0 1px", lineHeight: 1 }}>×</button>
            </div>
          )) : <span style={{ fontSize: 11, color: "#bbb" }}>Drag a dimension here to group by it</span>}
        </div>
        <div onDragOver={allow} onDrop={dropToPalette} style={{ marginTop: 10 }}>
          <input value={rowsQuery} onChange={(e) => setRowsQuery(e.target.value)} placeholder={fieldsLoading ? "Loading fields..." : "Search dimensions to group by"} disabled={fieldsLoading || !!fieldsError}
            style={{ width: "100%", maxWidth: 420, fontSize: 12, padding: "7px 10px", border: `0.5px solid ${B.lgray}`, borderRadius: 8, background: B.white, outline: "none", marginBottom: 8, fontFamily: "'Open Sans',sans-serif" }} />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", maxHeight: 84, overflowY: "auto" }}>
            {dims.map((f) => (
              <div key={f.id} draggable onDragStart={() => setTrowDrag({ from: "palette", id: f.id, kind: "dimension" })} onDragEnd={() => setTrowDrag(null)} onClick={() => addTableRow(f.id)} title={f.id}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 8px", background: B.white, border: `0.5px solid ${B.lgray}`, borderLeft: `3px solid ${B.teal}`, borderRadius: 5, cursor: "grab", fontSize: 11, userSelect: "none" }}>
                <span style={{ color: B.black }}>{f.label}</span>
                {f.source === "derived" && <span style={{ fontSize: 8, color: "#bbb" }}>derived</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Table view: column picker (visible leaf-row columns) ──────────────────────
  function renderTablePicker() {
    const q = query.trim().toLowerCase();
    const matches = q ? available.filter((f) => !selected.includes(f.name) && (f.label.toLowerCase().includes(q) || f.name.toLowerCase().includes(q))).slice(0, 12) : [];
    const addMatch = (name) => { addField(name); setQuery(""); };
    return (
      <div style={{ background: B.offwhite, border: `0.5px solid ${B.lgray}`, borderRadius: 10, padding: "10px 12px", marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: "#aaa", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8 }}>Columns (drag to reorder, click x to remove)</div>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center" }}>
          {selected.map((name, i) => (
            <div key={name} draggable onDragStart={() => setDragIdx(i)} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (dragIdx != null) reorderField(dragIdx, i); setDragIdx(null); }} onDragEnd={() => setDragIdx(null)} title={name}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 8px", background: B.white, border: `0.5px solid ${dragIdx === i ? B.teal : B.lgray}`, borderRadius: 6, cursor: "grab", fontSize: 11, userSelect: "none", opacity: dragIdx === i ? 0.5 : 1 }}>
              <span style={{ color: "#cbd5e1", fontSize: 10 }}>⠿</span>
              <span style={{ color: B.black }}>{labelOf(name)}</span>
              {isNum(name) && <span style={{ fontSize: 9, color: B.teal, fontWeight: 700 }}>Σ</span>}
              <button onClick={() => removeField(name)} style={{ fontSize: 13, color: "#ccc", background: "none", border: "none", cursor: "pointer", padding: "0 1px", lineHeight: 1 }}>×</button>
            </div>
          ))}
        </div>
        <div style={{ position: "relative", marginTop: 10, maxWidth: 420 }}>
          <input value={query} onChange={(e) => setQuery(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setTimeout(() => setFocused(false), 150)}
            onKeyDown={(e) => { if (e.key === "Enter" && matches[0]) addMatch(matches[0].name); }}
            placeholder={fieldsLoading ? "Loading fields..." : "Search fields to add a column (label or API name)"} disabled={fieldsLoading || !!fieldsError}
            style={{ width: "100%", fontSize: 12, padding: "7px 10px", border: `0.5px solid ${B.lgray}`, borderRadius: 8, background: B.white, fontFamily: "'Open Sans',sans-serif", outline: "none" }} />
          {focused && q && (
            <div style={{ position: "absolute", zIndex: 20, top: 36, left: 0, right: 0, maxHeight: 320, overflowY: "auto", background: B.white, border: `0.5px solid ${B.lgray}`, borderRadius: 8, boxShadow: "0 6px 24px rgba(0,0,0,0.12)", padding: 4 }}>
              {matches.length === 0 && <div style={{ fontSize: 11, color: "#aaa", padding: "8px 10px" }}>No fields match.</div>}
              {matches.map((f) => (
                <button key={f.name} onMouseDown={(e) => { e.preventDefault(); addMatch(f.name); }} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, width: "100%", textAlign: "left", padding: "6px 10px", border: "none", background: "transparent", cursor: "pointer", borderRadius: 6, fontFamily: "'Open Sans',sans-serif" }} onMouseEnter={(e) => (e.currentTarget.style.background = B.offwhite)} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                  <span style={{ minWidth: 0 }}><span style={{ fontSize: 12, color: B.black }}>{f.label}</span><span style={{ fontSize: 10, color: "#bbb", marginLeft: 8, fontFamily: "ui-monospace,Menlo,Consolas,monospace" }}>{f.name}</span></span>
                  <span style={{ fontSize: 9, color: "#bbb", whiteSpace: "nowrap" }}>{f.source === "relation" ? "related" : f.type}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {fieldsError && <div style={{ fontSize: 11, color: B.redTx, marginTop: 8 }}>Could not load field list: {fieldsError}</div>}
      </div>
    );
  }

  function renderTable() {
    if (!tree || selected.length === 0) return <div style={{ fontSize: 12, color: "#888", padding: 20, textAlign: "center" }}>{selected.length === 0 ? "Add a column to build the report." : "No rows for this month and scope."}</div>;
    const template = selected.map((n) => (isNum(n) ? "120px" : "minmax(140px,1fr)")).join(" ");
    const minWidth = Math.max(720, selected.length * 150);
    const firstNumIdx = selected.findIndex(isNum);
    const labelEnd = firstNumIdx === -1 ? selected.length : Math.max(firstNumIdx, 1);
    const tail = selected.slice(labelEnd);
    const fmtCell = (name, v) => v == null || v === "" ? "—" : isNum(name) ? (REVENUE_HINT.test(name) ? (Number(v) > 0 ? fmt(v) : "—") : (Number(v) || 0).toFixed(1)) : v === true ? "Yes" : v === false ? "No" : String(v);
    const fmtTotal = (name, v) => (REVENUE_HINT.test(name) ? fmt(v) : fmtH(v));
    const numCell = (txt, key) => <div key={key} style={{ textAlign: "right", fontSize: 12, fontWeight: 700, color: B.black, fontVariantNumeric: "tabular-nums" }}>{txt}</div>;

    // A subtotal / header grid row. labelNode occupies the columns before the first
    // numeric column; each numeric value column shows that node's subtotal.
    const summaryRow = (labelNode, totals, indent) => (
      <div style={{ display: "grid", gridTemplateColumns: template, gap: 10, alignItems: "center", minWidth }}>
        <div style={{ gridColumn: `1 / ${labelEnd + 1}`, display: "flex", alignItems: "center", gap: 7, minWidth: 0, paddingLeft: indent }}>{labelNode}</div>
        {tail.map((n, k) => (isNum(n) ? numCell(fmtTotal(n, totals[n] || 0), n + k) : <div key={n + k} />))}
      </div>
    );

    // Recursive render of one group node: a collapsible header with subtotals, then
    // (when open) its child groups or, at the innermost level, the leaf split rows.
    const renderNode = (node) => {
      const open = expanded[node.key] ?? false; // default collapsed to top level only
      const indent = (node.depth - 1) * 16;
      const labelNode = (
        <>
          <span style={{ fontSize: 9, color: "#bbb", transition: "transform .15s", transform: open ? "rotate(90deg)" : "none" }}>▶</span>
          <span style={{ fontSize: node.depth === 1 ? 13 : 12, fontWeight: node.depth === 1 ? 700 : 600, fontFamily: "'Poppins',sans-serif", color: node.depth === 1 ? B.black : "#475569", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{node.label}</span>
          <span style={{ fontSize: 11, color: "#aaa" }}>({node.count})</span>
        </>
      );
      return (
        <div key={node.key}>
          <div onClick={() => setExpanded((e) => ({ ...e, [node.key]: !(e[node.key] ?? false) }))}
            style={{ padding: "7px 14px", background: node.depth === 1 ? B.offwhite : B.white, borderBottom: `0.5px solid ${B.lgray}`, cursor: "pointer" }}>
            {summaryRow(labelNode, node.totals, indent)}
          </div>
          {open && (node.children.length
            ? node.children.map(renderNode)
            : node.leaves.map((row, ri) => (
              <div key={node.key + ":" + ri} style={{ display: "grid", gridTemplateColumns: template, gap: 10, padding: "6px 14px", borderBottom: `0.5px solid ${B.lgray}`, fontSize: 12, minWidth }}>
                {selected.map((n, ci) => <div key={n} style={{ textAlign: isNum(n) ? "right" : "left", color: isNum(n) ? B.black : "#555", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontVariantNumeric: "tabular-nums", paddingLeft: ci === 0 ? node.depth * 16 : 0 }} title={fmtCell(n, row[n])}>{fmtCell(n, row[n])}</div>)}
              </div>
            )))}
        </div>
      );
    };

    const topNodes = tree.children.length ? tree.children : null;
    const levelLabel = tableRowDimIds.length ? tableRowDimIds.map(dimLabelOf).join(" > ") : "no grouping";
    return (
      <>
        <div style={{ fontSize: 11, color: "#888", marginBottom: 8 }}>{rowCount.toLocaleString()} splits · grouped by {levelLabel}{capped && <span style={{ color: B.redTx, marginLeft: 6 }}>· results capped at {rowCap.toLocaleString()}, narrow the month or scope</span>}</div>
        <div style={{ background: B.white, border: `0.5px solid ${B.lgray}`, borderRadius: 12, overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: template, gap: 10, padding: "8px 14px", background: B.offwhite, borderBottom: `0.5px solid ${B.lgray}`, minWidth }}>
            {selected.map((n) => <div key={n} style={{ fontSize: 10, color: "#aaa", textTransform: "uppercase", letterSpacing: ".04em", textAlign: isNum(n) ? "right" : "left", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={labelOf(n)}>{labelOf(n)}</div>)}
          </div>
          {topNodes ? topNodes.map(renderNode) : tree.leaves.map((row, ri) => (
            <div key={ri} style={{ display: "grid", gridTemplateColumns: template, gap: 10, padding: "6px 14px", borderBottom: `0.5px solid ${B.lgray}`, fontSize: 12, minWidth }}>
              {selected.map((n) => <div key={n} style={{ textAlign: isNum(n) ? "right" : "left", color: isNum(n) ? B.black : "#555", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontVariantNumeric: "tabular-nums" }} title={fmtCell(n, row[n])}>{fmtCell(n, row[n])}</div>)}
            </div>
          ))}
          <div style={{ padding: "9px 14px", background: B.offwhite, borderTop: `1.5px solid ${B.lgray}` }}>{summaryRow(<span style={{ fontSize: 12, fontWeight: 700, color: B.black }}>All teams ({tree.count.toLocaleString()} splits)</span>, tree.totals, 0)}</div>
        </div>
      </>
    );
  }

  // ── Matrix view: searchable field list + drag-into-wells builder ──────────────
  function renderMatrixBuilder() {
    const allow = (e) => e.preventDefault();

    // Drop handlers, driven by the current `drag` payload.
    const dropToWell = (target, dropIndex) => {
      if (!drag) return;
      if (drag.from === "palette") {
        if (drag.kind !== "dimension") return;            // only dimensions in Rows/Columns
        target === "rows" ? addToRows(drag.id) : addToCols(drag.id);
      } else if (drag.from === "rows" || drag.from === "cols") {
        if (drag.from === target) {
          const to = dropIndex == null ? (target === "rows" ? rowDimIds.length - 1 : colDimIds.length - 1) : dropIndex;
          target === "rows" ? reorderRows(drag.index, to) : reorderCols(drag.index, to);
        } else {                                          // move across wells
          drag.from === "rows" ? removeFromRows(drag.id) : removeFromCols(drag.id);
          target === "rows" ? addToRows(drag.id) : addToCols(drag.id);
        }
      }
      setDrag(null);
    };
    const dropToValues = () => { if (drag?.from === "palette" && drag.kind === "measure") setMeasure(drag.id); setDrag(null); };
    const dropToPalette = () => { // drag a well chip back here to remove it
      if (drag?.from === "rows") removeFromRows(drag.id);
      else if (drag?.from === "cols") removeFromCols(drag.id);
      setDrag(null);
    };

    const q = matrixQuery.trim().toLowerCase();
    const match = (f) => !q || f.label.toLowerCase().includes(q) || f.id.toLowerCase().includes(q);
    const dims = fieldCatalog.filter((f) => f.kind === "dimension" && match(f));
    const measures = fieldCatalog.filter((f) => f.kind === "measure" && match(f));

    const paletteChip = (f) => (
      <div key={f.id} draggable onDragStart={() => setDrag({ from: "palette", id: f.id, kind: f.kind })} onDragEnd={() => setDrag(null)} title={f.id}
        style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 8px", background: B.white, border: `0.5px solid ${B.lgray}`, borderLeft: `3px solid ${f.kind === "measure" ? B.purple : B.teal}`, borderRadius: 5, cursor: "grab", fontSize: 11, userSelect: "none" }}>
        <span style={{ color: B.black, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 200 }}>{f.label}</span>
        {f.kind === "measure" && <span style={{ fontSize: 9, color: B.purple, fontWeight: 700 }}>Σ</span>}
        {f.source === "derived" && <span style={{ fontSize: 8, color: "#bbb" }}>derived</span>}
      </div>
    );

    const wellChip = (id, well, index) => (
      <div key={id} draggable onDragStart={() => setDrag({ from: well, id, index })} onDragEnd={() => setDrag(null)}
        onDragOver={allow} onDrop={(e) => { e.stopPropagation(); dropToWell(well, index); }} title={id}
        style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px", background: B.white, border: `0.5px solid ${B.lgray}`, borderRadius: 5, cursor: "grab", fontSize: 11, userSelect: "none" }}>
        <span style={{ color: "#cbd5e1", fontSize: 10 }}>⠿</span>
        <span style={{ color: B.black }}>{dimLabelOf(id)}</span>
        <button onClick={() => (well === "rows" ? removeFromRows(id) : removeFromCols(id))} style={{ fontSize: 13, color: "#ccc", background: "none", border: "none", cursor: "pointer", padding: "0 1px", lineHeight: 1 }}>×</button>
      </div>
    );

    const wellBox = (label, well, ids) => {
      const activeDrop = drag && (drag.from === "palette" ? drag.kind === "dimension" : true);
      return (
        <div onDragOver={allow} onDrop={() => dropToWell(well, null)}
          style={{ background: B.white, border: `1px dashed ${activeDrop ? B.teal : B.lgray}`, borderRadius: 8, padding: "8px 10px", minHeight: 56 }}>
          <div style={{ fontSize: 10, color: "#aaa", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 }}>{label}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {ids.length ? ids.map((id, i) => wellChip(id, well, i)) : <span style={{ fontSize: 11, color: "#bbb" }}>Drag a dimension here</span>}
          </div>
        </div>
      );
    };

    return (
      <div style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "stretch", flexWrap: "wrap" }}>
        {/* Field list */}
        <div onDragOver={allow} onDrop={dropToPalette} style={{ width: 280, flex: "0 0 280px", background: B.offwhite, border: `0.5px solid ${B.lgray}`, borderRadius: 10, padding: "10px 12px" }}>
          <input value={matrixQuery} onChange={(e) => setMatrixQuery(e.target.value)} placeholder={fieldsLoading ? "Loading fields..." : "Search fields"} disabled={fieldsLoading || !!fieldsError}
            style={{ width: "100%", fontSize: 12, padding: "7px 10px", border: `0.5px solid ${B.lgray}`, borderRadius: 8, background: B.white, outline: "none", marginBottom: 10, fontFamily: "'Open Sans',sans-serif" }} />
          <div style={{ maxHeight: 360, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <div style={{ fontSize: 10, color: "#aaa", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 }}>Dimensions</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>{dims.map(paletteChip)}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "#aaa", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 }}>Measures</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>{measures.map(paletteChip)}</div>
            </div>
          </div>
          {fieldsError && <div style={{ fontSize: 11, color: B.redTx, marginTop: 8 }}>Could not load field list: {fieldsError}</div>}
        </div>

        {/* Wells */}
        <div style={{ flex: 1, minWidth: 320, display: "flex", flexDirection: "column", gap: 10 }}>
          {wellBox("Rows", "rows", rowDimIds)}
          {wellBox("Columns", "cols", colDimIds)}
          {/* Values */}
          <div onDragOver={allow} onDrop={dropToValues} style={{ background: B.white, border: `1px dashed ${drag && (drag.from === "palette" ? drag.kind === "measure" : false) ? B.teal : B.lgray}`, borderRadius: 8, padding: "8px 10px", minHeight: 56 }}>
            <div style={{ fontSize: 10, color: "#aaa", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 }}>Values</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {measureId ? (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 8px", background: B.offwhite, border: `0.5px solid ${B.lgray}`, borderLeft: `3px solid ${B.purple}`, borderRadius: 5, fontSize: 11, color: B.black }}>{measureLabelOf(measureId)}<span style={{ fontSize: 9, color: B.purple, fontWeight: 700 }}>Σ</span></div>
              ) : <span style={{ fontSize: 11, color: "#bbb" }}>Drag a measure here</span>}
              <div style={{ display: "flex", border: `0.5px solid ${B.lgray}`, borderRadius: 6, overflow: "hidden" }}>
                {AGGREGATIONS.map((a) => <button key={a.id} onClick={() => setMeasureAgg(a.id)} style={{ fontSize: 11, padding: "4px 10px", border: "none", cursor: "pointer", background: measureAgg === a.id ? B.teal : "transparent", color: measureAgg === a.id ? B.white : "#94a3b8", fontFamily: "'Open Sans',sans-serif" }}>{a.label}</button>)}
              </div>
            </div>
          </div>
          <div style={{ fontSize: 11, color: "#94a3b8" }}>
            The SOQL below is the flat pull (month and scope filtered, row capped). The pivot and all subtotals are computed in the browser, not in SOQL.
          </div>
        </div>
      </div>
    );
  }

  function renderMatrix() {
    if (!matrix || !measureId) return <div style={{ fontSize: 12, color: "#888", padding: 20, textAlign: "center" }}>Pick a measure and at least one dimension to build the matrix.</div>;
    const { rowKeys, colKeys, cells, rowTotals, colTotals, grand } = matrix;
    const fmtMeasure = (v) => v == null ? "" : measureAgg === "count" ? Math.round(v).toLocaleString() : REVENUE_HINT.test(measureId) ? fmt(v) : (Number(v) || 0).toLocaleString(undefined, { maximumFractionDigits: 1 });
    const nCols = colKeys.length;
    const template = `minmax(170px,1.6fr) repeat(${nCols}, minmax(96px,1fr)) 120px`;
    const minWidth = Math.max(720, 170 + nCols * 110 + 120);
    const rowDimLabel = rowDimIds.length ? rowDimIds.map(dimLabelOf).join(" / ") : "All";
    return (
      <>
        <div style={{ fontSize: 11, color: "#888", marginBottom: 8 }}>
          {rowCount.toLocaleString()} splits · {rowKeys.length} rows x {nCols} columns · {measureLabelOf(measureId)} ({measureAgg})
          {capped && <span style={{ color: B.redTx, marginLeft: 6 }}>· flat pull capped at {rowCap.toLocaleString()}</span>}
        </div>
        <div style={{ background: B.white, border: `0.5px solid ${B.lgray}`, borderRadius: 12, overflowX: "auto" }}>
          {/* Header */}
          <div style={{ display: "grid", gridTemplateColumns: template, gap: 8, padding: "8px 14px", background: B.offwhite, borderBottom: `0.5px solid ${B.lgray}`, minWidth }}>
            <div style={{ fontSize: 10, color: "#888", textTransform: "uppercase", letterSpacing: ".04em", fontWeight: 700 }}>{rowDimLabel}</div>
            {colKeys.map((c) => <div key={c.key} style={{ fontSize: 10, color: c.isOther ? "#aaa" : "#888", textTransform: "uppercase", letterSpacing: ".04em", textAlign: "right", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontStyle: c.isOther ? "italic" : "normal" }} title={c.label}>{c.label}</div>)}
            <div style={{ fontSize: 10, color: "#888", textTransform: "uppercase", letterSpacing: ".04em", textAlign: "right", fontWeight: 700 }}>Total</div>
          </div>
          {/* Body */}
          {rowKeys.map((r) => (
            <div key={r.key} style={{ display: "grid", gridTemplateColumns: template, gap: 8, padding: "6px 14px", borderBottom: `0.5px solid ${B.lgray}`, fontSize: 12, minWidth }}>
              <div style={{ color: B.black, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={r.label}>{r.label}</div>
              {colKeys.map((c) => { const v = cells[r.key]?.[c.key]; return <div key={c.key} style={{ textAlign: "right", color: v == null ? "#ddd" : "#333", fontVariantNumeric: "tabular-nums" }}>{v == null ? "·" : fmtMeasure(v)}</div>; })}
              <div style={{ textAlign: "right", fontWeight: 700, color: B.black, fontVariantNumeric: "tabular-nums" }}>{fmtMeasure(rowTotals[r.key])}</div>
            </div>
          ))}
          {/* Footer */}
          <div style={{ display: "grid", gridTemplateColumns: template, gap: 8, padding: "9px 14px", background: B.offwhite, borderTop: `1.5px solid ${B.lgray}`, minWidth }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: B.black }}>Total</div>
            {colKeys.map((c) => <div key={c.key} style={{ textAlign: "right", fontWeight: 700, color: B.black, fontVariantNumeric: "tabular-nums" }}>{fmtMeasure(colTotals[c.key])}</div>)}
            <div style={{ textAlign: "right", fontWeight: 700, color: B.teal, fontVariantNumeric: "tabular-nums" }}>{fmtMeasure(grand)}</div>
          </div>
        </div>
      </>
    );
  }
}
