// Forward-looking weekly capacity grid. Pulls Scheduled billable assignments for
// the Aldus/Meghan people (scoped by resource, from the shared hierarchy H), then
// distributes each assignment's pse__Scheduled_Hours__c (the span total) across the
// working days in its span and buckets that into Monday-weeks. This reproduces the
// Salesforce resource planner; the related Schedule's weekday pattern is a 40h
// default in this org and is NOT used. Capacity per week comes from the shared
// working-day math, driven by the Options holiday toggles. Read-only first pass.
//
// Returns per person: a week rollup ({h, n}) and a per-project (per-assignment)
// breakdown so each person can expand to the projects behind their committed hours.
import { useState, useCallback, useMemo, useRef } from "react";
import { callSF } from "../lib/salesforce.js";
import { saveScenario as driveSaveScenario, loadScenario as driveLoadScenario, listScenarios as driveListScenarios } from "../lib/drive.js";
import { scheduledAssignments } from "../lib/queries.js";
import { getEnabledHols, calcWDWeek, countWD } from "../lib/holidays.js";
import { DIRECTORS } from "../constants/teams.js";
import { MONTHS } from "../constants/brand.js";

const NUM_WEEKS = 16;
const DAILY_HRS = 8;

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parseISO = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const minD = (a, b) => (a < b ? a : b);
const maxD = (a, b) => (a > b ? a : b);
// Monday of the current week.
function currentMonday() {
  const t = new Date();
  return addDays(new Date(t.getFullYear(), t.getMonth(), t.getDate()), -((t.getDay() + 6) % 7));
}

// People under the Aldus + Meghan directors in the shared hierarchy.
function scopedPeople(H) {
  const out = new Set();
  (H?.directors || []).forEach((d) => {
    if (!DIRECTORS.includes(d.name)) return;
    (d.directMembers || []).forEach((m) => out.add(m));
    (d.pods || []).forEach((p) => (p.members || []).forEach((m) => out.add(m)));
  });
  return [...out];
}

export function useResourcePlanner(H, hState) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadMsg, setLoadMsg] = useState("");
  const [error, setError] = useState(null);

  // ── Scenario overlay: hypothetical people and project assignments, LOCAL React
  // state only. Never queried, never written back to Salesforce. Used for planning
  // unsigned clients / not-yet-started people. Merged with committed hours below.
  //   overlayPeople: { id, name, dir, pod }  (a hypothetical row)
  //   overlayAsgs:   { id, person, project, hours[NUM_WEEKS] }
  //     person = a real person's name, or an overlayPerson id.
  const [overlayPeople, setOverlayPeople] = useState([]);
  const [overlayAsgs, setOverlayAsgs] = useState([]);
  // Overlay-only reassignment: personKey -> { dir, pod }. Moves a person between
  // pods/directors in the planner without touching hierarchy.json or Salesforce.
  const [overlayMoves, setOverlayMoves] = useState({});
  // Forecast overrides on committed assignments: { "personKey||project": { weekIdx: hours } }.
  // The Salesforce value is the baseline; an override replaces it for planning only.
  const [projForecast, setProjForecast] = useState({});
  const idRef = useRef(0);
  const nid = () => `o${++idRef.current}`;

  const setForecastCell = useCallback((personKey, project, i, val) => {
    const v = Math.max(0, Number(val) || 0);
    const key = `${personKey}||${project}`;
    setProjForecast((m) => ({ ...m, [key]: { ...(m[key] || {}), [i]: v } }));
  }, []);
  const resetForecast = useCallback((personKey, project) => {
    const key = `${personKey}||${project}`;
    setProjForecast((m) => { const n = { ...m }; delete n[key]; return n; });
  }, []);

  const moveOverlayPerson = useCallback((key, dir, pod) => {
    setOverlayMoves((m) => ({ ...m, [key]: { dir, pod } }));
  }, []);
  const resetOverlayMove = useCallback((key) => {
    setOverlayMoves((m) => { const n = { ...m }; delete n[key]; return n; });
  }, []);

  const addOverlayPerson = useCallback((name, dir, pod) => {
    const id = nid();
    setOverlayPeople((a) => [...a, { id, name: name || "Unnamed", dir, pod }]);
    return id;
  }, []);
  const removeOverlayPerson = useCallback((id) => {
    setOverlayPeople((a) => a.filter((p) => p.id !== id));
    setOverlayAsgs((a) => a.filter((x) => x.person !== id));
  }, []);
  const addOverlayAsg = useCallback((person, project, weekly) => {
    const w = Number(weekly) || 0;
    setOverlayAsgs((a) => [...a, { id: nid(), person, project: project || "Hypothetical", hours: Array(NUM_WEEKS).fill(w) }]);
  }, []);
  const setOverlayCell = useCallback((id, i, val) => {
    const v = Math.max(0, Number(val) || 0);
    setOverlayAsgs((a) => a.map((x) => (x.id === id ? { ...x, hours: x.hours.map((h, j) => (j === i ? v : h)) } : x)));
  }, []);
  const removeOverlayAsg = useCallback((id) => setOverlayAsgs((a) => a.filter((x) => x.id !== id)), []);

  // Per-week overlay hours for a person key (real name or overlay-person id).
  const overlayHoursFor = useCallback((key) => {
    const out = Array(NUM_WEEKS).fill(0);
    overlayAsgs.forEach((a) => { if (a.person === key) a.hours.forEach((h, i) => { out[i] += h; }); });
    return out;
  }, [overlayAsgs]);

  // Week columns, per-week capacity, and a holiday set spanning the years an
  // assignment span might touch. Recomputed when the holiday toggles change.
  const { weeks, capacity, holDates } = useMemo(() => {
    const mon = currentMonday();
    const starts = [];
    for (let i = 0; i < NUM_WEEKS; i++) starts.push(addDays(mon, i * 7));
    const holDates = new Set([2024, 2025, 2026, 2027, 2028].flatMap((y) => getEnabledHols(y, "CA", hState).map((h) => h.date)));
    return {
      weeks: starts.map((w) => ({ start: w, iso: iso(w), label: `${MONTHS[w.getMonth()]} ${w.getDate()}` })),
      capacity: starts.map((w) => calcWDWeek(w, holDates) * DAILY_HRS),
      holDates,
    };
  }, [hState]);

  // ── Scenario persistence (Drive choke-point) ──────────────────────────────────
  // Serialize the whole overlay (never committed data). weekStart lets a scenario
  // saved on a different date re-align to the current 16-week window on load.
  // Declared after `weeks` so the dependency arrays can reference it (no TDZ).
  const getScenario = useCallback(() => ({
    v: 1, weekStart: weeks[0]?.iso, overlayPeople, overlayAsgs, overlayMoves, projForecast,
  }), [weeks, overlayPeople, overlayAsgs, overlayMoves, projForecast]);

  const applyScenario = useCallback((s) => {
    if (!s) return;
    const cur = parseISO(weeks[0].iso);
    const saved = s.weekStart ? parseISO(s.weekStart) : cur;
    const delta = Math.round((cur - saved) / (7 * 86400000)); // weeks the window shifted
    const shift = (arr) => Array.from({ length: NUM_WEEKS }, (_, j) => { const k = j + delta; return k >= 0 && k < (arr?.length || 0) ? Number(arr[k]) || 0 : 0; });
    const shiftMap = (m) => { const o = {}; Object.entries(m || {}).forEach(([key, wk]) => { const nw = {}; Object.entries(wk).forEach(([iStr, v]) => { const k = Number(iStr) - delta; if (k >= 0 && k < NUM_WEEKS) nw[k] = v; }); if (Object.keys(nw).length) o[key] = nw; }); return o; };
    setOverlayPeople(Array.isArray(s.overlayPeople) ? s.overlayPeople : []);
    setOverlayMoves(s.overlayMoves && typeof s.overlayMoves === "object" ? s.overlayMoves : {});
    setProjForecast(shiftMap(s.projForecast));
    setOverlayAsgs((Array.isArray(s.overlayAsgs) ? s.overlayAsgs : []).map((a) => ({ ...a, hours: shift(a.hours) })));
    // Advance the id counter past restored ids so new ones never collide.
    const ids = [...(s.overlayPeople || []).map((p) => p.id), ...(s.overlayAsgs || []).map((a) => a.id)];
    const maxN = ids.reduce((m, id) => { const n = parseInt(String(id).replace(/^o/, ""), 10); return Number.isNaN(n) ? m : Math.max(m, n); }, idRef.current);
    idRef.current = maxN;
  }, [weeks]);

  const saveScenario = useCallback((name) => driveSaveScenario(name, { ...getScenario(), savedAt: new Date().toISOString() }), [getScenario]);
  const listScenarios = useCallback(() => driveListScenarios(), []);
  const loadScenario = useCallback(async (name) => { const s = await driveLoadScenario(name); applyScenario(s); return s; }, [applyScenario]);

  const load = useCallback(async () => {
    const people = scopedPeople(H);
    // Hierarchy not ready yet: leave data null so the spinner stays and this
    // re-runs when H populates (rather than stranding on an empty grid).
    if (!people.length) return;
    setLoading(true); setError(null); setLoadMsg("Loading assignments...");
    try {
      const wStart = weeks[0].iso;
      const wEnd = iso(addDays(weeks[weeks.length - 1].start, 6));
      const res = await callSF(scheduledAssignments(wStart, wEnd, people));
      const out = {};
      people.forEach((p) => { out[p] = { week: weeks.map(() => ({ h: 0, n: 0 })), projects: [] }; });
      (res?.records || []).forEach((r) => {
        const name = r.pse__Resource__r?.Name;
        if (!name || !out[name]) return;
        const start = r.pse__Start_Date__c, end = r.pse__End_Date__c, sched = r.pse__Scheduled_Hours__c || 0;
        if (!start || !end || sched <= 0) return;
        const sD = parseISO(start), eD = parseISO(end);
        const spanWD = countWD(sD, eD, holDates);
        if (spanWD <= 0) return;
        const rate = sched / spanWD; // hours per working day, spread across the span
        // Round to whole hours per week (the fractional rate is a distribution
        // artifact, not real schedule precision). Project rows then sum cleanly.
        const cells = weeks.map((wk) => {
          const lo = maxD(wk.start, sD), hi = minD(addDays(wk.start, 6), eD);
          const wd = countWD(lo, hi, holDates);
          return wd > 0 ? Math.round(rate * wd) : 0;
        });
        if (cells.reduce((a, b) => a + b, 0) <= 0) return;
        out[name].projects.push({
          proj: r.pse__Project__r?.Name || "(no project)",
          grp: r.pse__Project__r?.pse__Group__r?.Name || "",
          pm: r.pse__Project__r?.pse__Project_Manager__r?.Name || "",
          cells,
        });
        cells.forEach((h, i) => { if (h > 0) { out[name].week[i].h += h; out[name].week[i].n += 1; } });
      });
      setData(out);
    } catch (e) { console.error(e); setError(String(e?.message || e)); }
    setLoading(false);
  }, [H, weeks, holDates]);

  return {
    weeks, capacity, data, loading, loadMsg, error, load,
    overlayPeople, overlayAsgs, overlayHoursFor, overlayMoves,
    addOverlayPerson, removeOverlayPerson, addOverlayAsg, setOverlayCell, removeOverlayAsg,
    moveOverlayPerson, resetOverlayMove,
    projForecast, setForecastCell, resetForecast,
    saveScenario, listScenarios, loadScenario,
  };
}
