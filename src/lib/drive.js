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

// ── Forecast scenarios (resource planner overlay) ────────────────────────────────
// Persisted per runtime mode, same choke-point as the hierarchy:
//   proxy   server/data/forecast-scenarios/[name].json via the local proxy
//   oauth   this viewer's browser localStorage (per-viewer)
//   fixtures browser localStorage too, so dev can save/load without a proxy
// Only the planner OVERLAY is written (hypothetical people/projects, overlay hours,
// pod reassignments) — committed Salesforce assignment data is never saved.
const SCEN_PREFIX = "lf_scenario_";
function safeScenarioName(name) {
  const s = String(name || "").replace(/[^a-zA-Z0-9 _-]/g, "").trim();
  if (!s) throw new Error("Invalid scenario name (use letters, numbers, spaces, - or _)");
  return s;
}

export async function listScenarios() {
  if (MODE === "proxy") {
    const r = await fetch("/api/scenarios");
    if (!r.ok) throw new Error("Could not list scenarios (" + r.status + ")");
    const j = await r.json();
    return Array.isArray(j?.scenarios) ? j.scenarios : [];
  }
  return Object.keys(localStorage).filter((k) => k.startsWith(SCEN_PREFIX)).map((k) => k.slice(SCEN_PREFIX.length)).sort();
}

export async function saveScenario(name, scenario) {
  const nm = safeScenarioName(name);
  if (MODE === "proxy") {
    const r = await fetch("/api/scenario", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nm, scenario }),
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => "");
      throw new Error("Drive save failed (" + r.status + (detail ? ": " + detail : "") + ")");
    }
    // The doc warns the old hierarchy save read ANY non-error as success. Here we
    // require the proxy to actually confirm the write (ok:true) before reporting
    // success; a 200 without confirmation is treated as a failure.
    const j = await r.json().catch(() => null);
    if (!j || j.ok !== true) throw new Error("Drive did not confirm the save");
    return j;
  }
  try { localStorage.setItem(SCEN_PREFIX + nm, JSON.stringify(scenario)); }
  catch (e) { throw new Error("Local save failed: " + e.message); }
  return { ok: true, name: nm };
}

export async function loadScenario(name) {
  const nm = safeScenarioName(name);
  if (MODE === "proxy") {
    const r = await fetch("/api/scenario?name=" + encodeURIComponent(nm));
    if (!r.ok) throw new Error("Could not load scenario (" + r.status + ")");
    const j = await r.json();
    if (!j || j.error) throw new Error(j?.error || "Scenario not found");
    return j;
  }
  const v = localStorage.getItem(SCEN_PREFIX + nm);
  if (!v) throw new Error("Scenario not found");
  return JSON.parse(v);
}
