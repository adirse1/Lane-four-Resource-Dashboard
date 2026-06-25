import { B } from "../constants/brand.js";
import { fmtD } from "../lib/format.js";

export default function DeltaCell({ a, b }) {
  if (!b) return <span style={{ color: "#ccc" }}>—</span>;
  const pct = b > 0 ? ((a - b) / b * 100) : null;
  const color = pct === null ? "#aaa" : pct >= 0 ? B.green : B.red;
  return <span style={{ fontWeight: 600, color }}>{pct !== null ? fmtD(pct) : "—"}</span>;
}
