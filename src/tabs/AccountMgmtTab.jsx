// Account management: quarterly QBR + opportunity analysis (metrics half). Whole
// company, no directorate scope. Quarter selector (fiscal year starts Jul 1, reuses
// genQuarterOpts). Summary cards + a per-review table. The opp-per-account column is
// an INFERRED link (same account, opp created in quarter on/after the review date),
// labeled as such, since no reliable direct QBR-to-opp link exists.
import { useState, useEffect } from "react";
import { B } from "../constants/brand.js";
import { fmt, fmtK } from "../lib/format.js";
import { genQuarterOpts } from "../lib/holidays.js";
import { Spinner } from "../components/index.js";
import { useAccountMgmt } from "../hooks/useAccountMgmt.js";

const pad = (n) => String(n).padStart(2, "0");
const qLabel = (o) => `Q${o.qNum} FY${String(o.year + 1).slice(2)}`; // e.g. "Q4 FY26"
const qRange = (o) => ({
  start: `${o.months[0].y}-${pad(o.months[0].m)}-01`,
  end: `${o.months[2].y}-${pad(o.months[2].m)}-${new Date(o.months[2].y, o.months[2].m, 0).getDate()}`,
});

export default function AccountMgmtTab({ hState }) {
  const quarters = genQuarterOpts(hState || {});
  const [qId, setQId] = useState(quarters[0]?.id);
  const [openRow, setOpenRow] = useState({});
  const { data, loading, loadMsg, error, load, ai, aiLoading, aiError, generateAnalysis } = useAccountMgmt();
  const q = quarters.find((o) => o.id === qId) || quarters[0];
  const r = q ? qRange(q) : null;

  useEffect(() => { if (r) load(r.start, r.end); }, [qId]);

  const card = (label, val, sub, valColor) => (
    <div key={label} style={{ background: B.offwhite, borderRadius: 8, padding: "11px 13px", fontFamily: "'Open Sans',sans-serif" }}>
      <div style={{ fontSize: 10, color: "#888", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: valColor || B.black, lineHeight: 1, fontFamily: "'Poppins',sans-serif" }}>{val}</div>
      <div style={{ fontSize: 11, color: "#aaa", marginTop: 3 }}>{sub}</div>
    </div>
  );

  const TH = ({ children, right }) => <div style={{ fontSize: 10, color: "#aaa", textTransform: "uppercase", letterSpacing: ".04em", fontFamily: "'Open Sans',sans-serif", textAlign: right ? "right" : "left" }}>{children}</div>;
  const tableCols = "1.6fr 86px 110px 130px 96px 1fr 120px 70px";

  return (
    <div style={{ fontFamily: "'Open Sans',sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-.01em", fontFamily: "'Poppins',sans-serif" }}>Account management</div>
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 6 }}>Quarterly QBR and opportunity analysis, whole company. {q ? qLabel(q) : ""}{q ? ` (${q.subLabel})` : ""}.</div>
        </div>
        <select value={qId} onChange={(e) => setQId(e.target.value)} style={{ fontSize: 12, padding: "6px 10px", border: `0.5px solid ${B.lgray}`, borderRadius: 8, background: B.white, fontFamily: "'Open Sans',sans-serif" }}>
          {quarters.map((o) => <option key={o.id} value={o.id}>{qLabel(o)} ({o.subLabel})</option>)}
        </select>
      </div>

      {error && <div style={{ fontSize: 12, color: B.redTx, background: B.redBg, borderRadius: 8, padding: "10px 14px", marginBottom: 14 }}>Could not load: {error}</div>}

      {loading || !data ? <Spinner msg={loadMsg || "Loading..."} /> : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, 240px)", justifyContent: "start", gap: 16, marginBottom: 16 }}>
            {card("QBRs held", data.qbrCount.toLocaleString(), `${q ? qLabel(q) : ""} reviews dated in quarter`)}
            {card("Closed-won dollars", fmtK(data.wonAmount), `${data.wonCount} opps won`, B.green)}
            {card("Pipeline generated", fmtK(data.pipelineAmount), `${data.pipelineCount} opps created`)}
            {card("Opps closed", data.closedCount.toLocaleString(), `${data.wonCount} won, ${data.lostCount} lost`)}
            {card("Win rate", data.winRate !== null ? Math.round(data.winRate) + "%" : "—", "won / closed")}
            {card("Avg deal size", data.avgDeal !== null ? fmt(data.avgDeal) : "—", "won opps")}
          </div>

          {/* AI thematic analysis (on-demand, not auto-run) */}
          <div style={{ border: `0.5px solid ${B.lgray}`, borderRadius: 12, padding: "12px 14px", marginBottom: 16, background: B.white }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "'Poppins',sans-serif" }}>Themes from QBR notes</span>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: "#8a4b1f", background: "rgba(253,210,110,0.3)", borderRadius: 4, padding: "1px 6px" }}>AI generated</span>
              </div>
              <button onClick={() => generateAnalysis(data.rows, q ? qLabel(q) : "this quarter")} disabled={aiLoading} style={{ fontSize: 11, fontWeight: 600, padding: "6px 12px", border: "none", borderRadius: 6, background: aiLoading ? B.lgray : B.teal, color: B.white, cursor: aiLoading ? "default" : "pointer", fontFamily: "'Open Sans',sans-serif" }}>
                {aiLoading ? "Analyzing..." : ai ? "Regenerate" : "Generate analysis"}
              </button>
            </div>
            {aiError && <div style={{ fontSize: 11, color: B.redTx, background: B.redBg, borderRadius: 6, padding: "8px 10px", marginTop: 10 }}>{aiError}</div>}
            {!ai && !aiLoading && !aiError && <div style={{ fontSize: 12, color: "#888", marginTop: 8 }}>Summarize this quarter's {data.rows.length} QBR notes into themes, risks, and sentiment. Reads the notes shown in the table below; the source notes stay readable per account.</div>}
            {aiLoading && <div style={{ fontSize: 12, color: "#888", marginTop: 10 }}>Reading {data.rows.length} reviews and synthesizing...</div>}
            {ai && (
              <div style={{ marginTop: 12, display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: "#888", marginBottom: 6 }}>Common themes</div>
                  {(ai.themes || []).map((t, i) => (
                    <div key={i} style={{ fontSize: 12, marginBottom: 8, lineHeight: 1.45 }}>
                      <span style={{ fontWeight: 700 }}>{t.theme}</span> <span style={{ color: B.teal, fontWeight: 600 }}>({t.accountCount} {t.accountCount === 1 ? "account" : "accounts"})</span>
                      <div style={{ color: "#555" }}>{t.summary}</div>
                    </div>
                  ))}
                  {!(ai.themes || []).length && <div style={{ fontSize: 12, color: "#999" }}>None surfaced.</div>}
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: "#888", marginBottom: 6 }}>To talk through next quarter</div>
                  {(ai.risks || []).map((rk, i) => (
                    <div key={i} style={{ fontSize: 12, marginBottom: 8, lineHeight: 1.45 }}>
                      <span style={{ fontWeight: 700, color: B.redTx }}>{rk.account}</span><div style={{ color: "#555" }}>{rk.note}</div>
                    </div>
                  ))}
                  {!(ai.risks || []).length && <div style={{ fontSize: 12, color: "#999" }}>None surfaced.</div>}
                  {(ai.sentiment || []).length > 0 && <>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: "#888", margin: "12px 0 6px" }}>Sentiment shifts</div>
                    {ai.sentiment.map((sLine, i) => <div key={i} style={{ fontSize: 12, color: "#555", marginBottom: 4, lineHeight: 1.45 }}>{sLine}</div>)}
                  </>}
                </div>
              </div>
            )}
          </div>

          <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "'Poppins',sans-serif", margin: "4px 0 8px" }}>Accounts reviewed this quarter <span style={{ fontSize: 11, fontWeight: 400, color: "#aaa" }}>({data.rows.length})</span></div>
          <div style={{ background: B.white, border: `0.5px solid ${B.lgray}`, borderRadius: 12, overflowX: "auto" }}>
            <div style={{ minWidth: 880 }}>
              <div style={{ display: "grid", gridTemplateColumns: tableCols, padding: "7px 14px", background: B.offwhite, borderBottom: `0.5px solid ${B.lgray}`, gap: 8 }}>
                <TH>Account</TH><TH>Review date</TH><TH>Status</TH><TH>Outcome</TH><TH>Health</TH><TH>Account manager</TH>
                <TH right>Opps post-QBR (inferred)</TH><TH right>Opps won</TH>
              </div>
              {data.rows.length === 0 && <div style={{ padding: 16, fontSize: 12, color: "#999" }}>No QBRs dated in this quarter.</div>}
              {data.rows.map((row) => {
                const open = !!openRow[row.name];
                const hasNotes = row.summary || row.outcomeNotes || row.healthSummary || row.amNotes;
                return (
                  <div key={row.name}>
                    <div onClick={() => setOpenRow((o) => ({ ...o, [row.name]: !o[row.name] }))} style={{ display: "grid", gridTemplateColumns: tableCols, padding: "8px 14px", borderBottom: `0.5px solid ${B.lgray}`, alignItems: "center", gap: 8, fontSize: 12, cursor: "pointer", background: open ? B.offwhite : "transparent" }}>
                      <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 5 }} title={row.account}>
                        <span style={{ fontSize: 9, color: "#bbb", flex: "none", transition: "transform .15s", transform: open ? "rotate(90deg)" : "none" }}>▶</span>{row.account}
                      </div>
                      <div style={{ color: "#666" }}>{row.date || "—"}</div>
                      <div style={{ color: "#666", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.status || "—"}</div>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={row.outcome}>{row.outcome || "—"}</div>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={row.health}>{row.health || "—"}</div>
                      <div style={{ color: "#666", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.am || "—"}</div>
                      <div style={{ textAlign: "right" }} title={row.oppsPost ? `${row.oppsPost} opps, ${fmtK(row.oppsPostAmount)} (created on/after the review date, same account, in quarter)` : "none"}>{row.oppsPost || "—"}</div>
                      <div style={{ textAlign: "right", color: row.oppsWon ? B.green : "#666" }}>{row.oppsWon || "—"}</div>
                    </div>
                    {open && (
                      <div style={{ padding: "10px 14px 12px 33px", background: B.offwhite, borderBottom: `0.5px solid ${B.lgray}`, fontSize: 12, lineHeight: 1.5 }}>
                        {!hasNotes && <span style={{ color: "#999" }}>No notes recorded on this review.</span>}
                        {row.summary && <div><span style={{ color: "#888", fontWeight: 600 }}>Summary: </span>{row.summary}</div>}
                        {row.outcomeNotes && <div><span style={{ color: "#888", fontWeight: 600 }}>Outcome notes: </span>{row.outcomeNotes}</div>}
                        {row.healthSummary && <div><span style={{ color: "#888", fontWeight: 600 }}>Health summary: </span>{row.healthSummary}</div>}
                        {row.amNotes && <div><span style={{ color: "#888", fontWeight: 600 }}>AM growth notes: </span>{row.amNotes}</div>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ marginTop: 8, fontSize: 10, color: "#aaa", lineHeight: 1.5 }}>
            "Opps post-QBR" is inferred (same account, opportunity created in the quarter on or after the review date), not a direct Salesforce link. Whole company, no team scope. Pipeline generated counts opportunities created in the quarter; closed-won and win rate use opportunities closed in the quarter.
          </div>
        </>
      )}
    </div>
  );
}
