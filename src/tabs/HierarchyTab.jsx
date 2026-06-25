// Team hierarchy: drag-drop people into a director/pod structure.
// Data (load/sync/save) is owned by useHierarchy at the app root; this tab is
// presentation + drag interaction over the shared H, mutated via setH.
import { useState } from "react";
import { B } from "../constants/brand.js";
import { ini } from "../lib/format.js";
import { Chip, DropZone, Spinner } from "../components/index.js";

export default function HierarchyTab({ H, setH, loading, loadMsg }) {
  const [dragPerson, setDragPerson] = useState(null);
  const [dragSrc, setDragSrc] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [unsOpen, setUnsOpen] = useState(true);
  const [addPodDi, setAddPodDi] = useState(null);
  const [newPodName, setNewPodName] = useState("");

  const remMem = (name, di, pi) => {
    setH((prev) => {
      const h = JSON.parse(JSON.stringify(prev));
      if (di === "u") { h.unassigned = h.unassigned.filter((x) => x !== name); return h; }
      const d = h.directors[di]; if (!d) return h;
      if (pi === -1) d.directMembers = (d.directMembers || []).filter((x) => x !== name);
      else { const pod = d.pods[pi]; if (pod) pod.members = pod.members.filter((x) => x !== name); }
      return h;
    });
  };
  const addMem = (name, di, pi) => {
    setH((prev) => {
      const h = JSON.parse(JSON.stringify(prev));
      if (di === "u") { if (!h.unassigned.includes(name)) h.unassigned.push(name); return h; }
      const d = h.directors[di]; if (!d) return h;
      if (pi === -1) { if (!d.directMembers) d.directMembers = []; if (!d.directMembers.includes(name)) d.directMembers.push(name); }
      else { const pod = d.pods[pi]; if (pod && !pod.members.includes(name)) pod.members.push(name); }
      return h;
    });
  };
  const handleDrop = (di, pi) => {
    if (!dragPerson || !dragSrc) return;
    remMem(dragPerson, dragSrc.di, dragSrc.pi);
    addMem(dragPerson, di, pi);
    setDragPerson(null); setDragSrc(null); setDragOver(null);
  };
  const handleRemove = (name, di, pi) => { remMem(name, di, pi); addMem(name, "u", "_u_"); };
  const togglePod = (di, pi) => {
    setH((prev) => { const h = JSON.parse(JSON.stringify(prev)); h.directors[di].pods[pi].expanded = !h.directors[di].pods[pi].expanded; return h; });
  };
  const addPod = () => {
    if (!newPodName.trim()) return;
    setH((prev) => { const h = JSON.parse(JSON.stringify(prev)); h.directors[addPodDi].pods.push({ name: newPodName.trim(), members: [], expanded: true }); return h; });
    setNewPodName(""); setAddPodDi(null);
  };

  if (loading) return <Spinner msg={loadMsg} />;
  if (!H) return <Spinner msg="Waiting for data..." />;
  const dragOverKey = dragOver;

  return (
    <div>
      {/* Unassigned */}
      <div style={{ background: B.white, borderRadius: 10, border: `0.5px solid ${B.lgray}`, overflow: "hidden", marginBottom: 20 }}>
        <div onClick={() => setUnsOpen((o) => !o)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: B.offwhite, borderBottom: `0.5px solid ${B.lgray}`, cursor: "pointer" }}>
          <span style={{ fontSize: 14 }}>👤</span>
          <span style={{ fontSize: 12, fontWeight: 600, fontFamily: "'Poppins',sans-serif", flex: 1 }}>Unassigned</span>
          <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 7, fontWeight: 600, background: B.amberBg, color: B.amberTx }}>{H.unassigned.length}</span>
          <span style={{ fontSize: 10, color: "#bbb", transform: unsOpen ? "rotate(180deg)" : "none", transition: "transform .15s" }}>▼</span>
        </div>
        {unsOpen && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver("uns"); }}
            onDragLeave={() => setDragOver(null)}
            onDrop={(e) => { e.preventDefault(); handleDrop("u", "_u_"); setDragOver(null); }}
            style={{ padding: "10px 14px", display: "flex", flexWrap: "wrap", gap: 5, minHeight: 40, background: dragOverKey === "uns" ? "rgba(44,204,211,0.05)" : "transparent", outline: dragOverKey === "uns" ? `2px dashed ${B.teal}` : "none", outlineOffset: -3 }}
          >
            {H.unassigned.map((p) => (
              <Chip key={p} name={p} di="u" pi="_u_" wide
                onRemove={null}
                onDragStart={(name, di, pi) => { setDragPerson(name); setDragSrc({ di, pi }); }}
                onDragEnd={() => { setDragPerson(null); setDragOver(null); }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Director grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
        {H.directors.map((dir, di) => {
          const tot = (dir.pods || []).reduce((s, p) => s + p.members.length, 0) + (dir.directMembers || []).length;
          return (
            <div key={dir.name} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ background: B.white, borderRadius: 10, border: `0.5px solid ${B.lgray}`, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: B.offwhite, borderBottom: `0.5px solid ${B.lgray}` }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: dir.color.bg, color: dir.color.tx, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, fontFamily: "'Poppins',sans-serif" }}>{ini(dir.name)}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "'Poppins',sans-serif", flex: 1 }}>{dir.name.split(" ")[0]}</div>
                  <div style={{ fontSize: 11, color: "#aaa" }}>{tot}</div>
                </div>
                <div style={{ padding: 6, display: "flex", flexDirection: "column", gap: 6 }}>
                  {/* Direct members */}
                  <div style={{ background: B.offwhite, borderRadius: 7, border: `0.5px solid ${B.lgray}`, overflow: "hidden" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 9px" }}>
                      <div style={{ width: 7, height: 7, borderRadius: "50%", background: B.lgray, flexShrink: 0 }} />
                      <div style={{ fontSize: 11, fontWeight: 600, flex: 1 }}>{dir.name.split(" ")[0]} (direct)</div>
                      <div style={{ fontSize: 10, color: "#aaa" }}>{(dir.directMembers || []).length}</div>
                    </div>
                    <DropZone di={di} pi={-1}
                      onDrop={handleDrop} onDragOver={(di, pi) => setDragOver(`${di}-${pi}`)} onDragLeave={() => setDragOver(null)}
                      isDragOver={dragOverKey === `${di}--1`}
                    >
                      {(dir.directMembers || []).map((p) => (
                        <Chip key={p} name={p} di={di} pi={-1}
                          onRemove={handleRemove}
                          onDragStart={(name, di, pi) => { setDragPerson(name); setDragSrc({ di, pi }); }}
                          onDragEnd={() => { setDragPerson(null); setDragOver(null); }}
                        />
                      ))}
                    </DropZone>
                  </div>
                  {/* Pods */}
                  {(dir.pods || []).map((pod, pi) => (
                    <div key={pod.name} style={{ background: B.offwhite, borderRadius: 7, border: `0.5px solid ${B.lgray}`, overflow: "hidden" }}>
                      <div onClick={() => togglePod(di, pi)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 9px", cursor: "pointer" }}>
                        <div style={{ width: 7, height: 7, borderRadius: "50%", background: B.teal, flexShrink: 0 }} />
                        <div style={{ fontSize: 11, fontWeight: 600, flex: 1 }}>{pod.name}</div>
                        <div style={{ fontSize: 10, color: "#aaa" }}>{pod.members.length}</div>
                        <div style={{ fontSize: 10, color: "#bbb", transform: pod.expanded !== false ? "rotate(180deg)" : "none", transition: "transform .15s" }}>▼</div>
                      </div>
                      {pod.expanded !== false && (
                        <DropZone di={di} pi={pi}
                          onDrop={handleDrop} onDragOver={(di, pi) => setDragOver(`${di}-${pi}`)} onDragLeave={() => setDragOver(null)}
                          isDragOver={dragOverKey === `${di}-${pi}`}
                        >
                          {pod.members.map((p) => (
                            <Chip key={p} name={p} di={di} pi={pi}
                              onRemove={handleRemove}
                              onDragStart={(name, di, pi) => { setDragPerson(name); setDragSrc({ di, pi }); }}
                              onDragEnd={() => { setDragPerson(null); setDragOver(null); }}
                            />
                          ))}
                        </DropZone>
                      )}
                    </div>
                  ))}
                  {/* Add pod */}
                  <button onClick={() => setAddPodDi(di)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 9px", border: `0.5px dashed ${B.lgray}`, borderRadius: 7, background: "transparent", color: "#aaa", fontSize: 10, cursor: "pointer", width: "100%", fontFamily: "'Open Sans',sans-serif" }}>
                    + Add pod
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add pod modal */}
      {addPodDi !== null && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 500 }} onClick={() => setAddPodDi(null)}>
          <div style={{ background: B.white, borderRadius: 12, padding: 24, width: 360 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "'Poppins',sans-serif", marginBottom: 14 }}>Add pod</div>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".05em", color: "#888", marginBottom: 5 }}>Pod lead name</div>
            <input autoFocus value={newPodName} onChange={(e) => setNewPodName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addPod()}
              style={{ width: "100%", padding: "9px 11px", border: `0.5px solid ${B.lgray}`, borderRadius: 7, fontSize: 12, fontFamily: "'Open Sans',sans-serif", outline: "none", marginBottom: 16 }}
              placeholder="e.g. Sarah Kim" />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setAddPodDi(null)} style={{ fontSize: 11, padding: "5px 12px", border: `0.5px solid ${B.lgray}`, borderRadius: 6, background: "transparent", cursor: "pointer" }}>Cancel</button>
              <button onClick={addPod} style={{ fontSize: 11, padding: "5px 12px", background: B.teal, color: B.white, border: "none", borderRadius: 6, cursor: "pointer" }}>Add pod</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
