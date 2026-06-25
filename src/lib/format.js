// Display formatters and avatar helpers. Pure functions, no side effects.

export const fmt = (n) => `$${Math.round(n || 0).toLocaleString()}`;
export const fmtK = (n) => `$${((n || 0) / 1000).toFixed(0)}k`;
export const fmtD = (n) => (n >= 0 ? "+" : "") + n.toFixed(1) + "%";
export const fmtH = (n) => Math.round(n || 0).toLocaleString();

// Avatar color cycle + initials, keyed deterministically off the person's name.
export const AC = [
  { bg: "rgba(44,204,211,0.15)", tx: "#0B8F95" },
  { bg: "rgba(255,92,57,0.12)", tx: "#993C1D" },
  { bg: "rgba(253,210,110,0.2)", tx: "#854F0B" },
  { bg: "rgba(83,74,183,0.12)", tx: "#3C3489" },
  { bg: "rgba(29,158,117,0.12)", tx: "#085041" },
];

export const ac = (n) => {
  let h = 0;
  for (let c of n) h = (h * 31 + c.charCodeAt(0)) % 5;
  return AC[Math.abs(h)];
};

export const ini = (n) => {
  const p = n.trim().split(" ");
  return (p[0][0] + (p[p.length - 1][0] || "")).toUpperCase();
};
