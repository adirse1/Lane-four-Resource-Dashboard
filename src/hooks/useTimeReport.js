// Time report data controller. Owns the month and group-by choices, the visible
// column set (a live field picker), generates the SOQL via the dynamic
// buildTimecardReport, fetches approved timecard splits for the Aldus/Meghan
// scope, and rolls them up client-side under the chosen grouping with per-column
// numeric subtotals and a grand total.
//
// The field list comes from a Salesforce describe (describeSObject, the data
// choke-point), NOT hardcoded: the object's own fields plus a curated set of
// relationship columns. Director/pod are not Salesforce fields; they derive from
// the PM name via constants/teams.js, so grouping by them is resolved here. The
// group key fields are ALWAYS in the SELECT (REPORT_REQUIRED_FIELDS), so changing
// which columns are visible never breaks grouping.
import { useState, useCallback, useEffect, useMemo } from "react";
import { callSF, describeSObject } from "../lib/salesforce.js";
import { periodRange } from "../lib/period.js";
import { buildTimecardReport, REPORT_RELATION_FIELDS, REPORT_REQUIRED_FIELDS, REPORT_ROW_CAP } from "../lib/queries.js";
import { pivot, groupTree, DEFAULT_MAX_COLS } from "../lib/pivot.js";
import { DIRS } from "../constants/teams.js";

const SOBJECT = "pse__Timecard__c";
const NUMERIC_TYPES = new Set(["double", "currency", "int", "percent"]);
// Field types worth offering as columns (skip blobs, addresses, base64, etc.).
const DISPLAY_TYPES = new Set(["double", "currency", "int", "percent", "boolean", "date", "datetime", "string", "picklist", "textarea", "id", "email", "phone", "url"]);

// Default visible columns on first load (all are always-valid paths).
export const DEFAULT_COLUMNS = [
  "pse__Resource__r.Name",
  "pse__Project__r.Name",
  "pse__Project__r.pse__Account__r.Name",
  "pse__Total_Hours__c",
  "Total_Billable_Amount_Formula__c",
  "pse__Start_Date__c",
];

// Derived pivot dimensions: not Salesforce fields, computed from the PM name via
// teams.js. Ids are "__"-prefixed so they never enter the SELECT (they read the
// always-present PM path instead). They appear in the field palette as ordinary
// draggable dimensions, alongside the describe-driven fields.
const DERIVED_DIMS = [
  { id: "__director", label: "Director" },
  { id: "__pod", label: "Pod" },
];
export const AGGREGATIONS = [
  { id: "sum", label: "Sum" },
  { id: "count", label: "Count" },
  { id: "avg", label: "Avg" },
];

// In-scope pods are the PM names listed under each director; filtering on them
// both scopes the pull and excludes out-of-scope groups (e.g. Tatiane's).
const POD_PMS = Object.values(DIRS).flatMap((d) => d.pods);
const PM_TO_DIRECTOR = {};
Object.entries(DIRS).forEach(([dir, d]) => d.pods.forEach((pm) => { PM_TO_DIRECTOR[pm] = dir; }));

const PM_PATH = "pse__Project__r.pse__Project_Manager__r.Name";

// Read a value out of a record by dotted relationship path. Tolerates flat keys.
function valueAt(rec, path) {
  if (rec == null) return undefined;
  if (path in rec) return rec[path];
  return path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), rec);
}

export function useTimeReport(monthOpts) {
  const [available, setAvailable] = useState([]); // [{name,label,type,groupable,filterable,source}]
  const [fieldsLoading, setFieldsLoading] = useState(false);
  const [fieldsError, setFieldsError] = useState(null);

  const [selected, setSelected] = useState(DEFAULT_COLUMNS);
  // Table view row nesting: an ordered list of dimensions (outermost first). This
  // replaces the old single group-by toggle; the Rows well drives multi-level
  // grouping, parallel to the column picker (the visible leaf-row columns).
  const [tableRowDimIds, setTableRowDimIds] = useState(["__pod"]);
  const [month, setMonth] = useState((monthOpts && monthOpts[0]) || null);

  // Matrix (pivot) view: ordered Rows / Columns dimension wells (the pivot engine
  // already supports multi-level via key tuples) and one Values measure with an
  // aggregation. Table view keeps the flat column picker above.
  const [viewMode, setViewMode] = useState("table"); // "table" | "matrix"
  const [rowDimIds, setRowDimIds] = useState(["__pod"]);
  const [colDimIds, setColDimIds] = useState(["pse__Project__r.Name"]);
  const [measureId, setMeasureId] = useState("pse__Total_Hours__c");
  const [measureAgg, setMeasureAgg] = useState("sum");

  const [rows, setRows] = useState(null);
  const [rowCount, setRowCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Available fields: the object's own describe fields plus the curated relation
  // columns. Loaded once. Relation columns win the label if names collide.
  useEffect(() => {
    let live = true;
    setFieldsLoading(true); setFieldsError(null);
    describeSObject(SOBJECT)
      .then((d) => {
        if (!live) return;
        const own = (d?.fields || [])
          .filter((f) => DISPLAY_TYPES.has(f.type))
          .map((f) => ({ name: f.name, label: f.label, type: f.type, groupable: f.groupable, filterable: f.filterable, source: "field" }));
        const rel = REPORT_RELATION_FIELDS.map((f) => ({ name: f.name, label: f.label, type: f.type, groupable: true, filterable: true, source: "relation" }));
        const byName = new Map();
        [...rel, ...own].forEach((f) => { if (!byName.has(f.name)) byName.set(f.name, f); });
        setAvailable([...byName.values()].sort((a, b) => a.label.localeCompare(b.label)));
      })
      .catch((e) => { if (live) setFieldsError(String(e?.message || e)); })
      .finally(() => { if (live) setFieldsLoading(false); });
    return () => { live = false; };
  }, []);

  // Numeric columns drive subtotals. Seed with the known default numerics so
  // subtotals work even before the describe response lands.
  const numericNames = useMemo(() => {
    const s = new Set(["pse__Total_Hours__c", "Total_Billable_Amount_Formula__c"]);
    available.forEach((f) => { if (NUMERIC_TYPES.has(f.type)) s.add(f.name); });
    return s;
  }, [available]);
  const labelOf = useCallback((name) => available.find((f) => f.name === name)?.label || name, [available]);
  const typeOf = useCallback((name) => available.find((f) => f.name === name)?.type || "string", [available]);

  const range = useMemo(() => periodRange(month), [month]);

  // Real Salesforce fields the matrix needs in the SELECT (derived dims read the
  // always-present PM path, so they add nothing here).
  const matrixRealFields = useMemo(() => {
    const f = new Set();
    [...rowDimIds, ...colDimIds, measureId].forEach((id) => { if (id && !id.startsWith("__")) f.add(id); });
    return [...f];
  }, [rowDimIds, colDimIds, measureId]);

  // The fields the active view needs pulled: the picker columns (table) or the
  // pivot's real fields (matrix). The builder always merges in the group/scope keys.
  const activeFields = useMemo(() => (viewMode === "matrix" ? matrixRealFields : selected), [viewMode, matrixRealFields, selected]);

  // The query that produced the data (shown read-only). Stays in sync with the view.
  const soql = useMemo(() => {
    if (!range) return "";
    return buildTimecardReport({ fields: activeFields, monthStart: range.start, monthEnd: range.end, pmNames: POD_PMS, orderBy: PM_PATH });
  }, [range, activeFields]);

  // Re-run when the month or the SET of pulled fields changes. Column reorder,
  // group-by, and pivot row/col/measure choices that add no new SELECT field do
  // not trigger a re-query (the pivot recomputes client-side).
  const activeKey = useMemo(() => [...activeFields].sort().join("|"), [activeFields]);
  const load = useCallback(async () => {
    if (!range) return;
    setLoading(true); setError(null);
    try {
      const res = await callSF(soql);
      const paths = [...new Set([...REPORT_REQUIRED_FIELDS, ...activeFields])];
      const flat = (res?.records || []).map((r) => {
        const o = {}; paths.forEach((p) => { o[p] = valueAt(r, p); }); return o;
      });
      setRows(flat);
      setRowCount(res?.totalSize ?? flat.length);
    } catch (e) { setError(String(e?.message || e)); setRows(null); }
    setLoading(false);
  }, [soql, range, activeFields]);

  useEffect(() => { if (range) load(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [month, activeKey]);

  // ── Matrix (pivot) ────────────────────────────────────────────────────────────
  // The field palette is describe-driven: derived dims (Pod, Director) first, then
  // the object's own fields. Each field is classified as a dimension or a measure
  // so the wells can accept the right kind. Numeric fields are measures; the rest
  // (and the derived dims) are dimensions. Id and raw datetimes are dropped as
  // high-cardinality / unhelpful.
  const fieldCatalog = useMemo(() => {
    const out = DERIVED_DIMS.map((d) => ({ id: d.id, label: d.label, type: "derived", kind: "dimension", source: "derived" }));
    available.forEach((f) => {
      if (f.name === "Id" || f.type === "datetime") return;
      out.push({ id: f.name, label: f.label, type: f.type, kind: NUMERIC_TYPES.has(f.type) ? "measure" : "dimension", source: f.source });
    });
    return out;
  }, [available]);
  const fieldOf = useCallback((id) => fieldCatalog.find((f) => f.id === id), [fieldCatalog]);
  const dimLabelOf = useCallback((id) => fieldOf(id)?.label || id, [fieldOf]);
  const measureLabelOf = useCallback((id) => fieldOf(id)?.label || id, [fieldOf]);
  const kindOf = useCallback((id) => fieldOf(id)?.kind || (NUMERIC_TYPES.has(typeOf(id)) ? "measure" : "dimension"), [fieldOf, typeOf]);

  // Accessor for a dimension id: derived ones read the PM path; real ones read the
  // flattened relationship field.
  const dimGet = useCallback((id) => {
    if (id === "__director") return (r) => PM_TO_DIRECTOR[r[PM_PATH]] || "Other";
    if (id === "__pod") return (r) => r[PM_PATH] || "Unknown";
    return (r) => r[id];
  }, []);

  const matrix = useMemo(() => {
    if (viewMode !== "matrix" || !rows) return null;
    const toDims = (ids) => ids.map((id) => ({ id, label: dimLabelOf(id), get: dimGet(id) }));
    const measure = { id: measureId, label: measureLabelOf(measureId), agg: measureAgg, get: (r) => Number(r[measureId]) || 0 };
    return pivot(rows, { rowDims: toDims(rowDimIds), colDims: toDims(colDimIds), measure, maxCols: DEFAULT_MAX_COLS });
  }, [viewMode, rows, rowDimIds, colDimIds, measureId, measureAgg, dimGet, dimLabelOf, measureLabelOf]);

  // ── Table view nesting (shared groupTree primitive) ───────────────────────────
  // The Rows well drives multi-level grouping; subtotals are the sum of each
  // numeric value column at every level. Same grouping/subtotal function as the
  // matrix row axis (lib/pivot.js), not a second implementation.
  const tableMeasures = useMemo(() => selected.filter((n) => numericNames.has(n)).map((n) => ({ id: n, agg: "sum", get: (r) => Number(r[n]) || 0 })), [selected, numericNames]);
  const tree = useMemo(() => {
    if (viewMode !== "table" || !rows) return null;
    const dims = tableRowDimIds.map((id) => ({ id, label: dimLabelOf(id), get: dimGet(id) }));
    return groupTree(rows, dims, tableMeasures);
  }, [viewMode, rows, tableRowDimIds, tableMeasures, dimGet, dimLabelOf]);

  // Well mutations. Dimensions go to Rows/Columns (ordered, no dupes); a measure
  // sets the single Values field. Reorder and remove operate within a well.
  const reorder = (arr, from, to) => {
    if (from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) return arr;
    const n = [...arr]; const [m] = n.splice(from, 1); n.splice(to, 0, m); return n;
  };
  const addToRows = useCallback((id) => setRowDimIds((s) => (s.includes(id) ? s : [...s, id])), []);
  const addToCols = useCallback((id) => setColDimIds((s) => (s.includes(id) ? s : [...s, id])), []);
  const removeFromRows = useCallback((id) => setRowDimIds((s) => s.filter((x) => x !== id)), []);
  const removeFromCols = useCallback((id) => setColDimIds((s) => s.filter((x) => x !== id)), []);
  const reorderRows = useCallback((from, to) => setRowDimIds((s) => reorder(s, from, to)), []);
  const reorderCols = useCallback((from, to) => setColDimIds((s) => reorder(s, from, to)), []);
  const setMeasure = useCallback((id) => setMeasureId(id), []);
  // Table Rows-well mutations (same shape as the matrix wells).
  const addTableRow = useCallback((id) => setTableRowDimIds((s) => (s.includes(id) ? s : [...s, id])), []);
  const removeTableRow = useCallback((id) => setTableRowDimIds((s) => s.filter((x) => x !== id)), []);
  const reorderTableRow = useCallback((from, to) => setTableRowDimIds((s) => reorder(s, from, to)), []);

  // Column picker mutations (ordered, no duplicates).
  const addField = useCallback((name) => setSelected((s) => (s.includes(name) ? s : [...s, name])), []);
  const removeField = useCallback((name) => setSelected((s) => s.filter((x) => x !== name)), []);
  const reorderField = useCallback((from, to) => setSelected((s) => {
    if (from === to || from < 0 || to < 0 || from >= s.length || to >= s.length) return s;
    const n = [...s]; const [m] = n.splice(from, 1); n.splice(to, 0, m); return n;
  }), []);

  // Non-blocking warnings, mode-aware. Grouping itself never breaks (the key is
  // always queried); these flag setups that can't be summarised or got capped.
  const warnings = useMemo(() => {
    const w = [];
    if (viewMode === "matrix") {
      if (!measureId) w.push("Drag a measure into Values to populate the matrix.");
      if (!rowDimIds.length && !colDimIds.length) w.push("Add a row or column dimension, otherwise the matrix is a single grand total.");
      if (matrix?.capped) w.push(`Columns capped: showing the top ${matrix.colKeys.length - 1} of ${matrix.distinctColCount} values plus Other. Choose a lower-cardinality column field for full detail.`);
    } else {
      if (selected.length === 0) w.push("No columns selected. Add at least one field to see the report.");
      else if (!selected.some((n) => numericNames.has(n))) w.push("No numeric column selected, so the subtotals and grand total are hidden. Add hours or revenue to summarise.");
    }
    return w;
  }, [viewMode, measureId, rowDimIds, colDimIds, matrix, selected, numericNames]);

  const capped = rowCount >= REPORT_ROW_CAP;

  return {
    available, fieldsLoading, fieldsError,
    selected, addField, removeField, reorderField,
    numericNames, labelOf, typeOf,
    month, setMonth, monthOpts,
    soql, tree, warnings,
    loading, error, load, rowCount, capped, rowCap: REPORT_ROW_CAP,
    // table row nesting
    tableRowDimIds, addTableRow, removeTableRow, reorderTableRow,
    // matrix view
    viewMode, setViewMode,
    rowDimIds, colDimIds, measureId, measureAgg, setMeasureAgg,
    addToRows, addToCols, removeFromRows, removeFromCols, reorderRows, reorderCols, setMeasure,
    fieldCatalog, fieldOf, kindOf, dimLabelOf, measureLabelOf, matrix,
  };
}
