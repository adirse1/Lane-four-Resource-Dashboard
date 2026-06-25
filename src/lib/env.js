// Runtime mode + Salesforce config. One place that decides how the app gets data:
//
//   fixtures  npm run dev       local sample data, no credentials
//   proxy     npm run dev:live  local Node proxy (server/proxy.mjs), your sf CLI auth
//   oauth     production build  each viewer logs into Salesforce (PKCE), queries direct
//
// Dev defaults to fixtures; `dev:live` (.env.live sets VITE_USE_FIXTURES=false)
// uses the proxy. Any production build uses browser OAuth.
const DEV = typeof import.meta !== "undefined" && !!import.meta.env?.DEV;
const FIXTURES_OFF = typeof import.meta !== "undefined" && import.meta.env?.VITE_USE_FIXTURES === "false";

export const MODE = DEV ? (FIXTURES_OFF ? "proxy" : "fixtures") : "oauth";
export const USE_FIXTURES = MODE === "fixtures";

// Salesforce OAuth config (used in oauth mode). Set these as Vite env vars at
// build time. SF_LOGIN_URL is the org's My Domain login host; CLIENT_ID is the
// Connected App's consumer key. No client secret (PKCE public client).
export const SF_LOGIN_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_SF_LOGIN_URL) || "https://login.salesforce.com";
export const SF_CLIENT_ID =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_SF_CLIENT_ID) || "";
export const SF_API_VERSION =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_SF_API_VERSION) || "59.0";
