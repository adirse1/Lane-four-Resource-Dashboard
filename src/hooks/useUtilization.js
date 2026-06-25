// Loads a month of utilization data (billable / credited / vacation hours vs
// capacity) for every resource, tagged with director + pod from the shared H.
import { useState, useCallback } from "react";
import { callSF } from "../lib/salesforce.js";
import { utilizationBillable, utilizationVacation, utilizationCredited } from "../lib/queries.js";
import { getEnabledHols, calcWD, calcWDElapsed } from "../lib/holidays.js";

export function useUtilization(H, hState) {
  const [uData, setUData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (y, m) => {
    setLoading(true); setUData(null);
    const ms = y + "-" + String(m).padStart(2, "0") + "-01";
    const me = y + "-" + String(m).padStart(2, "0") + "-" + new Date(y, m, 0).getDate();
    try {
      const [bill, vac, cred] = await Promise.all([
        callSF(utilizationBillable(ms, me)),
        callSF(utilizationVacation(ms, me)),
        callSF(utilizationCredited(ms, me)),
      ]);
      const hols = getEnabledHols(y, "CA", hState);
      const wd = calcWD(y, m, hols), wde = calcWDElapsed(y, m, hols), cap = wde * 8;
      const ppl = {};
      (bill?.records || []).forEach((r) => { if (!r.resource) return; if (!ppl[r.resource]) ppl[r.resource] = { name: r.resource, b: 0, cr: 0, v: 0, rev: 0, dirName: null, podName: null }; ppl[r.resource].b += (r.hours || 0); ppl[r.resource].rev += (r.revenue || 0); });
      (vac?.records || []).forEach((r) => { if (!r.resource) return; if (!ppl[r.resource]) ppl[r.resource] = { name: r.resource, b: 0, cr: 0, v: 0, rev: 0, dirName: null, podName: null }; ppl[r.resource].v += (r.hours || 0); });
      (cred?.records || []).forEach((r) => { if (!r.resource) return; if (!ppl[r.resource]) ppl[r.resource] = { name: r.resource, b: 0, cr: 0, v: 0, rev: 0, dirName: null, podName: null }; ppl[r.resource].cr += (r.hours || 0); });
      if (H) { H.directors.forEach((dir) => { dir.pods.forEach((pod) => { pod.members.forEach((mn) => { if (ppl[mn]) { ppl[mn].dirName = dir.name; ppl[mn].podName = pod.name; } }); }); (dir.directMembers || []).forEach((mn) => { if (ppl[mn]) { ppl[mn].dirName = dir.name; ppl[mn].podName = dir.name.split(" ")[0] + " (direct)"; } }); }); }
      Object.values(ppl).forEach((p) => { p.util = cap > 0 ? Math.min(((p.b + p.cr) / cap) * 100, 150) : 0; });
      setUData({ people: Object.values(ppl), wd, wde, cap, m, y });
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [H, hState]);

  return { uData, loading, load };
}
