import { B } from "../constants/brand.js";

export default function Pill({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      fontSize: 11, padding: "4px 10px", border: "none", cursor: "pointer",
      background: active ? B.teal : "transparent",
      color: active ? B.white : "#888",
      fontFamily: "'Open Sans',sans-serif",
    }}>{children}</button>
  );
}
