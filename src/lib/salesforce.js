// The single choke-point for every Salesforce and Google Drive call.
// Everything routes through callClaude (the Anthropic API-in-artifacts MCP pattern).
// Do NOT reintroduce inline fetch for data anywhere else.
//
// Local dev note: this fetch to api.anthropic.com with mcp_servers works inside a
// claude.ai artifact, where the MCP connectors are wired for you. To run locally
// you either supply real credentials or stub callSF / callDrive with JSON fixtures.

const SF_MCP_URL = "https://api.salesforce.com/platform/mcp/v1/platform/sobject-reads";
const DRIVE_MCP_URL = "https://drivemcp.googleapis.com/mcp/v1";

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

export const callSF = (soql) =>
  callClaude("Execute this SOQL and return ONLY the raw JSON result, no explanation, no markdown:\n\n" + soql, SF_MCP_URL, "sf");

export const callDrive = (prompt) => callClaude(prompt, DRIVE_MCP_URL, "drive");
