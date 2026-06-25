// Single place that decides whether the app uses local sample fixtures or hits
// the live Salesforce proxy.
//
//   npm run dev        -> fixtures (no credentials needed)
//   npm run dev:live   -> live proxy (VITE_USE_FIXTURES=false via .env.live)
//
// Production builds never use fixtures.
export const USE_FIXTURES =
  typeof import.meta !== "undefined" &&
  !!import.meta.env?.DEV &&
  import.meta.env?.VITE_USE_FIXTURES !== "false";
