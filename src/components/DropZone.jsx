import { B } from "../constants/brand.js";

// Drop target for hierarchy chips (a pod, a director's direct members, etc.).
export default function DropZone({ di, pi, onDrop, onDragOver, onDragLeave, isDragOver, children }) {
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; onDragOver(di, pi); }}
      onDragLeave={onDragLeave}
      onDrop={(e) => { e.preventDefault(); onDrop(di, pi); }}
      style={{
        padding: "5px 6px 6px", display: "flex", flexDirection: "column", gap: 2, minHeight: 28,
        borderTop: `0.5px solid ${B.lgray}`,
        background: isDragOver ? "rgba(44,204,211,0.08)" : "transparent",
        outline: isDragOver ? `2px dashed ${B.teal}` : "none",
        outlineOffset: -3, borderRadius: "0 0 7px 7px",
        transition: "background .1s",
      }}
    >{children}</div>
  );
}
