// Forward-looking weekly capacity grid. Pulls Scheduled billable assignments for
// the Aldus/Meghan people (scoped by resource, from the shared hierarchy H), then
// buckets each assignment's Schedule weekday pattern into Monday-weeks. Capacity
// per week comes from the shared working-day math (calcWDWeek), driven by the
// Options holiday toggles. Read-only first pass: no cell editing.
import { useState, useCallback, useMemo } from "react";
import { callSF } from "../lib/salesforce.js";
import { resourcePlannerAssignments } from "../lib/queries.js";
import { getEnabledHols, calcWDWeek } from "../lib/holidays.js";
import { DIRECTORS } from "../constants/teams.js";
import { MONTHS } from "../constants/brand.js";

const NUM_WEEKS = 16;
const DAILY_HRS = 8;

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
// Monday of the current week.
function currentMonday() {
  const t = new Date();
  return addDays(new Date(t.getFullYear(), t.getMonth(), t.getDate()), -((t.getDay() + 6) % 7));
}
// Schedule field keyed by JS getDay() (0=Sun .. 6=Sat).
const DOW_FIELD = [
  "pse__Sunday_Hours__c", "pse__Monday_Hours__c", "pse__Tuesday_Hours__c", "pse__Wednesday_Hours__c",
  "pse__Thursday_Hours__c", "pse__Friday_Hours__c", "pse__Saturday_Hours__c",
];

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
  const [cells, setCells] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadMsg, setLoadMsg] = useState("");

  // Week columns + per-week capacity (working days x 8h). Recomputed when the
  // holiday toggles change so a holiday week shows reduced capacity.
  const { weeks, capacity } = useMemo(() => {
    const mon = currentMonday();
    const starts = [];
    for (let i = 0; i < NUM_WEEKS; i++) starts.push(addDays(mon, i * 7));
    const years = [...new Set(starts.flatMap((w) => [w.getFullYear(), addDays(w, 6).getFullYear()]))];
    const holDates = new Set(years.flatMap((y) => getEnabledHols(y, "CA", hState).map((h) => h.date)));
    return {
      weeks: starts.map((w) => ({ start: w, iso: iso(w), label: `${MONTHS[w.getMonth()]} ${w.getDate()}` })),
      capacity: starts.map((w) => calcWDWeek(w, holDates) * DAILY_HRS),
    };
  }, [hState]);

  const load = useCallback(async () => {
    const people = scopedPeople(H);
    if (!people.length) { setCells({}); return; }
    setLoading(true); setLoadMsg("Loading assignments...");
    try {
      const wStart = weeks[0].iso;
      const wEnd = iso(addDays(weeks[weeks.length - 1].start, 6));
      const res = await callSF(resourcePlannerAssignments(wStart, wEnd, people));
      const out = {};
      people.forEach((p) => { out[p] = weeks.map(() => ({ h: 0, n: 0 })); });
      (res?.records || []).forEach((r) => {
        const name = r.pse__Resource__r?.Name;
        const s = r.pse__Schedule__r;
        if (!name || !out[name] || !s) return;
        const ss = s.pse__Start_Date__c, se = s.pse__End_Date__c;
        if (!ss || !se) return;
        weeks.forEach((wk, i) => {
          let wh = 0;
          for (let off = 0; off < 7; off++) {
            const day = addDays(wk.start, off);
            const dIso = iso(day);
            if (dIso < ss || dIso > se) continue;
            wh += s[DOW_FIELD[day.getDay()]] || 0;
          }
          if (wh > 0) { out[name][i].h += wh; out[name][i].n += 1; }
        });
      });
      setCells(out);
    } catch (e) { console.error(e); setCells({}); }
    setLoading(false);
  }, [H, weeks]);

  return { weeks, capacity, cells, loading, loadMsg, load };
}
