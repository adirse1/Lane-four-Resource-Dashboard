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

  // periodDetail is non-aggregate so its SOQL can't alias fields; flatten the SF
  // relationship objects back to the friendly keys the Time detail tab reads.
  // Tolerant of both shapes: live (nested) and fixtures (already friendly).
  async function fetchDetail(p) {
    const r = periodRange(p); if (!r) return [];
    const res = await callSF(periodDetail(r.start, r.end));
    return (res?.records || []).map((x) => ({
      resource: x.pse__Resource__r?.Name ?? x.resource ?? "",
      proj: x.pse__Project__r?.Name ?? x.proj ?? "",
      acct: x.pse__Project__r?.pse__Account__r?.Name ?? x.acct ?? "",
      grp: x.pse__Project__r?.pse__Group__r?.Name ?? x.grp ?? "",
      pm: x.pse__Project__r?.pse__Project_Manager__r?.Name ?? x.pm ?? "",
      hours: x.pse__Total_Hours__c ?? x.hours ?? 0,
      revenue: x.Total_Billable_Amount_Formula__c ?? x.revenue ?? 0,
      billable: x.pse__Billable__c ?? x.billable ?? false,
      credited: x.pse__Time_Credited__c ?? x.credited ?? false,
      startDate: x.pse__Start_Date__c ?? x.startDate ?? "",
      src: x.Project_Source__c ?? x.src ?? null,
      recordId: x.Id ?? x.recordId ?? null,
    }));
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
