// Local dev proxy for the Lane Four dashboard.
//
// Why this exists: the browser cannot safely query Salesforce directly (CORS +
// token exposure). This tiny Node server reuses your `sf` CLI authentication,
// forwards SOQL to the Salesforce REST Query API, and persists the team
// hierarchy to a local JSON file. No extra npm dependencies.
//
//   SF_ORG=<alias-or-username>  which authenticated org to query (defaults to
//                               your sf default org if unset)
//   PORT=8787                   proxy port (matches vite.config.js proxy)
//
// Run with:  npm run proxy      (uses node --use-system-ca for the corporate CA)

import { createServer } from "node:http";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const execAsync = promisify(exec);
const PORT = process.env.PORT || 8787;
const HERE = dirname(fileURLToPath(import.meta.url));

// Load a gitignored server/.env (KEY=VALUE per line) into process.env, so local
// secrets like ANTHROPIC_API_KEY can live in a file instead of on the command
// line. An already-set environment variable wins (so `VAR=... npm run proxy`
// still overrides the file). This is local-only; nothing here is ever bundled
// into the browser build. No dependency, mirrors the .sforg file convention.
function loadDotEnv() {
  let txt;
  try { txt = readFileSync(join(HERE, ".env"), "utf8"); } catch { return; }
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue; // skips blanks and # comments
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = val;
  }
}
loadDotEnv();

// Which authenticated sf org to query. Resolution order: SF_ORG env var, then
// the gitignored server/.sforg file, then the sf CLI default org.
function resolveOrg() {
  if (process.env.SF_ORG) return process.env.SF_ORG.trim();
  try { return readFileSync(join(HERE, ".sforg"), "utf8").trim(); } catch { return ""; }
}
const SF_ORG = resolveOrg();
const HIERARCHY_FILE = join(HERE, "data", "hierarchy.json");
const SCENARIO_DIR = join(HERE, "data", "forecast-scenarios");
const safeScenario = (n) => String(n || "").replace(/[^a-zA-Z0-9 _-]/g, "").trim();

let authCache = null; // { token, instanceUrl, version }

// Pull a fresh access token + instance URL from the sf CLI. The sf bundled Node
// needs --use-system-ca for the corporate TLS-intercepting CA (same as npm).
async function getOrgAuth() {
  const cmd = `sf org display --json${SF_ORG ? ` --target-org ${SF_ORG}` : ""}`;
  const { stdout } = await execAsync(cmd, {
    env: { ...process.env, NODE_OPTIONS: "--use-system-ca" },
    maxBuffer: 4 * 1024 * 1024,
  });
  const r = JSON.parse(stdout).result;
  if (!r?.accessToken || !r?.instanceUrl) throw new Error("sf org display returned no token/instanceUrl");
  return { token: r.accessToken, instanceUrl: r.instanceUrl, version: r.apiVersion || "59.0" };
}

async function auth(force = false) {
  if (force || !authCache) authCache = await getOrgAuth();
  return authCache;
}

// Run one SOQL query, following pagination, returning { records, totalSize }.
async function query(soql) {
  let a = await auth();
  const run = async () => {
    const url = `${a.instanceUrl}/services/data/v${a.version}/query/?q=${encodeURIComponent(soql)}`;
    return fetch(url, { headers: { Authorization: `Bearer ${a.token}`, Accept: "application/json" } });
  };
  let resp = await run();
  if (resp.status === 401) { a = await auth(true); resp = await run(); } // token expired -> refresh once
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`Salesforce ${resp.status}: ${body}`);
  }
  let data = await resp.json();
  let records = data.records || [];
  while (data.nextRecordsUrl) {
    const next = await fetch(`${a.instanceUrl}${data.nextRecordsUrl}`, { headers: { Authorization: `Bearer ${a.token}`, Accept: "application/json" } });
    if (!next.ok) break;
    data = await next.json();
    records = records.concat(data.records || []);
  }
  return { records, totalSize: records.length };
}

// Describe one sobject, returning a trimmed field list for the report builder's
// column picker (label + API name + type + filterable/groupable flags). Same
// 401-refresh-once pattern as query(). Not SOQL, so it is not in the query tests.
async function describe(sobject) {
  let a = await auth();
  const run = async () =>
    fetch(`${a.instanceUrl}/services/data/v${a.version}/sobjects/${encodeURIComponent(sobject)}/describe/`, { headers: { Authorization: `Bearer ${a.token}`, Accept: "application/json" } });
  let resp = await run();
  if (resp.status === 401) { a = await auth(true); resp = await run(); }
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`Salesforce ${resp.status}: ${body}`);
  }
  const d = await resp.json();
  const fields = (d.fields || []).map((f) => ({ label: f.label, name: f.name, type: f.type, filterable: !!f.filterable, groupable: !!f.groupable, custom: !!f.custom }));
  return { fields };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => resolve(b)); req.on("error", reject);
  });
}
function json(res, code, obj) {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(obj));
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === "POST" && req.url === "/api/sf") {
      const { soql } = JSON.parse(await readBody(req));
      if (!soql) return json(res, 400, { error: "missing soql" });
      const t0 = Date.now();
      const result = await query(soql);
      console.log(`  SF ${result.totalSize} rows in ${Date.now() - t0}ms  ${soql.slice(0, 70)}...`);
      return json(res, 200, result);
    }
    if (req.method === "GET" && req.url === "/api/hierarchy") {
      try { return json(res, 200, JSON.parse(await readFile(HIERARCHY_FILE, "utf8"))); }
      catch { return json(res, 200, {}); }
    }
    if (req.method === "POST" && req.url === "/api/hierarchy") {
      await mkdir(dirname(HIERARCHY_FILE), { recursive: true });
      await writeFile(HIERARCHY_FILE, await readBody(req));
      return json(res, 200, { ok: true });
    }
    // Forecast scenarios: list / read / write under data/forecast-scenarios/.
    if (req.method === "GET" && req.url.startsWith("/api/scenarios")) {
      try { await mkdir(SCENARIO_DIR, { recursive: true }); const files = await readdir(SCENARIO_DIR); return json(res, 200, { scenarios: files.filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, "")) }); }
      catch { return json(res, 200, { scenarios: [] }); }
    }
    if (req.method === "GET" && req.url.startsWith("/api/scenario?")) {
      const nm = safeScenario(new URL(req.url, "http://localhost").searchParams.get("name"));
      if (!nm) return json(res, 400, { error: "missing name" });
      try { return json(res, 200, JSON.parse(await readFile(join(SCENARIO_DIR, nm + ".json"), "utf8"))); }
      catch { return json(res, 404, { error: "scenario not found" }); }
    }
    if (req.method === "POST" && req.url === "/api/scenario") {
      const body = JSON.parse(await readBody(req));
      const nm = safeScenario(body.name);
      if (!nm) return json(res, 400, { error: "invalid name" });
      await mkdir(SCENARIO_DIR, { recursive: true });
      await writeFile(join(SCENARIO_DIR, nm + ".json"), JSON.stringify(body.scenario ?? {}, null, 2));
      return json(res, 200, { ok: true, name: nm });
    }
    // AI synthesis: forward a prompt to the Anthropic Messages API with the key held
    // here (never in the browser). Requires ANTHROPIC_API_KEY in the proxy's env.
    if (req.method === "POST" && req.url === "/api/claude") {
      const key = process.env.ANTHROPIC_API_KEY;
      if (!key) return json(res, 400, { error: "ANTHROPIC_API_KEY is not set on the proxy; AI analysis is unavailable" });
      const { prompt, max_tokens } = JSON.parse(await readBody(req));
      if (!prompt) return json(res, 400, { error: "missing prompt" });
      const t0 = Date.now();
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: max_tokens || 2048, messages: [{ role: "user", content: prompt }] }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) return json(res, r.status, { error: data?.error?.message || ("Anthropic " + r.status) });
      const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
      console.log(`  AI ${Date.now() - t0}ms, ${text.length} chars`);
      return json(res, 200, { text });
    }
    if (req.method === "GET" && req.url.startsWith("/api/describe")) {
      const so = new URL(req.url, "http://localhost").searchParams.get("sobject") || "";
      if (!/^[A-Za-z0-9_]+$/.test(so)) return json(res, 400, { error: "invalid sobject" });
      const t0 = Date.now();
      const result = await describe(so);
      console.log(`  DESC ${result.fields.length} fields in ${Date.now() - t0}ms  ${so}`);
      return json(res, 200, result);
    }
    if (req.method === "GET" && req.url === "/api/health") {
      const a = await auth();
      return json(res, 200, { ok: true, org: SF_ORG || "(default)", instanceUrl: a.instanceUrl, version: a.version });
    }
    json(res, 404, { error: "not found" });
  } catch (e) {
    console.error("  ERROR:", e.message);
    json(res, 500, { error: e.message });
  }
});

// Keep idle keep-alive sockets open longer than Vite's dev-proxy agent holds them
// (default Node keepAliveTimeout is 5s; Vite reuses sockets and hits ECONNRESET if
// Node closed first). headersTimeout must exceed keepAliveTimeout.
server.keepAliveTimeout = 75000;
server.headersTimeout = 76000;

server.listen(PORT, () => {
  console.log(`Lane Four SF proxy on http://localhost:${PORT}  (org: ${SF_ORG || "sf default"})`);
  console.log(`  GET /api/health to verify the Salesforce connection.`);
  console.log(`  AI analysis (/api/claude): ${process.env.ANTHROPIC_API_KEY ? "key loaded" : "no key set, AI unavailable"}`);
});
