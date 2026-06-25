import { B } from "../constants/brand.js";
import { ac, ini } from "../lib/format.js";

// Draggable person chip used in the hierarchy tab.
export default function Chip({ name, di, pi, wide, onRemove, onDragStart, onDragEnd }) {
  const c = ac(name);
  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", name); onDragStart(name, di, pi); }}
      onDragEnd={onDragEnd}
      style={{
        display: "flex", alignItems: "center", gap: 6, padding: "4px 7px",
        background: wide ? `rgba(44,204,211,0.06)` : B.white,
        borderRadius: 5, border: `0.5px ${wide ? "dashed" : "solid"} ${wide ? B.teal : B.lgray}`,
        cursor: "grab", userSelect: "none",
        opacity: wide ? .6 : 1, fontSize: 11, fontFamily: "'Open Sans',sans-serif",
      }}
    >
      <div style={{ width: 18, height: 18, borderRadius: "50%", background: c.bg, color: c.tx, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700, flexShrink: 0 }}>{ini(name)}</div>
      <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 120 }} title={name}>{name.split(" ")[0]} {name.split(" ").slice(-1)[0]}</span>
      {onRemove && <button onClick={(e) => { e.stopPropagation(); onRemove(name, di, pi); }} style={{ fontSize: 12, color: "#ccc", background: "none", border: "none", cursor: "pointer", padding: "0 2px", lineHeight: 1 }}>×</button>}
    </div>
  );
}
