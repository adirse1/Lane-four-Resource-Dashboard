// Hierarchy persistence, per runtime mode:
//   fixtures  the git-committed baseline (data/hierarchy.json), else none
//   proxy     server/data/hierarchy.json via the local proxy, else git baseline
//   oauth     this viewer's browser localStorage, else git baseline
//
// The git-committed baseline (data/hierarchy.json) is the cross-machine source of
// truth: it ships in the bundle, so every machine and the live site load the same
// arrangement. A local save (localStorage / proxy file) overrides it as a working
// copy; to update the shared baseline, copy the hierarchy JSON out of the UI and
// commit data/hierarchy.json. (Gotcha: a machine carrying an older local save wins
// over a newer committed baseline until that local save is cleared.)
//
// Note: in production (oauth) the local working copy is per-viewer, not org-shared.
// To autosync edits across everyone with no commit step, persist to Salesforce (a
// custom object or Document) — a future enhancement.
import { MODE } from "./env.js";
import committed from "../data/hierarchy.json";

const LS_KEY = "lf_hierarchy";

// The committed baseline counts only when it actually has directors; an empty file
// means "no baseline yet" and we fall through to a Salesforce-built seed.
const BASELINE =
  committed && Array.isArray(committed.directors) && committed.directors.length ? committed : null;

export async function loadHierarchy() {
  if (MODE === "fixtures") return BASELINE;
  if (MODE === "oauth") {
    try { const j = JSON.parse(localStorage.getItem(LS_KEY)); if (j?.directors) return j; }
    catch { /* fall through to baseline */ }
    return BASELINE;
  }
  try {
    const r = await fetch("/api/hierarchy");
    if (r.ok) { const j = await r.json(); if (j && j.directors) return j; }
  } catch { /* fall through to baseline */ }
  return BASELINE;
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
