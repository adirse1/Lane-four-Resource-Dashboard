// Owns the period actuals shared by Actuals / Forecast / Time detail:
// two comparison periods (A, B) of revenue-by-PM and by-project, plus period A's
// vacation and timecard detail. Fetched once here, consumed by three tabs.
import { useState, useCallback } from "react";
import { callSF } from "../lib/salesforce.js";
import { periodRange } from "../lib/period.js";
import {
  periodByPM, periodByProject, periodCredited, periodVacation, periodDetail,
} from "../lib/queries.js";

export function usePeriodData(periodA, periodB) {
  const [dataA, setDataA] = useState(null);
  const [dataB, setDataB] = useState(null);
  const [vacData, setVacData] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadMsg, setLoadMsg] = useState("");
  const [sfError, setSfError] = useState(null);

  async function fetchPeriod(p) {
    const r = periodRange(p);
    if (!r) return null;
    const byPM = await callSF(periodByPM(r.start, r.end));
    const byProj = await callSF(periodByProject(r.start, r.end));
    const credited = await callSF(periodCredited(r.start, r.end));

    const pmMap = {}, projList = byProj?.records || [], creditMap = {};
    (byPM?.records || []).forEach((r) => {
      const g = r.grp || "Other", pm = r.pm || "Unknown";
      if (!pmMap[g]) pmMap[g] = { revenue: 0, hours: 0, splits: 0, pms: {} };
      pmMap[g].revenue += (r.revenue || 0); pmMap[g].hours += (r.hours || 0); pmMap[g].splits += (r.splits || 0);
      if (!pmMap[g].pms[pm]) pmMap[g].pms[pm] = { revenue: 0, hours: 0, splits: 0 };
      pmMap[g].pms[pm].revenue += (r.revenue || 0); pmMap[g].pms[pm].hours += (r.hours || 0); pmMap[g].pms[pm].splits += (r.splits || 0);
    });
    (credited?.records || []).forEach((r) => { const g = r.grp || "Other", pm = r.pm || "Unknown"; creditMap[`${g}::${pm}`] = (creditMap[`${g}::${pm}`] || 0) + (r.hours || 0); });
    return { pmMap, projList, creditMap };
  }

  async function fetchVac(p) {
    const r = periodRange(p); if (!r) return [];
    const res = await callSF(periodVacation(r.start, r.end));
    return res?.records || [];
  }

  async function fetchDetail(p) {
    const r = periodRange(p); if (!r) return [];
    const res = await callSF(periodDetail(r.start, r.end));
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
      setLoadMsg("Pulling time detail...");
      const det = await fetchDetail(periodA);
      setDataA(a); setDataB(b); setVacData(vac); setDetailData(det);
    } catch (e) { setSfError(String(e)); }
    setLoading(false);
  }, [periodA, periodB]);

  return { dataA, dataB, vacData, detailData, loading, loadMsg, sfError, loadData };
}
