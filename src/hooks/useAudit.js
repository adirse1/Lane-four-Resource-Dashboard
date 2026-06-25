// Runs the five data-quality checks for the Data audit tab.
import { useState, useCallback } from "react";
import { callSF } from "../lib/salesforce.js";
import {
  auditZeroRates, auditZeroRevSplits, auditNullSrc, auditFormulaDrift, auditZeroSchedHrs,
} from "../lib/queries.js";

export function useAudit() {
  const [auditData, setAuditData] = useState(null);
  const [auditLoading, setAuditLoading] = useState(false);

  const fetchAuditData = useCallback(async () => {
    setAuditLoading(true);
    try {
      const zeroRates = await callSF(auditZeroRates());
      const zeroRevSplits = await callSF(auditZeroRevSplits());
      const nullSrc = await callSF(auditNullSrc());
      const formulaDrift = await callSF(auditFormulaDrift());
      const zeroSchedHrs = await callSF(auditZeroSchedHrs());
      setAuditData({
        zeroRates: zeroRates?.records || [],
        zeroRevSplits: zeroRevSplits?.records || [],
        nullSrc: nullSrc?.records || [],
        formulaDrift: formulaDrift?.records || [],
        zeroSchedHrs: zeroSchedHrs?.records || [],
        fetchedAt: new Date().toLocaleString(),
      });
    } catch (e) { console.error(e); }
    setAuditLoading(false);
  }, []);

  return { auditData, auditLoading, fetchAuditData };
}
