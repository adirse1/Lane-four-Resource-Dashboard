// Pure helpers for shaping the team hierarchy tree. No React, no side effects.
import { DIRS, DIRECTORS } from "../constants/teams.js";

// Build the initial director/pod tree from a {person: {grp, pm, cnt}} map.
export function buildSeed(pg) {
  const h = { directors: [], unassigned: [] };
  Object.entries(DIRS).forEach(([dn, cfg]) => {
    const dir = { name: dn, color: cfg.color, pods: cfg.pods.map((n) => ({ name: n, members: [], expanded: true })), directMembers: [], expanded: true };
    Object.entries(pg).forEach(([person, info]) => {
      if (person === dn || !cfg.grps.includes(info.grp)) return;
      const pod = dir.pods.find((p) => p.name === info.pm);
      if (pod) { if (!pod.members.includes(person)) pod.members.push(person); }
      else { if (!dir.directMembers.includes(person)) dir.directMembers.push(person); }
    });
    h.directors.push(dir);
  });
  const asgn = new Set();
  h.directors.forEach((d) => { d.pods.forEach((p) => p.members.forEach((m) => asgn.add(m))); d.directMembers.forEach((m) => asgn.add(m)); });
  Object.keys(pg).forEach((p) => { if (!asgn.has(p) && !DIRECTORS.includes(p)) h.unassigned.push(p); });
  return h;
}

// Set of all people currently placed somewhere in the tree.
export function getAssigned(h) {
  const s = new Set();
  h.directors.forEach((d) => { d.pods.forEach((p) => p.members.forEach((m) => s.add(m))); (d.directMembers || []).forEach((m) => s.add(m)); });
  return s;
}
