// Hierarchy persistence, per runtime mode:
//   fixtures  no persistence (rebuilt from Salesforce each session)
//   proxy     server/data/hierarchy.json via the local proxy (/api/hierarchy)
//   oauth     this viewer's browser localStorage
//
// Note: in production (oauth) the arrangement is per-viewer, not org-shared. To
// share one hierarchy across everyone, persist it to Salesforce (a custom object
// or Document) — a future enhancement.
import { MODE } from "./env.js";

const LS_KEY = "lf_hierarchy";

export async function loadHierarchy() {
  if (MODE === "fixtures") return null;
  if (MODE === "oauth") {
    try { const j = JSON.parse(localStorage.getItem(LS_KEY)); return j?.directors ? j : null; }
    catch { return null; }
  }
  try {
    const r = await fetch("/api/hierarchy");
    if (!r.ok) return null;
    const j = await r.json();
    return j && j.directors ? j : null;
  } catch {
    return null;
  }
}

export async function saveHierarchy(h) {
  if (MODE === "fixtures") return true;
  if (MODE === "oauth") { localStorage.setItem(LS_KEY, JSON.stringify(h)); return true; }
  const r = await fetch("/api/hierarchy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(h),
  });
  if (!r.ok) throw new Error("Hierarchy save failed (" + r.status + ")");
  return true;
}
