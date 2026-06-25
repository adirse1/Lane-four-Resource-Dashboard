// Client-side Salesforce OAuth 2.0 with PKCE (public client, no secret).
// Each viewer logs into Salesforce; the access token lives only in this tab's
// sessionStorage and queries run as that user (their SF permissions apply).
//
// Requires a Connected App in the org with PKCE enabled, "Require Secret" OFF,
// and the redirect URI below registered. The page origin must also be on the
// org's CORS allowlist. See DEPLOY.md.
import { SF_LOGIN_URL, SF_CLIENT_ID } from "./env.js";

const STORE_KEY = "lf_sf_auth";       // { access_token, instance_url }
const VERIFIER_KEY = "lf_sf_pkce";    // transient PKCE code_verifier

// Redirect URI = this app's own origin + base path (must match the Connected App).
function redirectUri() {
  const base = (typeof import.meta !== "undefined" && import.meta.env?.BASE_URL) || "/";
  return window.location.origin + base;
}

function base64url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomVerifier() {
  const a = new Uint8Array(32);
  crypto.getRandomValues(a);
  return base64url(a);
}

async function challengeFrom(verifier) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

// Kick off login: stash a PKCE verifier and redirect to Salesforce.
export async function login() {
  const verifier = randomVerifier();
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  const challenge = await challengeFrom(verifier);
  const params = new URLSearchParams({
    response_type: "code",
    client_id: SF_CLIENT_ID,
    redirect_uri: redirectUri(),
    code_challenge: challenge,
    code_challenge_method: "S256",
    scope: "api refresh_token",
  });
  window.location.assign(`${SF_LOGIN_URL}/services/oauth2/authorize?${params}`);
}

// On return from Salesforce, exchange ?code=... for a token. Returns true if a
// redirect was handled (so the caller can re-render as authenticated).
export async function handleRedirect() {
  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");
  if (!code) return false;
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: SF_CLIENT_ID,
    redirect_uri: redirectUri(),
    code_verifier: verifier || "",
  });
  const resp = await fetch(`${SF_LOGIN_URL}/services/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  sessionStorage.removeItem(VERIFIER_KEY);
  // Clean the code/state out of the URL regardless of outcome.
  window.history.replaceState({}, document.title, redirectUri());
  if (!resp.ok) {
    let detail = "";
    try { const e = await resp.json(); detail = e.error_description || e.error || JSON.stringify(e); }
    catch { detail = await resp.text().catch(() => ""); }
    throw new Error("Token exchange failed (" + resp.status + ")" + (detail ? ": " + detail : ""));
  }
  const tok = await resp.json();
  sessionStorage.setItem(STORE_KEY, JSON.stringify({ access_token: tok.access_token, instance_url: tok.instance_url }));
  return true;
}

export function getAuth() {
  try { return JSON.parse(sessionStorage.getItem(STORE_KEY)); } catch { return null; }
}

export function isAuthed() {
  return !!getAuth()?.access_token;
}

export function logout() {
  sessionStorage.removeItem(STORE_KEY);
}
