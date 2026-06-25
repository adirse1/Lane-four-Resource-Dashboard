// Data audit: five data-quality checks with CSV export keyed on Record ID for
// Salesforce Data Loader. Data comes from useAudit; checkbox selection state is local.
import { useState } from "react";
import { B } from "../constants/brand.js";
import { Tag, Spinner } from "../components/index.js";

export default function AuditTab({ auditData, auditLoading, fetchAuditData }) {
  const [auditChecked, setAuditChecked] = useState({});

  function AuditCheck({ id, title, severity, desc, records, fields }) {
    const sevColor = severity === "Breaking" ? { bg: B.redBg, c: B.redTx } : severity === "Warning" ? { bg: B.amberBg, c: B.amberTx } : { bg: B.blueBg, c: B.blueTx };
    const [open, setOpen] = useState(severity === "Breaking");
    const allChecked = records.length > 0 && records.every((r) => auditChecked[`${id}-${r.Id}`]);
    function toggleAll() {
      setAuditChecked((prev) => { const next = { ...prev }; records.forEach((r) => { next[`${id}-${r.Id}`] = !allChecked; }); return next; });
    }
    return (
      <div style={{ background: B.white, border: `0.5px solid ${B.lgray}`, borderRadius: 12, overflow: "hidden", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 16px", cursor: "pointer", background: records.length > 0 ? B.offwhite : "transparent" }}
          onClick={() => records.length > 0 && setOpen((o) => !o)}>
          <Tag color={sevColor.c} bg={sevColor.bg}>{severity}</Tag>
          <div style={{ flex: 1, fontFamily: "'Open Sans',sans-serif" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: B.black }}>{title}</div>
            <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>{desc}</div>
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: records.length > 0 ? B.orange : "#bbb", fontFamily: "'Poppins',sans-serif", flexShrink: 0 }}>
            {records.length} {records.length === 1 ? "record" : "records"}
          </div>
          {records.length > 0 && <div style={{ fontSize: 13, color: "#bbb", transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }}>⌄</div>}
        </div>
        {open && records.length > 0 && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 16px", borderTop: `0.5px solid ${B.lgray}`, background: "#FAFAFA" }}>
              <input type="checkbox" checked={allChecked} onChange={toggleAll} style={{ cursor: "pointer" }} />
              <span style={{ fontSize: 11, color: "#888", fontFamily: "'Open Sans',sans-serif" }}>Select all</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: "'Open Sans',sans-serif" }}>
                <thead>
                  <tr style={{ background: B.offwhite }}>
                    <th style={{ width: 32, padding: "6px 14px", textAlign: "left" }} />
                    {fields.map((f) => (
                      <th key={f.key} style={{ padding: "6px 14px", textAlign: "left", fontSize: 10, color: "#aaa", textTransform: "uppercase", letterSpacing: ".04em", whiteSpace: "nowrap" }}>{f.label}</th>
                    ))}
                    <th style={{ padding: "6px 14px", fontSize: 10, color: "#aaa", textTransform: "uppercase", letterSpacing: ".04em" }}>Record ID</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((rec, i) => (
                    <tr key={rec.Id || i} style={{ borderTop: `0.5px solid ${B.lgray}` }}>
                      <td style={{ padding: "7px 14px" }}>
                        <input type="checkbox" checked={!!auditChecked[`${id}-${rec.Id}`]}
                          onChange={(e) => setAuditChecked((prev) => ({ ...prev, [`${id}-${rec.Id}`]: e.target.checked }))}
                          style={{ cursor: "pointer" }} />
                      </td>
                      {fields.map((f) => (
                        <td key={f.key} style={{ padding: "7px 14px", color: f.highlight ? B.red : B.black, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {rec[f.key] !== undefined && rec[f.key] !== null ? String(rec[f.key]) : "—"}
                        </td>
                      ))}
                      <td style={{ padding: "7px 14px", fontFamily: "monospace", fontSize: 11, color: B.teal }}>{rec.Id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  function exportAuditCSV() {
    const selected = [];
    Object.entries(auditChecked).forEach(([k, v]) => {
      if (!v) return;
      const [checkId, ...rest] = k.split("-");
      const recId = rest.join("-");
      const checkMap = { zeroRates: auditData?.zeroRates, zeroRevSplits: auditData?.zeroRevSplits, nullSrc: auditData?.nullSrc, formulaDrift: auditData?.formulaDrift, zeroSchedHrs: auditData?.zeroSchedHrs };
      const recs = checkMap[checkId] || [];
      const rec = recs.find((r) => r.Id === recId);
      if (rec) selected.push({ checkId, ...rec });
    });
    if (!selected.length) { alert("No records selected."); return; }
    const headers = ["Check", "Id", "Name", "Resource", "Project", "Group", "Issue"];
    const rows = selected.map((r) => [
      r.checkId, r.Id, r.Name || "", r.resource || "", r.proj || "", r.grp || "",
      r.checkId === "zeroRates" ? `Bill Rate: ${r.billRate || 0}, Planned: ${r.plannedRate || 0}` :
        r.checkId === "zeroRevSplits" ? `Revenue: $0, Hours: ${r.hours || 0}` :
          r.checkId === "nullSrc" ? `Project Source: null, Stage: ${r.stage || ""}` :
            r.checkId === "formulaDrift" ? `CAD_Revenue: ${r.cadRevenue || 0}, Formula: ${r.formulaRevenue || 0}` :
              r.checkId === "zeroSchedHrs" ? `Scheduled Hours: 0` : "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `lane-four-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  if (auditLoading) return <Spinner msg="Running data quality checks..." />;
  if (!auditData) return (
    <div style={{ textAlign: "center", padding: 40, fontFamily: "'Open Sans',sans-serif" }}>
      <button onClick={fetchAuditData} style={{ fontSize: 12, padding: "8px 20px", background: B.teal, color: B.white, border: "none", borderRadius: 6, cursor: "pointer", fontFamily: "'Open Sans',sans-serif" }}>Run checks</button>
    </div>
  );
  const totalSelected = Object.values(auditChecked).filter(Boolean).length;
  const CHECKS = [
    {
      id: "zeroRates", title: "Billable assignments with $0 bill rate and $0 planned bill rate", severity: "Breaking",
      desc: "These assignments generate $0 forecast revenue. The forecast tab will undercount any pod with resources in this state.",
      records: auditData.zeroRates,
      fields: [{ key: "Name", label: "Assignment" }, { key: "resource", label: "Resource" }, { key: "proj", label: "Project" }, { key: "grp", label: "Group" }, { key: "billRate", label: "Bill rate", highlight: true }, { key: "plannedRate", label: "Planned rate", highlight: true }, { key: "status", label: "Status" }],
    },
    {
      id: "zeroRevSplits", title: "Approved billable timecards generating $0 revenue", severity: "Breaking",
      desc: "These splits are flagged billable and approved but Total_Billable_Amount_Formula__c = 0. Likely caused by a $0 bill rate on the parent assignment. RPD is understated for these pods.",
      records: auditData.zeroRevSplits,
      fields: [{ key: "Name", label: "Timecard" }, { key: "resource", label: "Resource" }, { key: "proj", label: "Project" }, { key: "grp", label: "Group" }, { key: "hours", label: "Hours" }, { key: "revenue", label: "Revenue", highlight: true }, { key: "startDate", label: "Week of" }],
    },
    {
      id: "formulaDrift", title: "CAD_Revenue__c ≠ Total_Billable_Amount_Formula__c", severity: "Warning",
      desc: "The two revenue fields disagree on the same split. Dashboard uses Total_Billable_Amount_Formula__c. If CAD_Revenue__c is larger, RPD may be understated.",
      records: auditData.formulaDrift,
      fields: [{ key: "Name", label: "Timecard" }, { key: "resource", label: "Resource" }, { key: "proj", label: "Project" }, { key: "cadRevenue", label: "CAD_Revenue", highlight: true }, { key: "formulaRevenue", label: "Formula Revenue", highlight: true }, { key: "startDate", label: "Date" }],
    },
    {
      id: "nullSrc", title: "Active projects with null Project_Source__c", severity: "Warning",
      desc: "These projects won't appear in managed services queries. If they're billable client work, they're missing from RPD and forecast entirely. Numeris is a known example.",
      records: auditData.nullSrc,
      fields: [{ key: "Name", label: "Project" }, { key: "acct", label: "Account" }, { key: "grp", label: "Group" }, { key: "pm", label: "PM" }, { key: "src", label: "Project Source", highlight: true }, { key: "stage", label: "Stage" }],
    },
    {
      id: "zeroSchedHrs", title: "Active scheduled billable assignments with 0 scheduled hours", severity: "Info",
      desc: "These assignments exist on the planner but have no scheduled hours. They contribute $0 to forecast and inflate resource headcount in the utilization ceiling calculation.",
      records: auditData.zeroSchedHrs,
      fields: [{ key: "Name", label: "Assignment" }, { key: "resource", label: "Resource" }, { key: "proj", label: "Project" }, { key: "grp", label: "Group" }, { key: "scheduledHours", label: "Sched hrs", highlight: true }, { key: "startDate", label: "Start" }, { key: "endDate", label: "End" }],
    },
  ];
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "'Poppins',sans-serif", color: B.black }}>Data quality checks</div>
          <div style={{ fontSize: 11, color: "#aaa", fontFamily: "'Open Sans',sans-serif", marginTop: 2 }}>Last run: {auditData.fetchedAt}</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {totalSelected > 0 && (
            <button onClick={exportAuditCSV} style={{ fontSize: 12, padding: "6px 14px", background: B.teal, color: B.white, border: "none", borderRadius: 6, cursor: "pointer", fontFamily: "'Open Sans',sans-serif" }}>
              Export {totalSelected} selected (CSV)
            </button>
          )}
          <button onClick={fetchAuditData} style={{ fontSize: 12, padding: "6px 14px", background: "transparent", color: "#666", border: `0.5px solid ${B.lgray}`, borderRadius: 6, cursor: "pointer", fontFamily: "'Open Sans',sans-serif" }}>↺ Re-run</button>
        </div>
      </div>
      {CHECKS.map((c) => <AuditCheck key={c.id} {...c} />)}
      <div style={{ marginTop: 16, padding: "12px 16px", background: B.offwhite, borderRadius: 8, fontSize: 11, color: "#888", lineHeight: 1.6, fontFamily: "'Open Sans',sans-serif" }}>
        <strong style={{ color: B.black }}>How to use:</strong> Check rows you want to fix → Export CSV → use Salesforce Data Loader to mass-update via the Record ID column. Breaking issues actively distort RPD and forecast numbers. Warning issues may cause silent undercounting. Info issues are data hygiene worth cleaning.
      </div>
    </div>
  );
}
