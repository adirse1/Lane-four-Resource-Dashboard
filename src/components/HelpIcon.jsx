import { useState } from "react";
import { B } from "../constants/brand.js";

export default function HelpIcon({ tip, calc, auditKey, onAudit }) {
  const [show, setShow] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center", marginLeft: 4 }}>
      <span
        onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}
        onClick={() => auditKey && onAudit && onAudit(auditKey)}
        style={{ width: 14, height: 14, borderRadius: "50%", background: B.lgray, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#666", cursor: "pointer", flexShrink: 0, fontFamily: "'Open Sans',sans-serif" }}
      >?</span>
      {show && (
        <div style={{ position: "absolute", bottom: "calc(100% + 5px)", left: "50%", transform: "translateX(-50%)", background: B.black, color: B.white, borderRadius: 6, padding: "8px 10px", fontSize: 11, lineHeight: 1.5, width: 210, zIndex: 999, pointerEvents: "none", fontFamily: "'Open Sans',sans-serif" }}>
          <div style={{ fontWeight: 600, marginBottom: 3 }}>{tip}</div>
          {calc && <div style={{ opacity: .75, fontSize: 10 }}>{calc}</div>}
          {auditKey && <div style={{ marginTop: 5, color: B.teal, fontSize: 10 }}>Click to audit →</div>}
        </div>
      )}
    </span>
  );
}
