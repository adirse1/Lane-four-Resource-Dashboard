import { B } from "../constants/brand.js";

export default function Spinner({ msg }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 48, gap: 12, fontFamily: "'Open Sans',sans-serif" }}>
      <div style={{ width: 28, height: 28, borderRadius: "50%", border: `3px solid ${B.lgray}`, borderTopColor: B.teal, animation: "lfSpin .7s linear infinite" }} />
      <div style={{ fontSize: 12, color: "#999" }}>{msg || "Loading..."}</div>
      <style>{`@keyframes lfSpin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
