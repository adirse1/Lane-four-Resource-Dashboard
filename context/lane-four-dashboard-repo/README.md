# Lane Four Team Performance Dashboard

Internal dashboard for Managed Services delivery. React single-file artifact that
pulls from Salesforce PSA (FinancialForce) and Google Drive through the Anthropic
API-in-artifacts MCP pattern (no backend server, runs client-side).

`src/Dashboard.jsx` is the whole app. It is the merge of two earlier files
(the working hierarchy/utilization build and the actuals/forecast/audit build),
standardized onto one Salesforce call pattern and one holiday source.

## Running it

This was built to run as a claude.ai React artifact, where the MCP connectors
(Salesforce, Drive) and the `fetch` to `api.anthropic.com` are wired for you.
To run locally in VS Code you need to replace the MCP-backed calls with either
real API credentials or stubbed data. See "Local dev" below.

## Tabs

1. Team hierarchy — drag-drop people into director/pod structure, saved to Drive as hierarchy.json
2. Utilization — billable/credited/vacation hours vs capacity, by director/pod/person
3. Actuals — RPD comparison across two periods, drill All teams > Director > Pod > Account
4. Forecast — month-level revenue projection with vacation coverage (rough multipliers, see bugs)
5. Time detail — raw approved timecard splits for the selected period
6. Data audit — five data-quality checks with CSV export keyed on Record ID for Data Loader
7. Options — CA/US holiday toggles that drive working-day math across every tab

## Data model (do not re-derive)

Revenue and hours come from **`pse__Timecard__c`** (the timecard split, not the header).
Header uses week-start dates and misattributes across month boundaries.

- Revenue field: `Total_Billable_Amount_Formula__c` (CAD). Alt: `CAD_Revenue__c`.
- Standard filters: `pse__Approved__c = true`, `pse__Billable__c = true`.
- Credited flag: `pse__Time_Credited__c = true` (shown separately, NOT in RPD).
- Managed services scope: `Project_Source__c IN ('Managed Services','Post Project Managed Services','Network')`.
- `Project_Type_Master__c` returns null on active projects — do not use it.
- Date filtering: always on `pse__Start_Date__c` with exact calendar month ranges.
- Vacation: project name `'Internal - Vacation Time'` (separate project, not a flag).

Forecast/scheduling from **`pse__Assignment__c`**:
- Scheduled hours: `pse__Scheduled_Hours__c`
- Active filter: `pse__Status__c = 'Scheduled'`, `pse__Is_Billable__c = true`
- Effective rate: `pse__Bill_Rate__c` if > 0, else `pse__Planned_Bill_Rate__c`

Account name matching must be exact Salesforce names. If a query returns zero
unexpectedly, fall back to a LIKE search on the Account object.

## Director / pod structure

- **Aldus Behan** — SF groups: Aldus Behan, Lane Four, Mike Scott. Pods: Michelle Clark, Lindsay Chown, Julie Holm, Josh Wright.
- **Meghan Saunders** — SF groups: Meghan Saunders, Meg Diplock. Pods: Will Shorthouse, Vesna Sorgic, Brandon Wilson, Malcolm McMullin.
- **Tatiane Sensini** — SF group: Tatiane Sensini. No pods (Fiix + MLG, global total only).

Pod = the Project Manager field on the timecard
(`pse__Project__r.pse__Project_Manager__r.Name`). More reliable than Practice for Meghan's team.

## Sanity numbers (April 2026)

- Total revenue: $401,208 CAD
- RPD: ~$19,105
- Working days: 21

If a code change makes these move, something broke. Use them as a regression check.

## Holidays / working days

Holiday calendar lives in the `HOLIDAYS` object (CA + US, 2024–2027). Working-day
math runs client-side off the Options toggles via `getEnabledHols` / `calcWD` /
`calcWDElapsed` / `calcQWD`. Holidays toggled OFF count as working days.

Note: Canada does not observe Easter Monday (only Good Friday). Fiscal year
starts July 1, so quarters are Q1 Jul–Sep, Q2 Oct–Dec, Q3 Jan–Mar, Q4 Apr–Jun.

## Known bugs / rough edges

- Forecast bars use rough multipliers (ceiling = revenue × 1.3, forecast = revenue
  × 0.55), NOT real remaining-assignment math. Numbers are directional only until
  tab 4/5 are rebuilt. This is the biggest correctness gap.
- Drive save confirmation is brittle: any non-error response reads as success, so a
  real Drive failure could show "Saved." Needs a real confirmation check.
- HTML-widget fetch is blocked in this environment; the MCP calls only work from
  inside a JSX artifact (or with real credentials locally).

## Build queue

- **Tab: Resource forecasting grid** — spreadsheet of people × weeks, editable cells,
  save scenarios as JSON to Drive `forecast-scenarios/[name].json`, Excel export via SheetJS.
- **Tab 4 rebuild** — month-level revenue forecast off real remaining assignments,
  with the vacation-coverage AI workflow wired to live data.
- Utilization reloads on every tab switch — add a loaded flag.

## Local dev (VS Code)

The app calls `callClaude` → `fetch("https://api.anthropic.com/v1/messages", ...)`
with `mcp_servers` pointing at the Salesforce and Drive MCP URLs. Two options:

1. **Stub the data.** Replace `callSF` / `callDrive` with functions that return
   saved JSON fixtures. Fastest for UI iteration; no credentials needed.
2. **Wire real MCP.** Configure the Salesforce + Drive MCP servers in your Claude
   Code / local config and supply credentials. Needed for live-data testing
   against the sanity numbers above.

A clean Vite + React setup renders `src/Dashboard.jsx` as the default export.

## Writing rules (for any copy in this UI)

- No em dashes. Commas, periods, parentheses, colons.
- Dynamic labels: "Jun RPD", not "Period A RPD".
- Sentence case on labels and headers.
