import { useEffect } from "react";
import { B } from "../constants/brand.js";
import Pill from "./Pill.jsx";

// Period A vs B selector shared by the Actuals and Forecast tabs.
// MoM uses month options; QoQ uses fiscal-quarter options. Switching mode resets
// A/B to the two most recent options.
export default function ControlsBar({ mode, setMode, periodA, setPeriodA, periodB, setPeriodB, monthOpts, quarterOpts }) {
  const opts = mode === "mom" ? monthOpts : quarterOpts;
  useEffect(() => {
    if (!opts.length) return;
    setPeriodA(opts[0]); setPeriodB(opts[1]);
  }, [mode]);

  const wdLine = periodA && periodB
    ? `${periodA.label} — ${periodA.wd} working days (CA)  ·  ${periodB.label} — ${periodB.wd} working days (CA)`
    : "";

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <div style={{ display: "flex", border: `0.5px solid ${B.lgray}`, borderRadius: 6, overflow: "hidden", flexShrink: 0 }}>
          <Pill active={mode === "mom"} onClick={() => setMode("mom")}>MoM</Pill>
          <Pill active={mode === "qoq"} onClick={() => setMode("qoq")}>QoQ</Pill>
        </div>
        <div style={{ width: 1, height: 20, background: B.lgray, flexShrink: 0 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 4, border: `0.5px solid ${B.lgray}`, borderRadius: 6, padding: "0 8px", height: 28 }}>
          <span style={{ fontSize: 10, color: "#bbb", textTransform: "uppercase", letterSpacing: ".04em", whiteSpace: "nowrap", fontFamily: "'Open Sans',sans-serif" }}>A</span>
          <select value={periodA?.id || ""} onChange={(e) => setPeriodA(opts.find((o) => o.id === e.target.value))}
            style={{ fontSize: 11, background: "transparent", border: "none", color: B.black, cursor: "pointer", fontFamily: "'Open Sans',sans-serif", outline: "none", maxWidth: 110 }}>
            {opts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </div>
        <span style={{ fontSize: 11, color: "#bbb", fontFamily: "'Open Sans',sans-serif" }}>vs</span>
        <div style={{ display: "flex", alignItems: "center", gap: 4, border: `0.5px solid ${B.lgray}`, borderRadius: 6, padding: "0 8px", height: 28 }}>
          <span style={{ fontSize: 10, color: "#bbb", textTransform: "uppercase", letterSpacing: ".04em", whiteSpace: "nowrap", fontFamily: "'Open Sans',sans-serif" }}>B</span>
          <select value={periodB?.id || ""} onChange={(e) => setPeriodB(opts.find((o) => o.id === e.target.value))}
            style={{ fontSize: 11, background: "transparent", border: "none", color: B.black, cursor: "pointer", fontFamily: "'Open Sans',sans-serif", outline: "none", maxWidth: 110 }}>
            {opts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </div>
      </div>
      {wdLine && <div style={{ fontSize: 10, color: "#bbb", marginTop: 5, paddingLeft: 2, fontFamily: "'Open Sans',sans-serif" }}>{wdLine}</div>}
    </div>
  );
}
