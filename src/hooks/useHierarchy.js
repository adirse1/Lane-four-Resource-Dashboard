// Owns the shared team hierarchy (H): loads it from Drive, syncs people from
// Salesforce, and saves back to Drive. Called once at the app root; H is shared
// by the Hierarchy and Utilization tabs.
//
// Note: the Drive save confirmation is brittle (any non-error response reads as
// success). Known bug, preserved here verbatim — flag before "fixing".
import { useState, useEffect, useCallback } from "react";
import { callSF, callDrive } from "../lib/salesforce.js";
import { hierarchyAssignments } from "../lib/queries.js";
import { buildSeed, getAssigned } from "../lib/hierarchy.js";
import { FOLDER_ID } from "../constants/brand.js";

export function useHierarchy() {
  const [H, setH] = useState(null);
  const [status, setStatus] = useState({ msg: "Loading...", type: "" });
  const [saveStatus, setSaveStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadMsg, setLoadMsg] = useState("");

  // Preserving sync: keep existing hierarchy, only add genuinely new people to unassigned.
  const syncSF = useCallback(async () => {
    setLoading(true); setLoadMsg("Loading from Salesforce...");
    try {
      const res = await callSF(hierarchyAssignments());
      if (!res?.records) { setStatus({ msg: "No SF data", type: "r" }); setLoading(false); return; }
      const pg = {};
      res.records.forEach((r) => { if (!r.resource) return; if (!pg[r.resource] || r.cnt > pg[r.resource].cnt) pg[r.resource] = { grp: r.grp, pm: r.pm, cnt: r.cnt }; });
      setH((prev) => {
        if (!prev) return buildSeed(pg);
        const asgn = getAssigned(prev);
        const newUns = [...prev.unassigned];
        Object.keys(pg).forEach((p) => { if (!asgn.has(p) && !newUns.includes(p)) newUns.push(p); });
        return { ...prev, unassigned: [...new Set(newUns)] };
      });
      setStatus({ msg: Object.keys(pg).length + " people loaded", type: "g" });
    } catch (e) { setStatus({ msg: "Error: " + e.message, type: "r" }); }
    setLoading(false);
  }, []);

  const saveHierarchy = useCallback(async () => {
    if (!H) return;
    setSaveStatus("Saving...");
    try {
      const content = JSON.stringify(H, null, 2);
      await callDrive('In Google Drive folder ID "' + FOLDER_ID + '", create or replace a file named "hierarchy.json" with this exact JSON content:\n\n' + content + '\n\nConfirm success.');
      setSaveStatus("Saved " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      setStatus({ msg: "Synced with Drive", type: "g" });
    } catch (e) { setSaveStatus("Save failed"); }
  }, [H]);

  // On mount: try Drive first, then sync from Salesforce.
  useEffect(() => {
    const load = async () => {
      setLoading(true); setLoadMsg("Loading hierarchy from Drive...");
      try {
        const saved = await callDrive('In Google Drive folder ID "' + FOLDER_ID + '", find the file named "hierarchy.json" and return its complete text content. Return ONLY the raw JSON.');
        if (saved && saved.directors) { setH(saved); setStatus({ msg: "Loaded from Drive", type: "g" }); }
      } catch (e) { console.warn("Drive:", e.message); }
      await syncSF();
    };
    load();
  }, [syncSF]);

  return { H, setH, status, setStatus, saveStatus, saveHierarchy, syncSF, loading, loadMsg };
}
