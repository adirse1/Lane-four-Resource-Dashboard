# Instructions for Claude Code

This repo is a single-file React dashboard: `src/Dashboard.jsx`. Read README.md
first — it has the Salesforce data model, the director/pod structure, the April
2026 sanity numbers, known bugs, and the build queue. Do not re-derive any of those.

## Rules

- The data model in README is authoritative. Do not change SOQL field choices
  (e.g. timecard split vs header, Total_Billable_Amount_Formula__c) without flagging it.
- Every Salesforce call goes through `callSF`; every Drive call through `callDrive`.
  Do not reintroduce inline `fetch` for data.
- Holiday/working-day math has one source: the Options `hState` toggles via
  `getEnabledHols` / `calcWD`. Do not hardcode holidays anywhere.
- When you make more than one edit to Dashboard.jsx in a sequence, grep to confirm
  each change actually applied. Tool success messages alone are not proof.
- After any change, the April 2026 numbers ($401,208 / ~$19,105 RPD / 21 days)
  must still hold. Treat them as a regression check.

## Writing rules for any UI copy

- No em dashes. Use commas, periods, parentheses, colons.
- Dynamic labels ("Jun RPD" not "Period A RPD"). Sentence case.

## Propose before large rewrites

For anything on the build queue (resource grid, forecast rebuild), outline the
plan and the SOQL you intend to run before writing code, so it can be reviewed.
