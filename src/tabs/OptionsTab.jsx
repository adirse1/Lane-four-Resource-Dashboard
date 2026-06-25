// Options: CA/US holiday toggles that drive working-day math across every tab.
// Holidays toggled OFF count as working days.
import { useState } from "react";
import { B, MONTHS } from "../constants/brand.js";
import { HOLIDAYS, getEnabledHols, calcWD } from "../lib/holidays.js";

export default function OptionsTab({ hState, setHState, periodA, periodB }) {
  const today = new Date();
  const [holYear, setHolYear] = useState(today.getFullYear());

  return (
    <div>
      <div style={{ fontSize: 11, color: "#888", background: B.offwhite, borderRadius: 8, padding: "7px 12px", display: "flex", alignItems: "center", gap: 6, marginBottom: 14, fontFamily: "'Open Sans',sans-serif" }}>
        ℹ Holidays toggled off are counted as working days. Changes update RPD calculations across all tabs immediately.
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 14, alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "#888", fontFamily: "'Open Sans',sans-serif" }}>Year:</span>
        {[2024, 2025, 2026, 2027].map((y) => (
          <button key={y} onClick={() => setHolYear(y)} style={{
            fontSize: 12, padding: "4px 12px", border: `0.5px solid ${B.lgray}`, borderRadius: 6, cursor: "pointer", fontFamily: "'Open Sans',sans-serif",
            background: y === holYear ? B.teal : "transparent", color: y === holYear ? B.white : "#666",
          }}>{y}</button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
        {["CA", "US"].map((country) => {
          const hols = HOLIDAYS[holYear]?.[country] || [];
          const flag = country === "CA" ? "🇨🇦" : "🇺🇸";
          const lbl = country === "CA" ? "Canada (federal + ON)" : "United States (federal)";
          const onCount = hols.filter((h) => hState[`${holYear}-${country}-${h.date}`] !== false).length;
          return (
            <div key={country} style={{ background: B.white, border: `0.5px solid ${B.lgray}`, borderRadius: 12, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: B.offwhite, borderBottom: `0.5px solid ${B.lgray}` }}>
                <div style={{ fontSize: 13, fontWeight: 600, fontFamily: "'Poppins',sans-serif", display: "flex", alignItems: "center", gap: 6 }}>
                  <span>{flag}</span>{lbl}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 11, color: "#aaa", fontFamily: "'Open Sans',sans-serif" }}>{onCount}/{hols.length} on</span>
                  <button onClick={() => {
                    const anyOn = hols.some((h) => hState[`${holYear}-${country}-${h.date}`] !== false);
                    setHState((prev) => { const n = { ...prev }; hols.forEach((h) => { n[`${holYear}-${country}-${h.date}`] = !anyOn; }); return n; });
                  }} style={{ fontSize: 11, color: B.teal, background: "none", border: "none", cursor: "pointer", fontFamily: "'Open Sans',sans-serif" }}>Toggle all</button>
                </div>
              </div>
              {hols.map((h) => {
                const key = `${holYear}-${country}-${h.date}`;
                const on = hState[key] !== false;
                const mo = parseInt(h.date.slice(5, 7));
                const isCur = mo === periodA?.month && holYear === periodA?.year;
                return (
                  <div key={h.date} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 14px", borderBottom: `0.5px solid ${B.lgray}`, opacity: on ? 1 : .4, fontFamily: "'Open Sans',sans-serif" }}>
                    <label style={{ position: "relative", width: 28, height: 16, flexShrink: 0, cursor: "pointer" }}>
                      <input type="checkbox" checked={on} onChange={(e) => setHState((prev) => ({ ...prev, [key]: e.target.checked }))} style={{ opacity: 0, width: 0, height: 0, position: "absolute" }} />
                      <div style={{ position: "absolute", inset: 0, background: on ? B.teal : B.lgray, borderRadius: 8 }}>
                        <div style={{ position: "absolute", width: 12, height: 12, borderRadius: "50%", background: B.white, top: 2, left: on ? 14 : 2, transition: "left .15s" }} />
                      </div>
                    </label>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: B.black }}>{h.name}</div>
                      <div style={{ fontSize: 11, color: "#bbb" }}>{h.date}</div>
                    </div>
                    <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 8, fontWeight: isCur ? 600 : 400, background: isCur ? "rgba(44,204,211,.12)" : B.offwhite, color: isCur ? B.teal : "#bbb" }}>{MONTHS[mo - 1]}</span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <div style={{ background: B.white, border: `0.5px solid ${B.lgray}`, borderRadius: 12, padding: "14px 16px", fontFamily: "'Open Sans',sans-serif" }}>
        <div style={{ fontSize: 12, fontWeight: 700, fontFamily: "'Poppins',sans-serif", marginBottom: 10 }}>
          Working day impact — {periodA?.label} vs {periodB?.label}
        </div>
        {periodA?.month && [
          [`${periodA.label}: calendar weekdays`, calcWD(periodA.year, periodA.month, [])],
          [`${periodA.label}: CA working days`, calcWD(periodA.year, periodA.month, getEnabledHols(periodA.year, "CA", hState))],
          [`${periodA.label}: US working days`, calcWD(periodA.year, periodA.month, getEnabledHols(periodA.year, "US", hState))],
          [`${periodB?.label}: CA working days`, calcWD(periodB?.year || periodA.year, periodB?.month || periodA.month, getEnabledHols(periodB?.year || periodA.year, "CA", hState))],
          [`${periodB?.label}: US working days`, calcWD(periodB?.year || periodA.year, periodB?.month || periodA.month, getEnabledHols(periodB?.year || periodA.year, "US", hState))],
        ].map(([label, val]) => (
          <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "5px 0", borderBottom: `0.5px solid ${B.lgray}` }}>
            <span style={{ color: "#888" }}>{label}</span>
            <span style={{ fontWeight: 700, color: B.black }}>{val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
