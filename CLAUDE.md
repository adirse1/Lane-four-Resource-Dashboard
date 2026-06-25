# Instructions for Claude Code

Modular Vite + React dashboard. Read [README.md](README.md) first — it has the
architecture, the Salesforce data model, the director/pod structure, the April
2026 sanity numbers, known issues, and the build queue. Do not re-derive any of those.

## Structure

- `App.jsx` is a thin shell (global state + tab routing). Logic does not live here.
- One tab = one file in `tabs/` (presentation) + one hook in `hooks/` (its data).
- `lib/` is pure logic, no React. `lib/queries.js` is the ONE source for SOQL.
- Shared UI atoms live in `components/`. Brand/teams/audit constants in `constants/`.

## Rules

- **The data model in README + `lib/queries.js` is authoritative.** Do not change
  SOQL field choices (timecard split vs header, `Total_Billable_Amount_Formula__c`,
  the `SRC` scope) without flagging it. The query tests will fail if you do — that
  is intentional; update the snapshot only with explicit sign-off.
- Every Salesforce call goes through `callSF`, every Drive call through `callDrive`
  ([lib/salesforce.js](src/lib/salesforce.js)). Never reintroduce inline `fetch` for data.
- Holiday/working-day math has one source: the Options `hState` toggles via
  `getEnabledHols` / `calcWD` ([lib/holidays.js](src/lib/holidays.js)). Do not hardcode holidays.
- New SOQL goes in `lib/queries.js` as a builder, never inline in a hook or tab.
- After any change: `npm test` must pass and `npm run build` must succeed. The
  April 2026 numbers ($401,208 / ~$19,105 RPD / 21 days) must still hold.
- When you make several edits in sequence, grep to confirm each applied. Tool
  success messages alone are not proof.

## Environment

- This machine intercepts TLS via a corporate proxy. `npm install` fails with
  `UNABLE_TO_VERIFY_LEAF_SIGNATURE` unless prefixed with `NODE_OPTIONS=--use-system-ca`.
  The dev server and tests do not need it (they don't hit the proxy).

## Writing rules for any UI copy

- No em dashes. Use commas, periods, parentheses, colons.
- Dynamic labels ("Jun RPD" not "Period A RPD"). Sentence case.

## Propose before large rewrites

For anything on the build queue (resource grid, forecast rebuild), outline the
plan and the SOQL you intend to run before writing code, so it can be reviewed.
