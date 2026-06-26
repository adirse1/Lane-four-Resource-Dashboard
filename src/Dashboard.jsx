// Dashboard shell: owns the small amount of genuinely global state (active tab,
// MoM/QoQ mode, holiday toggles, the two comparison periods, the open audit key),
// wires the data hooks, and routes to one tab component. All data logic lives in
// hooks/; all SOQL in lib/queries.js; all presentation in tabs/ and components/.
// Rendered only once data access is ready (see App.jsx auth gate).
import { useState, useEffect } from "react";
import { B, FONT_IMPORT } from "./constants/brand.js";
import { genMonthOpts, genQuarterOpts } from "./lib/holidays.js";
import { useHierarchy } from "./hooks/useHierarchy.js";
import { usePeriodData } from "./hooks/usePeriodData.js";
import { useAudit } from "./hooks/useAudit.js";
import { Spinner, AuditPanel, ControlsBar } from "./components/index.js";
import HierarchyTab from "./tabs/HierarchyTab.jsx";
import UtilizationTab from "./tabs/UtilizationTab.jsx";
import ResourcePlannerTab from "./tabs/ResourcePlannerTab.jsx";
import ActualsTab from "./tabs/ActualsTab.jsx";
import ForecastTab from "./tabs/ForecastTab.jsx";
import TimeDetailTab from "./tabs/TimeDetailTab.jsx";
import AuditTab from "./tabs/AuditTab.jsx";
import OptionsTab from "./tabs/OptionsTab.jsx";

const TABS = [
  { id: "hierarchy", label: "Team hierarchy" },
  { id: "utilization", label: "Utilization" },
  { id: "planner", label: "Resource planner" },
  { id: "actuals", label: "Actuals" },
  { id: "forecast", label: "Forecast" },
  { id: "detail", label: "Time detail" },
  { id: "audit", label: "Data audit" },
  { id: "options", label: "Options" },
];

// sendPrompt was an artifact-injected global in the original build. Not wired
// yet; route it to a real implementation when the vacation-coverage AI workflow
// is rebuilt.
const sendPrompt = (p) => console.warn("sendPrompt not wired:", p);

export default function Dashboard() {
  const [tab, setTab] = useState("hierarchy");
  const [mode, setMode] = useState("mom");
  const [hState, setHState] = useState({});
  const [auditKey, setAuditKey] = useState(null);
  const [copyStatus, setCopyStatus] = useState("");

  const monthOpts = genMonthOpts(hState);
  const quarterOpts = genQuarterOpts(hState);
  const [periodA, setPeriodA] = useState(monthOpts[0]);
  const [periodB, setPeriodB] = useState(monthOpts[1]);

  // Shared team hierarchy (Hierarchy + Utilization tabs).
  const { H, setH, status, saveStatus, saveHierarchy, syncSF, loading: hierLoading, loadMsg: hierLoadMsg } = useHierarchy();

  // Shared period actuals (Actuals + Forecast + Time detail tabs).
  const { dataA, dataB, vacData, detailData, loading, loadMsg, sfError, loadData } = usePeriodData(periodA, periodB);

  // Data audit.
  const { auditData, auditLoading, fetchAuditData } = useAudit();

  // Reload period actuals when the periods change (only while on a data tab),
  // and on first entry to a data tab. Run audit on first entry to its tab.
  useEffect(() => { if (["actuals", "forecast", "detail"].includes(tab)) loadData(); }, [periodA, periodB]);
  useEffect(() => { if (["actuals", "forecast", "detail"].includes(tab) && !dataA) loadData(); }, [tab]);
  useEffect(() => { if (tab === "audit" && !auditData) fetchAuditData(); }, [tab]);

  // Copy the current hierarchy as JSON so it can be committed to data/hierarchy.json
  // (the git-stored, cross-machine baseline). See lib/drive.js.
  const copyHierarchy = async () => {
    if (!H) return;
    const text = JSON.stringify(H, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus("Copied. Paste it to Claude to commit.");
    } catch {
      setCopyStatus("Copy failed (see console)");
      console.log("Hierarchy JSON:\n" + text);
    }
    setTimeout(() => setCopyStatus(""), 4000);
  };

  const showControls = tab === "actuals" || tab === "forecast";
  const dotColor = status.type === "g" ? B.green : status.type === "a" ? B.amber : status.type === "r" ? B.red : B.lgray;
  const auditBadge = auditData ? (auditData.zeroRates.length + auditData.zeroRevSplits.length + auditData.nullSrc.length) : 0;

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "0 0 40px", fontFamily: "'Open Sans',sans-serif", position: "relative" }}>
      <style>{`${FONT_IMPORT} *{box-sizing:border-box;}`}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, paddingTop: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 4, height: 24, background: B.teal, borderRadius: 2 }} />
          <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Poppins',sans-serif", color: B.black }}>Team performance</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 10, color: "#aaa", display: "flex", alignItems: "center", gap: 5, fontFamily: "'Open Sans',sans-serif" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor }} />{status.msg}
          </span>
          {tab === "hierarchy" && <>
            <span style={{ fontSize: 10, color: "#aaa" }}>{copyStatus || saveStatus}</span>
            <button onClick={syncSF} style={{ fontSize: 11, padding: "5px 12px", border: `0.5px solid ${B.lgray}`, borderRadius: 6, background: "transparent", cursor: "pointer", fontFamily: "'Open Sans',sans-serif", color: "#888" }}>↺ Sync SF</button>
            <button onClick={copyHierarchy} style={{ fontSize: 11, padding: "5px 12px", border: `0.5px solid ${B.lgray}`, borderRadius: 6, background: "transparent", cursor: "pointer", fontFamily: "'Open Sans',sans-serif", color: "#888" }}>Copy JSON</button>
            <button onClick={saveHierarchy} style={{ fontSize: 11, padding: "5px 12px", background: B.teal, color: B.white, border: "none", borderRadius: 6, cursor: "pointer", fontFamily: "'Open Sans',sans-serif" }}>Save</button>
          </>}
          {tab !== "hierarchy" && <button onClick={loadData} style={{ fontSize: 11, padding: "5px 12px", border: `0.5px solid ${B.lgray}`, borderRadius: 6, background: "transparent", cursor: "pointer", fontFamily: "'Open Sans',sans-serif", color: "#888" }}>↺ Refresh</button>}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: `0.5px solid ${B.lgray}`, marginBottom: 14, overflowX: "auto" }}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            fontSize: 13, padding: "8px 16px", background: "none", cursor: "pointer", whiteSpace: "nowrap", fontFamily: "'Open Sans',sans-serif",
            color: tab === t.id ? B.teal : "#888", fontWeight: tab === t.id ? 600 : 400,
            border: "none", borderBottom: tab === t.id ? `2px solid ${B.teal}` : "2px solid transparent",
          }}>
            {t.label}
            {t.id === "audit" && auditData && auditBadge > 0 && (
              <span style={{ marginLeft: 5, fontSize: 10, padding: "1px 6px", borderRadius: 8, background: B.redBg, color: B.redTx, fontWeight: 700 }}>
                {auditBadge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Controls bar (actuals + forecast) */}
      {showControls && (
        <ControlsBar mode={mode} setMode={setMode}
          periodA={periodA} setPeriodA={setPeriodA}
          periodB={periodB} setPeriodB={setPeriodB}
          monthOpts={monthOpts} quarterOpts={quarterOpts} />
      )}

      {/* Error */}
      {sfError && (
        <div style={{ background: B.redBg, border: `0.5px solid ${B.red}`, borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontSize: 12, color: B.redTx, fontFamily: "'Open Sans',sans-serif" }}>
          <strong>Salesforce error:</strong> {sfError} — check your connection and try refreshing.
        </div>
      )}

      {/* Loading (data tabs only) */}
      {loading && showControls && <Spinner msg={loadMsg} />}

      {/* Tab content */}
      {tab === "hierarchy" && <HierarchyTab H={H} setH={setH} loading={hierLoading} loadMsg={hierLoadMsg} />}
      {tab === "utilization" && <UtilizationTab H={H} hState={hState} />}
      {tab === "planner" && <ResourcePlannerTab H={H} hState={hState} />}
      {!loading && tab === "actuals" && <ActualsTab periodA={periodA} periodB={periodB} dataA={dataA} dataB={dataB} setAuditKey={setAuditKey} />}
      {!loading && tab === "forecast" && <ForecastTab periodA={periodA} periodB={periodB} dataA={dataA} dataB={dataB} vacData={vacData} hState={hState} setAuditKey={setAuditKey} sendPrompt={sendPrompt} />}
      {!loading && tab === "detail" && <TimeDetailTab periodA={periodA} detailData={detailData} />}
      {tab === "audit" && <AuditTab auditData={auditData} auditLoading={auditLoading} fetchAuditData={fetchAuditData} />}
      {tab === "options" && <OptionsTab hState={hState} setHState={setHState} periodA={periodA} periodB={periodB} />}

      {/* Audit slide-in */}
      {auditKey && <AuditPanel auditKey={auditKey} onClose={() => setAuditKey(null)} />}
    </div>
  );
}
