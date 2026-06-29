// Account-management / QBR analysis (metrics half). Whole company, no directorate
// scope. Loads Scheduled Business Reviews + opportunities for a fiscal quarter and
// derives summary metrics plus a per-review table. The QBR-to-opp link is INFERRED
// (same account, opp created in the quarter on/after the review date) because no
// reliable direct link exists (see discovery / lib/queries.js).
import { useState, useCallback } from "react";
import { callSF, callClaude } from "../lib/salesforce.js";
import { sbrNotesInQuarter, oppsCreatedInQuarter, oppsClosedInQuarter, oppsCreatedDetail } from "../lib/queries.js";

export function useAccountMgmt() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadMsg, setLoadMsg] = useState("");
  const [error, setError] = useState(null);
  // AI thematic analysis is on-demand (button), not run on load.
  const [ai, setAi] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);

  const load = useCallback(async (start, end) => {
    if (!start || !end) return;
    setLoading(true); setError(null); setLoadMsg("Loading QBRs and opportunities...");
    setAi(null); setAiError(null); // clear stale analysis when the quarter changes
    try {
      const [sbrRes, createdRes, closedRes, detailRes] = await Promise.all([
        callSF(sbrNotesInQuarter(start, end)),
        callSF(oppsCreatedInQuarter(start, end)),
        callSF(oppsClosedInQuarter(start, end)),
        callSF(oppsCreatedDetail(start, end)),
      ]);

      // Opps created in quarter, by account, with created date (for the inference).
      const created = (detailRes?.records || []).map((o) => ({
        accountId: o.AccountId, amount: o.Amount || 0, won: !!o.IsWon,
        createdDay: (o.CreatedDate || "").slice(0, 10),
      }));
      const byAcct = {};
      created.forEach((o) => { if (o.accountId) (byAcct[o.accountId] ||= []).push(o); });

      // Per-review rows + inferred post-QBR opps (same account, created on/after the
      // review date, within the quarter).
      const rows = (sbrRes?.records || []).map((r) => {
        const accountId = r.Account__c, date = r.Date__c;
        const acctOpps = byAcct[accountId] || [];
        const post = acctOpps.filter((o) => date && o.createdDay >= date);
        return {
          name: r.Name,
          account: r.Account__r?.Name || "(no account)",
          accountId, date,
          status: r.Status__c || "",
          outcome: r.SBR_Outcome__c || "",
          health: r.Client_Temperature__c || "",
          forecast: r.X3_Month_Forecast__c || "",
          am: r.Account_Manager__r?.Name || "",
          summary: r.Summary__c || "",
          outcomeNotes: r.SBR_Outcome_Notes__c || "",
          healthSummary: r.Health_Summary__c || "",
          amNotes: r.AM_Growth_Notes__c || "",
          oppsPost: post.length,
          oppsPostAmount: post.reduce((s, o) => s + o.amount, 0),
          oppsWon: post.filter((o) => o.won).length,
        };
      });

      // Pipeline generated (created in quarter).
      const cr = createdRes?.records?.[0] || {};
      const pipelineCount = cr.cnt || 0, pipelineAmount = cr.amount || 0;

      // Closed won / lost.
      let wonCount = 0, wonAmount = 0, lostCount = 0, lostAmount = 0;
      (closedRes?.records || []).forEach((row) => {
        if (row.won) { wonCount = row.cnt || 0; wonAmount = row.amount || 0; }
        else { lostCount = row.cnt || 0; lostAmount = row.amount || 0; }
      });
      const closedCount = wonCount + lostCount;

      setData({
        qbrCount: rows.length,
        wonCount, wonAmount, lostCount, lostAmount, closedCount,
        winRate: closedCount > 0 ? (wonCount / closedCount) * 100 : null,
        avgDeal: wonCount > 0 ? wonAmount / wonCount : null,
        pipelineCount, pipelineAmount,
        rows,
      });
    } catch (e) { console.error(e); setError(String(e?.message || e)); }
    setLoading(false);
  }, []);

  // On-demand AI synthesis over the selected quarter's QBR notes only. One batched
  // call via callClaude (proxy holds the key). rows already scope to the quarter.
  const generateAnalysis = useCallback(async (rows, quarterLabel) => {
    if (!rows || !rows.length) { setAiError("No QBR notes in this quarter to analyze"); return; }
    setAiLoading(true); setAiError(null);
    try {
      const notesText = rows.map((r) => {
        const notes = [r.summary, r.outcomeNotes, r.healthSummary, r.amNotes]
          .filter(Boolean).map((t) => String(t).replace(/\s+/g, " ").slice(0, 1200)).join(" | ");
        return `Account: ${r.account} | Date: ${r.date} | Outcome: ${r.outcome || "n/a"} | Health: ${r.health || "n/a"} | AM: ${r.am || "n/a"}\nNotes: ${notes || "(no notes)"}`;
      }).join("\n\n");
      const prompt = `You are analyzing ${rows.length} quarterly business review (QBR) notes for ${quarterLabel}, across the whole company. Synthesize the patterns. Respond with ONLY a JSON object (no prose, no markdown) of this exact shape:
{"themes":[{"theme":string,"accountCount":number,"summary":string}],"risks":[{"account":string,"note":string}],"sentiment":[string]}
- themes: common things customers are saying this quarter. Group similar points. accountCount = number of distinct accounts the theme appears in. Order by accountCount descending.
- risks: accounts with open action items or risks flagged in their notes, to talk through going into next quarter. note = a short reason.
- sentiment: notable sentiment shifts or escalations, only if the notes support it (else empty array).
Be concise and grounded only in the notes provided. QBR notes:

${notesText}`;
      const res = await callClaude(prompt, { maxTokens: 2048 });
      const text = res?.text || "";
      let parsed = null;
      try { parsed = JSON.parse(text); }
      catch { const m = text.match(/\{[\s\S]*\}/); if (m) { try { parsed = JSON.parse(m[0]); } catch {} } }
      if (!parsed) throw new Error("Could not parse the AI response");
      setAi(parsed);
    } catch (e) { console.error(e); setAiError(String(e?.message || e)); }
    setAiLoading(false);
  }, []);

  return { data, loading, loadMsg, error, load, ai, aiLoading, aiError, generateAnalysis };
}
