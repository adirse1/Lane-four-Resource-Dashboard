// Director / pod structure (from README, authoritative).
//   - Aldus Behan: SF groups Aldus Behan, Lane Four, Mike Scott.
//   - Meghan Saunders: SF groups Meghan Saunders, Meg Diplock.
//   - Tatiane Sensini: SF group Tatiane Sensini. No pods (Fiix + MLG, global total only).
// Pod = the Project Manager field on the timecard
// (pse__Project__r.pse__Project_Manager__r.Name). More reliable than Practice.

export const DIRS = {
  "Aldus Behan": {
    color: { bg: "rgba(44,204,211,0.12)", tx: "#0B8F95" },
    pods: ["Michelle Clark", "Lindsay Chown", "Julie Holm", "Josh Wright"],
    grps: ["Aldus Behan", "Lane Four", "Mike Scott"],
  },
  "Meghan Saunders": {
    color: { bg: "rgba(255,92,57,0.10)", tx: "#993C1D" },
    pods: ["Will Shorthouse", "Vesna Sorgic", "Brandon Wilson", "Malcolm McMullin"],
    grps: ["Meghan Saunders", "Meg Diplock"],
  },
  "Tatiane Sensini": {
    color: { bg: "rgba(253,210,110,0.18)", tx: "#854F0B" },
    pods: [],
    grps: ["Tatiane Sensini"],
  },
};

export const DIRECTORS = ["Aldus Behan", "Meghan Saunders", "Tatiane Sensini"];

// Tati's accounts (Fiix + MLG) roll up to a global total only.
export const TATI_GROUPS = ["Tatiane Sensini", "Lane Four"];
