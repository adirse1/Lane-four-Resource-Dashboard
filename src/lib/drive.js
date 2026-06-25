// Hierarchy persistence. Originally Google Drive (hierarchy.json) via an MCP
// natural-language prompt; locally it goes through the proxy's /api/hierarchy
// file store. In fixtures mode there is no persistence (load returns null, save
// is a no-op), so the tree is built fresh from Salesforce each session.
import { USE_FIXTURES } from "./env.js";

export async function loadHierarchy() {
  if (USE_FIXTURES) return null;
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
  if (USE_FIXTURES) return true;
  const r = await fetch("/api/hierarchy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(h),
  });
  if (!r.ok) throw new Error("Hierarchy save failed (" + r.status + ")");
  return true;
}
