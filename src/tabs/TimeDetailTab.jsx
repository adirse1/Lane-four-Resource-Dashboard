// Time detail: raw approved timecard splits for the selected period (A).
import { B } from "../constants/brand.js";
import { fmtK } from "../lib/format.js";
import { Tag, Spinner } from "../components/index.js";

export default function TimeDetailTab({ periodA, detailData }) {
  const lA = periodA?.label || "Period A";
  if (!detailData) return <Spinner msg={`Loading ${lA} detail...`} />;
  const typeOf = (r) => {
    if (r.proj?.includes("Vacation")) return { l: "Vacation", bg: B.blueBg, c: B.blueTx };
    if (r.credited) return { l: "Credited", bg: B.purpleBg, c: B.purpleTx };
    if (r.billable) return { l: "Billable", bg: B.greenBg, c: B.greenTx };
    return { l: "Non-bill", bg: B.lgray, c: "#666" };
  };
  return (
    <div>
      <div style={{ fontSize: 11, color: "#888", background: B.offwhite, borderRadius: 8, padding: "6px 12px", marginBottom: 12, fontFamily: "'Open Sans',sans-serif" }}>
        Showing {Math.min(detailData.length, 200)} splits from {lA} · Approved timecards only
      </div>
      <div style={{ background: B.white, border: `0.5px solid ${B.lgray}`, borderRadius: 12, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "110px 1fr 90px 60px 52px 68px 76px", padding: "6px 14px", background: B.offwhite, borderBottom: `0.5px solid ${B.lgray}` }}>
          {["Resource", "Project", "Account", "Type", "Hrs", "Revenue", "Date"].map((h, i) => (
            <div key={i} style={{ fontSize: 10, color: "#bbb", textTransform: "uppercase", letterSpacing: ".04em", fontFamily: "'Open Sans',sans-serif", textAlign: i > 3 ? "right" : "left" }}>{h}</div>
          ))}
        </div>
        {detailData.slice(0, 100).map((r, i) => {
          const t = typeOf(r);
          return (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "110px 1fr 90px 60px 52px 68px 76px", padding: "7px 14px", borderBottom: `0.5px solid ${B.lgray}`, fontFamily: "'Open Sans',sans-serif", fontSize: 12 }}>
              <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: B.black }}>{r.resource?.split(" ")[0]} {r.resource?.split(" ").slice(-1)[0]}</div>
              <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 11, color: "#888" }}>{r.proj}</div>
              <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 11, color: "#aaa" }}>{r.acct || "—"}</div>
              <div><Tag color={t.c} bg={t.bg}>{t.l}</Tag></div>
              <div style={{ textAlign: "right" }}>{(r.hours || 0).toFixed(1)}</div>
              <div style={{ textAlign: "right", color: "#888" }}>{(r.revenue || 0) > 0 ? fmtK(r.revenue) : "—"}</div>
              <div style={{ textAlign: "right", color: "#bbb", fontSize: 11 }}>{r.startDate}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
