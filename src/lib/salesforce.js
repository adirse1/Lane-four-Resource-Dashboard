// Data access. Two modes (see env.js):
//   fixtures  -> local sample data (npm run dev)
//   live      -> POST /api/sf to the local proxy, which reuses your sf CLI auth
//                and forwards SOQL to Salesforce's REST Query API (npm run dev:live)
//
// callClaude is retained for the AI workflow (vacation-coverage / sendPrompt),
// which talks to the Anthropic Messages API. It is NOT used for data anymore.
import { USE_FIXTURES } from "./env.js";
import { sfFixture } from "./fixtures.js";

export async function callSF(soql) {
  if (USE_FIXTURES) return sfFixture(soql);
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
