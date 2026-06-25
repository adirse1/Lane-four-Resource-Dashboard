import { B } from "../constants/brand.js";
import { AUDIT_DEFS } from "../constants/auditDefs.js";

// Slide-in panel explaining a metric's formula, logic, and source query.
// Opened from any HelpIcon with an auditKey.
export default function AuditPanel({ auditKey, onClose }) {
  const e = AUDIT_DEFS[auditKey];
  if (!e) return null;
  return (
    <div style={{ position: "fixed", top: 0, right: 0, width: 380, height: "100vh", background: B.white, borderLeft: `1px solid ${B.lgray}`, zIndex: 1000, overflowY: "auto", padding: 22, boxSizing: "border-box", fontFamily: "'Open Sans',sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "'Poppins',sans-serif", color: B.black }}>{e.title}</div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#aaa", lineHeight: 1 }}>×</button>
      </div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".05em", color: "#aaa", marginBottom: 5 }}>Formula</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: B.teal, background: B.offwhite, borderRadius: 6, padding: "8px 10px" }}>{e.formula}</div>
      </div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".05em", color: "#aaa", marginBottom: 5 }}>How it works</div>
        <div style={{ fontSize: 12, color: "#444", lineHeight: 1.65 }}>{e.detail}</div>
      </div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".05em", color: "#aaa", marginBottom: 5 }}>Source query</div>
        <pre style={{ fontSize: 10, color: "#333", background: B.offwhite, borderRadius: 6, padding: "10px 12px", overflowX: "auto", borderLeft: `3px solid ${B.teal}`, margin: 0, lineHeight: 1.65, fontFamily: "monospace", whiteSpace: "pre-wrap" }}>{e.soql}</pre>
      </div>
      <div style={{ background: B.offwhite, borderRadius: 6, padding: "10px 12px", fontSize: 11, color: "#888", lineHeight: 1.5 }}>
        <strong style={{ color: B.black }}>Objects:</strong> pse__Timecard__c, pse__Assignment__c, pse__Proj__c, pse__Grp__c, pse__Practice__c. All values in CAD via Total_Billable_Amount_Formula__c.
      </div>
    </div>
  );
}
