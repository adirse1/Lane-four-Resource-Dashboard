// Unit tests for the pure pivot/aggregation function. No SF, no React: feed flat
// rows + accessors, assert the matrix, margins, aggregation modes, and the column
// cap. These prove the aggregation before any UI depends on it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { pivot, groupTree } from "../src/lib/pivot.js";

const dim = (id, key) => ({ id, label: id, get: (r) => r[key] });
const sum = (key) => ({ id: key, label: key, agg: "sum", get: (r) => r[key] });
const avg = (key) => ({ id: key, label: key, agg: "avg", get: (r) => r[key] });
const count = () => ({ id: "__count", label: "Count", agg: "count", get: () => 1 });

const ROWS = [
  { pod: "P1", proj: "X", h: 10 },
  { pod: "P1", proj: "Y", h: 5 },
  { pod: "P2", proj: "X", h: 20 },
  { pod: "P3", proj: "X", h: 1 },
];

test("sum: cells, row totals, column totals, grand", () => {
  const m = pivot(ROWS, { rowDims: [dim("pod", "pod")], colDims: [dim("proj", "proj")], measure: sum("h") });
  const rk = (label) => m.rowKeys.find((r) => r.label === label).key;
  const ck = (label) => m.colKeys.find((c) => c.label === label).key;
  assert.equal(m.cells[rk("P1")][ck("X")], 10);
  assert.equal(m.cells[rk("P1")][ck("Y")], 5);
  assert.equal(m.cells[rk("P2")][ck("X")], 20);
  assert.equal(m.rowTotals[rk("P1")], 15);
  assert.equal(m.colTotals[ck("X")], 31);
  assert.equal(m.colTotals[ck("Y")], 5);
  assert.equal(m.grand, 36);
  assert.equal(m.colKeys.length, 2);
  assert.equal(m.rowKeys.length, 3);
});

test("count measure: cells are row counts", () => {
  const m = pivot(ROWS, { rowDims: [dim("pod", "pod")], colDims: [dim("proj", "proj")], measure: count() });
  const rk = (label) => m.rowKeys.find((r) => r.label === label).key;
  const ck = (label) => m.colKeys.find((c) => c.label === label).key;
  assert.equal(m.cells[rk("P1")][ck("X")], 1);
  assert.equal(m.colTotals[ck("X")], 3); // P1, P2, P3 each one X row
  assert.equal(m.grand, 4);
});

test("avg subtotal is true sum/count, not average of cell averages", () => {
  const rows = [
    { pod: "P1", proj: "X", h: 10 },
    { pod: "P1", proj: "X", h: 30 }, // P1/X avg 20, count 2
    { pod: "P2", proj: "X", h: 6 },  // P2/X avg 6,  count 1
  ];
  const m = pivot(rows, { rowDims: [dim("pod", "pod")], colDims: [dim("proj", "proj")], measure: avg("h") });
  const ck = m.colKeys.find((c) => c.label === "X").key;
  // True average of column X = (10+30+6)/3 = 15.333..., NOT (20+6)/2 = 13.
  assert.ok(Math.abs(m.colTotals[ck] - 46 / 3) < 1e-9);
  assert.ok(Math.abs(m.grand - 46 / 3) < 1e-9);
});

test("blank dimension values bucket into (blank)", () => {
  const rows = [{ pod: "P1", proj: null, h: 4 }, { pod: "P1", proj: "", h: 6 }];
  const m = pivot(rows, { rowDims: [dim("pod", "pod")], colDims: [dim("proj", "proj")], measure: sum("h") });
  assert.equal(m.colKeys.length, 1);
  assert.equal(m.colKeys[0].label, "(blank)");
  assert.equal(m.grand, 10);
});

test("column cap folds the rest into Other and preserves the grand total", () => {
  const rows = [
    { pod: "P1", proj: "X", h: 100 },
    { pod: "P1", proj: "Y", h: 10 },
    { pod: "P1", proj: "Z", h: 5 },
  ];
  const m = pivot(rows, { rowDims: [dim("pod", "pod")], colDims: [dim("proj", "proj")], measure: sum("h"), maxCols: 2 });
  assert.equal(m.capped, true);
  assert.equal(m.distinctColCount, 3);
  // maxCols 2 -> keep top 1 (X), fold Y+Z into Other.
  assert.equal(m.colKeys.length, 2);
  assert.equal(m.colKeys[m.colKeys.length - 1].label, "Other"); // Other last
  assert.equal(m.otherColCount, 2);
  const sumColTotals = m.colKeys.reduce((a, c) => a + m.colTotals[c.key], 0);
  assert.equal(sumColTotals, 115); // 100 + (10+5)
  assert.equal(m.grand, 115);
});

test("no column dimension collapses to a single Total column", () => {
  const m = pivot(ROWS, { rowDims: [dim("pod", "pod")], colDims: [], measure: sum("h") });
  assert.equal(m.colKeys.length, 1);
  assert.equal(m.colKeys[0].label, "Total");
  assert.equal(m.grand, 36);
});

// ── groupTree: shared nested grouping / subtotal primitive ──────────────────────
const TREE_ROWS = [
  { pod: "P1", res: "Ann", h: 10, rev: 100 },
  { pod: "P1", res: "Ann", h: 5, rev: 50 },
  { pod: "P1", res: "Bob", h: 20, rev: 200 },
  { pod: "P2", res: "Cy", h: 1, rev: 7 },
];

test("groupTree nests in dimension order with leaves at the innermost level", () => {
  const t = groupTree(TREE_ROWS, [dim("pod", "pod"), dim("res", "res")], [sum("h"), sum("rev")]);
  assert.equal(t.label, "All teams");
  assert.equal(t.children.length, 2); // P1, P2
  const p1 = t.children.find((c) => c.label === "P1");
  assert.equal(p1.depth, 1);
  assert.equal(p1.children.length, 2); // Ann, Bob
  const ann = p1.children.find((c) => c.label === "Ann");
  assert.equal(ann.depth, 2);
  assert.equal(ann.children.length, 0);
  assert.equal(ann.leaves.length, 2); // two Ann splits
});

test("groupTree subtotals roll up: child sums equal parent, parents equal grand", () => {
  const t = groupTree(TREE_ROWS, [dim("pod", "pod"), dim("res", "res")], [sum("h"), sum("rev")]);
  const p1 = t.children.find((c) => c.label === "P1");
  const ann = p1.children.find((c) => c.label === "Ann");
  const bob = p1.children.find((c) => c.label === "Bob");
  // Ann = 10+5 = 15h / 150; Bob = 20h / 200; P1 = 35h / 350.
  assert.equal(ann.totals.h, 15);
  assert.equal(bob.totals.h, 20);
  assert.equal(p1.totals.h, 35);
  assert.equal(ann.totals.h + bob.totals.h, p1.totals.h);
  // Grand = sum of pod subtotals = 35 + 1 = 36h / 357.
  const sumPods = t.children.reduce((a, c) => a + c.totals.h, 0);
  assert.equal(sumPods, t.totals.h);
  assert.equal(t.totals.h, 36);
  assert.equal(t.totals.rev, 357);
});

test("groupTree with no dimensions puts all rows as leaves under the root", () => {
  const t = groupTree(TREE_ROWS, [], [sum("h")]);
  assert.equal(t.children.length, 0);
  assert.equal(t.leaves.length, 4);
  assert.equal(t.totals.h, 36);
});
