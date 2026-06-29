// Forecast: forward capacity forecast for Aldus + Meghan, by pod, off real
// scheduled assignments (same source/bucketing as the resource planner). A
// 30/60/90-day window toggle drives the whole view; each pod (and, on expand, each
// person) gets a stacked committed bar broken into the categories discovery
// confirmed exist forward (billable, non-billable, vacation), then the gap to
// capacity. There is no credited segment (no forward scheduled equivalent).
// Data and bucketing live in useForecast; this is layout/interaction.
import { useState, useEffect } from "react";
import { B } from "../constants/brand.js";
import { fmtH } from "../lib/format.js";
import { Spinner } from "../components/index.js";
import { useForecast } from "../hooks/useForecast.js";

// Stacked-bar categories, in stack order. Distinct brand colours. Keys match the
// `segments` object the hook returns. Vacation is shown as committed time (it does
// not reduce capacity), so the gap is the true free capacity after PTO.
const SEG_DEFS = [
  { key: "billable", label: "Billable", color: B.teal },
  { key: "nonbillable", label: "Non-billable", color: B.purple },
  { key: "vacation", label: "Vacation", color: B.yellow },
];

export default function ForecastTab({ H, hState }) {
  const { data, loading, loadMsg, error, load } = useForecast(H, hState);
  const [windowDays, setWindowDays] = useState(30);
  const [expanded, setExpanded] = useState({});

  useEffect(() => { load(); }, [load]);

  const utilColor = (u) => (u <= 0 ? "#94a3b8" : u > 1.05 ? B.redTx : u >= 0.85 ? B.greenTx : B.blueTx);

  if (error) return (
    <div style={{ textAlign: "center", padding: 40 }}>
      <div style={{ fontSize: 12, color: B.redTx, background: B.redBg, borderRadius: 8, padding: "10px 14px", marginBottom: 14, display: "inline-block" }}>Could not load forecast: {error}</div>
      <div><button onClick={load} style={{ fontSize: 12, padding: "8px 20px", background: B.teal, color: B.white, border: "none", borderRadius: 6, cursor: "pointer" }}>Retry</button></div>
    </div>
  );
  if (loading || !data) return <Spinner msg={loadMsg || "Loading forecast..."} />;

  const { directors, overall } = data;
  const segCount = windowDays / 30; // 1, 2, or 3 segments
  const winSum = (arr) => arr.slice(0, segCount).reduce((a, b) => a + b, 0);
  // Committed split for a group, summed across the active window.
  const splitOf = (g) => {
    const parts = {}; SEG_DEFS.forEach((s) => { parts[s.key] = winSum(g.segments?.[s.key] || []); });
    return parts;
  };
  const cols = "230px 1fr 132px 118px";

  // Stacked committed bar: billable | non-billable | vacation, then the gap track.
  // Under capacity, segments are sized against capacity so the gap is visible. Over
  // capacity, they are sized against the committed total so the bar fills and the
  // over flag (text) carries the overflow.
  const Bar = ({ parts, cap }) => {
    const com = SEG_DEFS.reduce((a, s) => a + (parts[s.key] || 0), 0);
    const over = com > cap;
    const denom = Math.max(cap, com, 1);
    const tip = SEG_DEFS.map((s) => `${fmtH(parts[s.key] || 0)}h ${s.label.toLowerCase()}`).join(", ") + ` of ${fmtH(cap)}h capacity`;
    return (
      <div title={tip} style={{ display: "flex", height: 16, background: B.lgray, borderRadius: 8, overflow: "hidden", border: over ? `1px solid ${B.red}` : "none" }}>
        {SEG_DEFS.map((s) => {
          const w = ((parts[s.key] || 0) / denom) * 100;
          return w > 0 ? <div key={s.key} style={{ width: w + "%", height: "100%", background: s.color, transition: "width .2s" }} /> : null;
        })}
      </div>
    );
  };

  // One row: name (+chevron), stacked bar, hours, gap-or-over note.
  const Row = ({ g, depth, expandable, open, onClick }) => {
    const parts = splitOf(g);
    const com = winSum(g.committed), cap = winSum(g.capacity);
    const u = cap > 0 ? com / cap : 0;
    const over = com > cap;
    const gap = Math.max(cap - com, 0);
    const overflow = Math.max(com - cap, 0);
    return (
      <div onClick={onClick} style={{ display: "grid", gridTemplateColumns: cols, alignItems: "center", gap: 12, padding: depth === 2 ? "5px 14px 5px 0" : "8px 14px", borderBottom: `0.5px solid ${B.lgray}`, cursor: expandable ? "pointer" : "default", background: depth === 0 ? B.offwhite : "transparent" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: depth * 16, overflow: "hidden" }}>
          {expandable ? <span style={{ fontSize: 9, color: "#bbb", flex: "none", transition: "transform .15s", transform: open ? "rotate(90deg)" : "none" }}>▶</span> : <span style={{ width: 9, flex: "none" }} />}
          <span style={{ fontSize: depth === 0 ? 13 : 12, fontWeight: depth === 0 ? 700 : depth === 1 ? 600 : 400, fontFamily: depth < 2 ? "'Poppins',sans-serif" : "'Open Sans',sans-serif", color: depth === 0 ? B.black : depth === 1 ? B.teal : "#475569", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {depth === 2 ? g.name.split(" ")[0] + " " + (g.name.split(" ").slice(-1)[0] || "") : g.name}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ flex: 1 }}><Bar parts={parts} cap={cap} /></div>
          <span style={{ fontSize: 11, fontWeight: 700, color: utilColor(u), fontFamily: "'Open Sans',sans-serif", minWidth: 34, textAlign: "right" }}>{cap > 0 ? Math.round(u * 100) + "%" : "—"}</span>
        </div>
        <div style={{ fontSize: 11, color: "#666", textAlign: "right", fontFamily: "'Open Sans',sans-serif", fontVariantNumeric: "tabular-nums" }}>{fmtH(com)} / {fmtH(cap)}h</div>
        <div style={{ fontSize: 11, textAlign: "right", fontFamily: "'Open Sans',sans-serif", fontWeight: 600, color: over ? B.redTx : B.teal }}>
          {over ? `over by ${fmtH(overflow)}h` : `${fmtH(gap)}h to fill`}
        </div>
      </div>
    );
  };

  const card = (label, val, sub, valColor) => (
    <div key={label} style={{ background: B.offwhite, borderRadius: 8, padding: "11px 13px", fontFamily: "'Open Sans',sans-serif" }}>
      <div style={{ fontSize: 10, color: "#888", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: valColor || B.black, lineHeight: 1, fontFamily: "'Poppins',sans-serif" }}>{val}</div>
      <div style={{ fontSize: 11, color: "#aaa", marginTop: 3 }}>{sub}</div>
    </div>
  );

  const com = winSum(overall.committed), cap = winSum(overall.capacity);
  const overallU = cap > 0 ? com / cap : 0;
  const overallParts = splitOf(overall);
  const windowLabel = `next ${windowDays} days`;
  // Only show legend chips for categories that actually have hours forward.
  const liveSegs = SEG_DEFS.filter((s) => (overallParts[s.key] || 0) > 0);
  const committedSub = liveSegs.length
    ? liveSegs.map((s) => `${fmtH(overallParts[s.key])} ${s.label.toLowerCase()}`).join(", ")
    : windowLabel;

  return (
    <div style={{ fontFamily: "'Open Sans',sans-serif" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12, gap: 8, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-.01em", fontFamily: "'Poppins',sans-serif" }}>Forecast</div>
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 6, maxWidth: 700, lineHeight: 1.5 }}>Committed scheduled hours vs capacity for the {windowLabel} from today, Aldus and Meghan, by pod. Expand a pod to see each person's load and gap.</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ display: "flex", border: `0.5px solid ${B.lgray}`, borderRadius: 8, overflow: "hidden" }}>
            {[30, 60, 90].map((w) => (
              <button key={w} onClick={() => setWindowDays(w)} style={{ fontSize: 12, fontWeight: windowDays === w ? 700 : 500, padding: "6px 14px", border: "none", cursor: "pointer", background: windowDays === w ? B.teal : "transparent", color: windowDays === w ? B.white : "#64748b", fontFamily: "'Open Sans',sans-serif" }}>{w} days</button>
            ))}
          </div>
          <button onClick={load} style={{ fontSize: 11, padding: "6px 10px", border: `0.5px solid ${B.lgray}`, borderRadius: 8, background: "transparent", cursor: "pointer" }}>↺</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, 220px)", justifyContent: "start", gap: 16, marginBottom: 16 }}>
        {card(`Utilization (${windowLabel})`, cap > 0 ? Math.round(overallU * 100) + "%" : "—", "committed vs capacity", utilColor(overallU))}
        {card("Committed hours", fmtH(com), committedSub)}
        {card("Capacity hours", fmtH(cap), "working days × 8h")}
        {card("Room to fill", overallU > 1 ? "over by " + fmtH(com - cap) + "h" : fmtH(cap - com) + "h", "unfilled capacity", overallU > 1 ? B.redTx : B.teal)}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 8, flexWrap: "wrap", fontFamily: "'Open Sans',sans-serif" }}>
        {liveSegs.map((s) => (
          <span key={s.key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#64748b" }}>
            <span style={{ width: 11, height: 11, borderRadius: 3, background: s.color }} />{s.label}
          </span>
        ))}
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#64748b" }}>
          <span style={{ width: 11, height: 11, borderRadius: 3, background: B.lgray }} />Gap to capacity
        </span>
      </div>

      <div style={{ background: B.white, border: `0.5px solid ${B.lgray}`, borderRadius: 12, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: cols, gap: 12, padding: "7px 14px", background: B.offwhite, borderBottom: `0.5px solid ${B.lgray}` }}>
          {["Team / pod / person", "Committed vs capacity", "Hours", "Gap"].map((h, i) => (
            <div key={i} style={{ fontSize: 10, color: "#aaa", textTransform: "uppercase", letterSpacing: ".04em", textAlign: i === 0 ? "left" : "right" }}>{h}</div>
          ))}
        </div>
        {directors.map((d) => {
          const dOpen = expanded[d.name] ?? true;
          return (
            <div key={d.name}>
              <Row g={d} depth={0} expandable open={dOpen} onClick={() => setExpanded((e) => ({ ...e, [d.name]: !(e[d.name] ?? true) }))} />
              {dOpen && d.pods.map((p) => {
                const pKey = d.name + "::" + p.name;
                const pOpen = expanded[pKey] ?? false;
                return (
                  <div key={pKey}>
                    <Row g={p} depth={1} expandable={!!(p.members || []).length} open={pOpen} onClick={() => setExpanded((e) => ({ ...e, [pKey]: !e[pKey] }))} />
                    {pOpen && (p.members || []).map((m) => <Row key={pKey + "::" + m.name} g={m} depth={2} />)}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 8, fontSize: 10, color: "#aaa", lineHeight: 1.5 }}>
        This is committed scheduled assignments only, so it understates true future load: not-yet-signed work and not-yet-created assignments are not in Salesforce yet. Committed hours = each scheduled assignment's hours spread across its span working days, split into billable, non-billable (admin, professional development, pre-sales and similar internal work) and vacation (future PTO booked as assignments). All three count toward committed against capacity, so the gap is the free capacity left after non-billable time and PTO. Capacity = headcount × working days in the window × 8h (CA holidays applied), and is not reduced for vacation. Over 100% means more committed than capacity. There is no credited segment: credited time is a post-hoc timecard concept with no forward scheduled equivalent.
      </div>
    </div>
  );
}
