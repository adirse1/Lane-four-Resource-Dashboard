# Lane Four Team Performance Dashboard

Internal dashboard for Managed Services delivery. Pulls from Salesforce PSA
(FinancialForce) and Google Drive through the Anthropic API-in-artifacts MCP
pattern, and runs client-side (no backend server).

Originally a single-file React artifact, now a modular Vite + React app. The
frozen pre-refactor original lives in
[context/lane-four-dashboard-repo/](context/lane-four-dashboard-repo/) for reference.

## Run it

```bash
npm install      # one-time. On this machine, prefix: NODE_OPTIONS=--use-system-ca npm install
npm run dev      # dev server at :5173 with SAMPLE FIXTURES (no credentials)
npm run build    # production build to dist/
npm test         # query + working-day regression tests (Node built-in runner)
```

### Live Salesforce data (local)

Two processes, two terminals:

```bash
npm run proxy    # terminal 1: SF proxy on :8787, reuses your sf CLI auth
npm run dev:live # terminal 2: dev server on :5173, fixtures OFF
```

- The proxy ([server/proxy.mjs](server/proxy.mjs)) mints an access token from the
  `sf` CLI and forwards SOQL to Salesforce's REST Query API. No Anthropic key, no
  token cost. `GET http://localhost:8787/api/health` verifies the connection.
- It targets the org named in `server/.sforg` (gitignored) or the `SF_ORG` env var,
  else your sf default org. The Lane Four PSA org is `lf-prod`.
- The team hierarchy persists to `server/data/hierarchy.json` (gitignored).
- `npm run dev` (fixtures) needs no proxy and no credentials — best for UI work.

Data access lives behind `callSF` in [src/lib/salesforce.js](src/lib/salesforce.js);
fixtures vs live is decided in [src/lib/env.js](src/lib/env.js).

## Architecture

```
src/
├── App.jsx          Shell: global state (tab, mode, periods, holidays) + routing
├── constants/       brand.js (colors/fonts), teams.js (directors/pods), auditDefs.js
├── lib/             Pure logic, no React:
│                      salesforce.js  the ONE data choke-point (callSF/callDrive)
│                      queries.js     every SOQL string, in one place
│                      holidays.js    holiday calendar + working-day math
│                      period.js      periodRange, groupTotal
│                      hierarchy.js   buildSeed, getAssigned
│                      format.js      $ / % / hours formatters, avatars
├── components/      Shared UI atoms (Pill, Tag, Spinner, HelpIcon, Chip, …)
├── hooks/           Data "controllers": useHierarchy, useUtilization,
│                      usePeriodData (shared by Actuals/Forecast/Detail), useAudit
└── tabs/            One presentational component per tab
```

The pattern: a **tab** renders; a **hook** owns its data; **lib/** holds pure
logic; **lib/queries.js** is the single source for SOQL. To add a feature: drop a
file in `tabs/`, a hook in `hooks/`, and one line in `App.jsx`.

## Tabs

1. **Team hierarchy** — drag-drop people into director/pod structure, saved to Drive as `hierarchy.json`
2. **Utilization** — billable/credited/vacation hours vs capacity, by director/pod/person
3. **Actuals** — RPD comparison across two periods, drill All teams > Director > Pod > Account
4. **Forecast** — month-level revenue projection with vacation coverage (rough multipliers, see Known issues)
5. **Time detail** — raw approved timecard splits for the selected period
6. **Data audit** — five data-quality checks with CSV export keyed on Record ID for Data Loader
7. **Options** — CA/US holiday toggles that drive working-day math across every tab

## Data model (authoritative — see [src/lib/queries.js](src/lib/queries.js))

Revenue and hours come from **`pse__Timecard__c`** (the split, not the header).

- Revenue field: `Total_Billable_Amount_Formula__c` (CAD). Alt: `CAD_Revenue__c`.
- Standard filters: `pse__Approved__c = true`, `pse__Billable__c = true`.
- Credited flag: `pse__Time_Credited__c = true` (shown separately, NOT in RPD).
- Managed services scope: `Project_Source__c IN ('Managed Services','Post Project Managed Services','Network')`.
- `Project_Type_Master__c` returns null on active projects — do not use it.
- Date filtering: always on `pse__Start_Date__c` with exact calendar month ranges.
- Vacation: project name `'Internal - Vacation Time'` (separate project, not a flag).

Forecast/scheduling from **`pse__Assignment__c`**: scheduled hours
`pse__Scheduled_Hours__c`; active filter `pse__Status__c = 'Scheduled'` +
`pse__Is_Billable__c = true`; effective rate `pse__Bill_Rate__c` if > 0 else
`pse__Planned_Bill_Rate__c`.

### Director / pod structure ([src/constants/teams.js](src/constants/teams.js))

- **Aldus Behan** — SF groups: Aldus Behan, Lane Four, Mike Scott. Pods: Michelle Clark, Lindsay Chown, Julie Holm, Josh Wright.
- **Meghan Saunders** — SF groups: Meghan Saunders, Meg Diplock. Pods: Will Shorthouse, Vesna Sorgic, Brandon Wilson, Malcolm McMullin.
- **Tatiane Sensini** — SF group: Tatiane Sensini. No pods (Fiix + MLG, global total only).

Pod = the Project Manager field on the timecard
(`pse__Project__r.pse__Project_Manager__r.Name`). More reliable than Practice for Meghan's team.

## Sanity numbers (April 2026)

- Working days: 21 (CA) — calendar math, a true invariant. Pinned in
  [tests/holidays.test.js](tests/holidays.test.js).
- Revenue / RPD: the README originally cited $401,208 / ~$19,105 as a point-in-time
  snapshot. Against live `lf-prod` data (April now fully closed and approved) the
  figure is higher (~$502k as of 2026-06). Treat the dollar figures as a snapshot,
  NOT a fixed regression anchor — only the working-day count is invariant. The SOQL
  itself is regression-tested byte-for-byte in [tests/queries.test.js](tests/queries.test.js).

Holidays toggled OFF count as working days. Fiscal year starts July 1
(Q1 Jul–Sep … Q4 Apr–Jun). Canada observes Good Friday but not Easter Monday.

## Tests

`npm test` runs the Node built-in test runner over `tests/`:

- **queries.test.js** — asserts every SOQL builder is byte-identical to the
  pre-refactor original. Any drift in the data model fails the suite.
- **holidays.test.js** — pins April 2026 = 21 CA working days and the Good
  Friday / Easter Monday rules.

These run with no credentials and no extra dependencies. Live-data testing (against
the sanity numbers above) requires the MCP connectors.

## Known issues / rough edges

- **Forecast bars use rough multipliers** (ceiling = revenue × 1.3, forecast =
  revenue × 0.55), NOT real remaining-assignment math. Directional only until the
  tab is rebuilt off `pse__Assignment__c`. Biggest correctness gap.
- **`sendPrompt` is not wired.** The Forecast "Find coverage" button was an
  undefined global in the original; it is now a prop with a safe no-op default in
  [src/App.jsx](src/App.jsx). Wire it when the vacation-coverage workflow is rebuilt.
- **Drive save confirmation is brittle** — any non-error response reads as success.
- **Utilization reloads on every tab switch** — the tab remounts; add a loaded flag.

## Build queue

- **Resource forecasting grid** — spreadsheet of people × weeks, editable cells, save
  scenarios as JSON to Drive `forecast-scenarios/[name].json`, Excel export via SheetJS.
- **Forecast rebuild** — month-level revenue off real remaining assignments, with the
  vacation-coverage workflow wired to live data.
- **Utilization loaded flag** — stop reloading on every tab switch.

## Writing rules (any UI copy)

- No em dashes. Use commas, periods, parentheses, colons.
- Dynamic labels: "Jun RPD", not "Period A RPD".
- Sentence case on labels and headers.
