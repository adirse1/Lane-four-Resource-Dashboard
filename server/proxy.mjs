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
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const execAsync = promisify(exec);
const PORT = process.env.PORT || 8787;
const HERE = dirname(fileURLToPath(import.meta.url));

// Which authenticated sf org to query. Resolution order: SF_ORG env var, then
// the gitignored server/.sforg file, then the sf CLI default org.
function resolveOrg() {
  if (process.env.SF_ORG) return process.env.SF_ORG.trim();
  try { return readFileSync(join(HERE, ".sforg"), "utf8").trim(); } catch { return ""; }
}
const SF_ORG = resolveOrg();
const HIERARCHY_FILE = join(HERE, "data", "hierarchy.json");

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

server.listen(PORT, () => {
  console.log(`Lane Four SF proxy on http://localhost:${PORT}  (org: ${SF_ORG || "sf default"})`);
  console.log(`  GET /api/health to verify the Salesforce connection.`);
});
