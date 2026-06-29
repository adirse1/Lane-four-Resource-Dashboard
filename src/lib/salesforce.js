// Data access. Two modes (see env.js):
//   fixtures  -> local sample data (npm run dev)
//   live      -> POST /api/sf to the local proxy, which reuses your sf CLI auth
//                and forwards SOQL to Salesforce's REST Query API (npm run dev:live)
//
// callClaude is retained for the AI workflow (vacation-coverage / sendPrompt),
// which talks to the Anthropic Messages API. It is NOT used for data anymore.
import { MODE, SF_API_VERSION } from "./env.js";
import { sfFixture, describeFixture } from "./fixtures.js";
import { getAuth } from "./sfAuth.js";

export async function callSF(soql) {
  if (MODE === "fixtures") return sfFixture(soql);
  if (MODE === "oauth") return queryDirect(soql);
  return queryViaProxy(soql);
}

// Describe an sobject's fields (label + API name + type + filterable/groupable)
// for the report builder's column picker. Same data choke-point and three modes
// as callSF: fixtures (canned), proxy (GET /api/describe), oauth (REST describe).
export async function describeSObject(sobject) {
  if (MODE === "fixtures") return describeFixture(sobject);
  if (MODE === "oauth") return describeDirect(sobject);
  return describeViaProxy(sobject);
}

async function describeViaProxy(sobject) {
  const resp = await fetch(`/api/describe?sobject=${encodeURIComponent(sobject)}`);
  if (!resp.ok) {
    const detail = await resp.text().catch(() => "");
    throw new Error("SF describe " + resp.status + (detail ? ": " + detail : ""));
  }
  return resp.json(); // { fields: [...] }
}

async function describeDirect(sobject) {
  const auth = getAuth();
  if (!auth?.access_token) throw new Error("Not signed in to Salesforce");
  const resp = await fetch(`${auth.instance_url}/services/data/v${SF_API_VERSION}/sobjects/${encodeURIComponent(sobject)}/describe/`, {
    headers: { Authorization: `Bearer ${auth.access_token}`, Accept: "application/json" },
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => "");
    throw new Error("Salesforce " + resp.status + (detail ? ": " + detail : ""));
  }
  const data = await resp.json();
  return { fields: (data.fields || []).map((f) => ({ label: f.label, name: f.name, type: f.type, filterable: !!f.filterable, groupable: !!f.groupable, custom: !!f.custom })) };
}

// dev:live — local Node proxy reuses the sf CLI auth.
//
// The Vite dev proxy intermittently resets the socket to the local Node proxy on
// larger responses (ECONNRESET) and can leave a request hanging. So each call has
// a timeout and one automatic retry on a transient failure (reset / hang / network)
// — a real Salesforce error response (non-2xx with a body) is NOT retried. This
// keeps a single flaky hop from hanging a whole tab's load.
async function queryViaProxy(soql) {
  const attempt = async () => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    try {
      const resp = await fetch("/api/sf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ soql }),
        signal: ctrl.signal,
      });
      if (!resp.ok) {
        const detail = await resp.text().catch(() => "");
        const err = new Error("SF proxy " + resp.status + (detail ? ": " + detail : ""));
        err.real = true; // a genuine server response, do not retry
        throw err;
      }
      return await resp.json();
    } finally {
      clearTimeout(timer);
    }
  };
  try {
    return await attempt();
  } catch (e) {
    if (e?.real) throw e;          // real SF/HTTP error: surface immediately
    return await attempt();         // transient (abort/reset/network): one retry
  }
}

// production — query Salesforce REST API directly with the viewer's OAuth token.
// Follows pagination so aggregate/large results come back whole.
async function queryDirect(soql) {
  const auth = getAuth();
  if (!auth?.access_token) throw new Error("Not signed in to Salesforce");
  const headers = { Authorization: `Bearer ${auth.access_token}`, Accept: "application/json" };
  let url = `${auth.instance_url}/services/data/v${SF_API_VERSION}/query/?q=${encodeURIComponent(soql)}`;
  let records = [];
  while (url) {
    const resp = await fetch(url, { headers });
    if (!resp.ok) {
      const detail = await resp.text().catch(() => "");
      throw new Error("Salesforce " + resp.status + (detail ? ": " + detail : ""));
    }
    const data = await resp.json();
    records = records.concat(data.records || []);
    url = data.nextRecordsUrl ? `${auth.instance_url}${data.nextRecordsUrl}` : null;
  }
  return { records, totalSize: records.length };
}

// ── AI workflow (Anthropic). NOT data. Routed through the local proxy (/api/claude)
// which holds the API key server-side and forwards to the Anthropic Messages API,
// mirroring callSF's transport (no key in the browser, no CORS). Returns { text }.
// Fixtures mode returns a canned sample so the UI is demoable without a key/proxy.
export async function callClaude(prompt, opts = {}) {
  if (MODE === "fixtures") return { text: AI_FIXTURE };
  const resp = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, max_tokens: opts.maxTokens || 2048 }),
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => "");
    throw new Error("AI " + resp.status + (detail ? ": " + detail : ""));
  }
  return resp.json(); // { text }
}

const AI_FIXTURE = JSON.stringify({
  themes: [
    { theme: "Interest in AI use cases", accountCount: 2, summary: "Multiple accounts asking how to apply AI to their workflows." },
    { theme: "Scaling and hours expansion", accountCount: 1, summary: "Accounts growing and looking to add capacity." },
  ],
  risks: [
    { account: "Globex Inc.", note: "Health red, frustrated with response times, budget under review. Exec wants a recovery plan." },
  ],
  sentiment: ["Acme Corp trending positive toward expansion.", "Globex Inc. escalated, churn risk."],
});
