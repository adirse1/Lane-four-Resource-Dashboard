// Data access. Two modes (see env.js):
//   fixtures  -> local sample data (npm run dev)
//   live      -> POST /api/sf to the local proxy, which reuses your sf CLI auth
//                and forwards SOQL to Salesforce's REST Query API (npm run dev:live)
//
// callClaude is retained for the AI workflow (vacation-coverage / sendPrompt),
// which talks to the Anthropic Messages API. It is NOT used for data anymore.
import { MODE, SF_API_VERSION } from "./env.js";
import { sfFixture } from "./fixtures.js";
import { getAuth } from "./sfAuth.js";

export async function callSF(soql) {
  if (MODE === "fixtures") return sfFixture(soql);
  if (MODE === "oauth") return queryDirect(soql);
  return queryViaProxy(soql);
}

// dev:live — local Node proxy reuses the sf CLI auth.
async function queryViaProxy(soql) {
  const resp = await fetch("/api/sf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ soql }),
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => "");
    throw new Error("SF proxy " + resp.status + (detail ? ": " + detail : ""));
  }
  return resp.json();
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

// ── Anthropic Messages API (for the AI workflow only) ────────────────────────────
export async function callClaude(prompt, mcpUrl, mcpName) {
  const body = { model: "claude-sonnet-4-6", max_tokens: 1000, messages: [{ role: "user", content: prompt }] };
  if (mcpUrl) body.mcp_servers = [{ type: "url", url: mcpUrl, name: mcpName }];
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error("API " + resp.status);
  const data = await resp.json();
  const tr = data.content?.find((b) => b.type === "mcp_tool_result");
  if (tr?.content?.[0]?.text) { try { return JSON.parse(tr.content[0].text); } catch {} return tr.content[0].text; }
  const tx = data.content?.find((b) => b.type === "text");
  if (tx?.text) { const m = tx.text.match(/\{[\s\S]*\}/); if (m) { try { return JSON.parse(m[0]); } catch {} } return tx.text; }
  return null;
}
