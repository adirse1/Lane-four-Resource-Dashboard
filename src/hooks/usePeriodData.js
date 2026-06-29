// Owns the period actuals for the Actuals tab: two comparison periods (A, B) of
// revenue-by-PM and by-project, plus period A's vacation. Fetched once here. The
// Time report tab now owns its own data (useTimeReport), so detail is no longer
// fetched here; the periodDetail builder remains in queries.js (still tested).
import { useState, useCallback } from "react";
import { callSF } from "../lib/salesforce.js";
import { periodRange } from "../lib/period.js";
import {
  periodByPM, periodByProject, periodCredited, periodCreditedByProject, periodVacation,
} from "../lib/queries.js";

export function usePeriodData(periodA, periodB) {
  const [dataA, setDataA] = useState(null);
  const [dataB, setDataB] = useState(null);
  const [vacData, setVacData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadMsg, setLoadMsg] = useState("");
  const [sfError, setSfError] = useState(null);

  async function fetchPeriod(p) {
    const r = periodRange(p);
    if (!r) return null;
    const byPM = await callSF(periodByPM(r.start, r.end));
    const byProj = await callSF(periodByProject(r.start, r.end));
    const credited = await callSF(periodCredited(r.start, r.end));
    const creditedProj = await callSF(periodCreditedByProject(r.start, r.end));
    const vac = await callSF(periodVacation(r.start, r.end));

    const pmMap = {}, projList = byProj?.records || [], creditMap = {}, creditProjMap = {}, vacResMap = {};
    (byPM?.records || []).forEach((r) => {
      const g = r.grp || "Other", pm = r.pm || "Unknown";
      if (!pmMap[g]) pmMap[g] = { revenue: 0, hours: 0, splits: 0, pms: {} };
      pmMap[g].revenue += (r.revenue || 0); pmMap[g].hours += (r.hours || 0); pmMap[g].splits += (r.splits || 0);
      if (!pmMap[g].pms[pm]) pmMap[g].pms[pm] = { revenue: 0, hours: 0, splits: 0 };
      pmMap[g].pms[pm].revenue += (r.revenue || 0); pmMap[g].pms[pm].hours += (r.hours || 0); pmMap[g].pms[pm].splits += (r.splits || 0);
    });
    (credited?.records || []).forEach((r) => { const g = r.grp || "Other", pm = r.pm || "Unknown"; creditMap[`${g}::${pm}`] = (creditMap[`${g}::${pm}`] || 0) + (r.hours || 0); });
    // Credited by project (account-level) and vacation by resource (mapped to a
    // pod/director in ActualsTab via the shared hierarchy, since vacation is one
    // internal project, not tied to the project-manager hierarchy).
    (creditedProj?.records || []).forEach((r) => { if (r.projId) creditProjMap[r.projId] = (creditProjMap[r.projId] || 0) + (r.hours || 0); });
    (vac?.records || []).forEach((r) => { if (r.resource) vacResMap[r.resource] = (vacResMap[r.resource] || 0) + (r.hours || 0); });
    return { pmMap, projList, creditMap, creditProjMap, vacResMap };
  }

  async function fetchVac(p) {
    const r = periodRange(p); if (!r) return [];
    const res = await callSF(periodVacation(r.start, r.end));
    return res?.records || [];
  }

  const loadData = useCallback(async () => {
    if (!periodA || !periodB) return;
    setLoading(true); setSfError(null);
    try {
      setLoadMsg(`Pulling ${periodA.label} data...`);
      const a = await fetchPeriod(periodA);
      setLoadMsg(`Pulling ${periodB.label} data...`);
      const b = await fetchPeriod(periodB);
      setLoadMsg("Pulling vacation data...");
      const vac = await fetchVac(periodA);
      setDataA(a); setDataB(b); setVacData(vac);
    } catch (e) { setSfError(String(e)); }
    setLoading(false);
  }, [periodA, periodB]);

  return { dataA, dataB, vacData, loading, loadMsg, sfError, loadData };
}
