// Forward rolling 90-day capacity forecast (Aldus + Meghan, by pod). Committed
// scheduled hours vs working-day capacity = % utilized. Uses the SAME source as the
// resource planner (scheduledAssignments), but with includeNonBillable so committed
// time can be split into the three categories discovery confirmed exist forward:
//   billable     scheduled billable assignments
//   non-billable scheduled non-billable assignments (admin, prof dev, pre-sales...)
//   vacation     scheduled assignments on the VACATION_PROJECT (future PTO)
// Credited has no forward scheduled equivalent (it is a post-hoc timecard concept),
// so there is no credited segment. Each assignment's pse__Scheduled_Hours__c (span
// total) is distributed across its span working days and bucketed into three 30-day
// segments (next 30 / 31-60 / 61-90). Capacity = headcount x working days x 8h, via
// the shared working-day math (no hardcoding). All three categories count toward
// committed against capacity; capacity is NOT reduced for vacation (vacation shows
// as committed time, so the gap is true free capacity after PTO is accounted for).
import { useState, useCallback } from "react";
import { callSF } from "../lib/salesforce.js";
import { scheduledAssignments, VACATION_PROJECT } from "../lib/queries.js";
import { getEnabledHols, countWD } from "../lib/holidays.js";
import { DIRECTORS } from "../constants/teams.js";

const SEG_DAYS = 30, NUM_SEGS = 3, DAILY_HRS = 8;
const SEG_LABELS = ["Next 30 days", "Days 31 to 60", "Days 61 to 90"];

const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseISO = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const todayMidnight = () => { const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate()); };
const maxD = (a, b) => (a > b ? a : b);
const minD = (a, b) => (a < b ? a : b);

const scopedDirs = (H) => (H?.directors || []).filter((d) => DIRECTORS.includes(d.name));

export function useForecast(H, hState) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadMsg, setLoadMsg] = useState("");
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    const dirs = scopedDirs(H);
    const people = [];
    dirs.forEach((d) => {
      (d.directMembers || []).forEach((m) => people.push(m));
      (d.pods || []).forEach((p) => (p.members || []).forEach((m) => people.push(m)));
    });
    if (!people.length) return; // hierarchy not ready; re-runs when H changes

    setLoading(true); setError(null); setLoadMsg("Loading 90-day forecast...");
    try {
      const start = todayMidnight();
      const segs = Array.from({ length: NUM_SEGS }, (_, i) => {
        const s = addDays(start, i * SEG_DAYS);
        return { start: s, end: addDays(s, SEG_DAYS - 1) };
      });
      const winStart = iso(start), winEnd = iso(addDays(start, NUM_SEGS * SEG_DAYS - 1));
      const yset = new Set();
      for (let y = start.getFullYear(); y <= addDays(start, NUM_SEGS * SEG_DAYS).getFullYear(); y++) yset.add(y);
      const holDates = new Set([...yset].flatMap((y) => getEnabledHols(y, "CA", hState).map((h) => h.date)));
      const segWD = segs.map((s) => countWD(s.start, s.end, holDates));

      const res = await callSF(scheduledAssignments(winStart, winEnd, people, { includeNonBillable: true }));

      // Committed hours per person per segment, split by category: distribute each
      // assignment's scheduled-hours total across its span working days, bucket by
      // overlap, and route into billable / non-billable / vacation.
      const emptyCats = () => ({ billable: Array(NUM_SEGS).fill(0), nonbillable: Array(NUM_SEGS).fill(0), vacation: Array(NUM_SEGS).fill(0) });
      const perRes = {}; people.forEach((p) => { perRes[p] = emptyCats(); });
      (res?.records || []).forEach((r) => {
        const name = r.pse__Resource__r?.Name;
        if (!name || !perRes[name]) return;
        const sd = r.pse__Start_Date__c, ed = r.pse__End_Date__c, sched = r.pse__Scheduled_Hours__c || 0;
        if (!sd || !ed || sched <= 0) return;
        const proj = r.pse__Project__r?.Name || "";
        const cat = proj === VACATION_PROJECT ? "vacation" : (r.pse__Is_Billable__c ? "billable" : "nonbillable");
        const sD = parseISO(sd), eD = parseISO(ed);
        const span = countWD(sD, eD, holDates);
        if (span <= 0) return;
        const rate = sched / span;
        segs.forEach((seg, i) => {
          const wd = countWD(maxD(seg.start, sD), minD(seg.end, eD), holDates);
          if (wd > 0) perRes[name][cat][i] += rate * wd;
        });
      });

      // Sum a person's categories into total committed per segment.
      const totalOf = (cats) => cats.billable.map((b, i) => b + cats.nonbillable[i] + cats.vacation[i]);
      // Roll up to pod / director / all, with capacity = headcount x working days x 8.
      const buildGroup = (name, members) => {
        const segments = emptyCats();
        members.forEach((m) => {
          const pc = perRes[m]; if (!pc) return;
          for (let i = 0; i < NUM_SEGS; i++) { segments.billable[i] += pc.billable[i]; segments.nonbillable[i] += pc.nonbillable[i]; segments.vacation[i] += pc.vacation[i]; }
        });
        const capacity = segWD.map((wd) => members.length * wd * DAILY_HRS);
        return { name, headcount: members.length, committed: totalOf(segments), capacity, segments };
      };
      // One person: segments from perRes, capacity = working days x 8 (headcount 1).
      const memberGroup = (m) => { const pc = perRes[m] || emptyCats(); return { name: m, headcount: 1, committed: totalOf(pc), capacity: segWD.map((wd) => wd * DAILY_HRS), segments: pc }; };
      const buildPod = (name, names) => ({ ...buildGroup(name, names), members: names.map(memberGroup) });

      const directors = dirs.map((d) => {
        const pods = [];
        (d.pods || []).forEach((p) => { if ((p.members || []).length) pods.push(buildPod(p.name, p.members)); });
        if ((d.directMembers || []).length) pods.push(buildPod(d.name.split(" ")[0] + " (direct)", d.directMembers));
        const members = [...(d.directMembers || []), ...(d.pods || []).flatMap((p) => p.members || [])];
        return { ...buildGroup(d.name, members), pods };
      });

      setData({
        segs: segs.map((s, i) => ({ label: SEG_LABELS[i], startISO: iso(s.start), endISO: iso(s.end), wd: segWD[i] })),
        directors,
        overall: buildGroup("All teams", people),
        windowStart: winStart, windowEnd: winEnd,
      });
    } catch (e) { console.error(e); setError(String(e?.message || e)); }
    setLoading(false);
  }, [H, hState]);

  return { data, loading, loadMsg, error, load };
}
