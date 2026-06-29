// ─────────────────────────────────────────────────────────────────────────────
// THE single source of truth for every SOQL query in the dashboard.
//
// Data model rules (from README, authoritative — do not change field choices
// without flagging):
//   - Revenue + hours come from pse__Timecard__c (the split, NOT the header).
//   - Revenue field: Total_Billable_Amount_Formula__c (CAD).
//   - Standard filters: pse__Approved__c = true, pse__Billable__c = true.
//   - Credited time (pse__Time_Credited__c = true) is shown separately, NOT in RPD.
//   - Managed services scope = Project_Source__c IN SRC (below).
//   - Date filtering: always on pse__Start_Date__c with exact calendar-month ranges.
//   - Vacation = project name 'Internal - Vacation Time' (a project, not a flag).
//   - Forecast/scheduling come from pse__Assignment__c.
//
// Regression check: April 2026 must hold at $401,208 revenue / ~$19,105 RPD / 21
// working days. If a query edit moves those, something broke.
// ─────────────────────────────────────────────────────────────────────────────

// Managed services project scope. Used by nearly every query.
export const SRC = `('Managed Services','Post Project Managed Services','Network')`;

// Standard approved + billable + in-scope filter for timecard revenue queries.
export const BASE = `pse__Approved__c = true AND pse__Billable__c = true AND Project_Source__c IN ${SRC}`;

// Vacation is its own project, not a flag.
export const VACATION_PROJECT = "Internal - Vacation Time";

// ── Hierarchy (pse__Assignment__c) ──────────────────────────────────────────────
// People grouped by SF group + project manager, for building the org tree.
// minEndDate floors to assignments still active on/after this date.
export const hierarchyAssignments = (minEndDate = "2026-04-01") =>
  `SELECT pse__Resource__r.Name resource, pse__Project__r.pse__Group__r.Name grp, pse__Project__r.pse__Project_Manager__r.Name pm, COUNT(Id) cnt FROM pse__Assignment__c WHERE pse__Is_Billable__c=true AND pse__Status__c='Scheduled' AND pse__Project__r.Project_Source__c IN ${SRC} AND pse__End_Date__c>=${minEndDate} GROUP BY pse__Resource__r.Name,pse__Project__r.pse__Group__r.Name,pse__Project__r.pse__Project_Manager__r.Name ORDER BY pse__Project__r.pse__Group__r.Name,pse__Resource__r.Name`;

// ── Scheduled assignments (pse__Assignment__c) ─ shared by the resource planner
// and the forecast tab. Forward-looking committed hours per assignment (= per
// project) for each person. Committed hours = pse__Scheduled_Hours__c (the span
// total) distributed across the working days in the assignment's span [Start_Date,
// End_Date]; consumers bucket it into weeks (planner) or 30/60/90-day segments
// (forecast). The related Schedule's weekday pattern is a 40h default in this org
// and does NOT reflect the real allocation, so it is not used. Scoped by resource
// so a person's commitments on any group's project count toward their capacity.
// Non-aggregate, so no field aliases; the hook flattens the rows.
//
// opts.includeNonBillable: drop the billable-only filter and also select
// pse__Is_Billable__c, so a consumer can split committed time into billable vs
// non-billable vs vacation (vacation = the VACATION_PROJECT, a non-billable
// project). The planner calls this with no opts and stays billable-only; the
// forecast passes includeNonBillable to get every scheduled commitment. There is
// no forward equivalent of credited time (pse__Time_Credited__c is a post-hoc
// timecard concept), so nothing here selects or segments on it.
export const scheduledAssignments = (windowStart, windowEnd, resources, opts = {}) => {
  const billableField = opts.includeNonBillable ? ", pse__Is_Billable__c" : "";
  const billableFilter = opts.includeNonBillable ? "" : " AND pse__Is_Billable__c=true";
  return `SELECT pse__Resource__r.Name, pse__Project__r.Name, pse__Project__r.pse__Group__r.Name, pse__Project__r.pse__Project_Manager__r.Name, pse__Start_Date__c, pse__End_Date__c, pse__Scheduled_Hours__c, Id${billableField} FROM pse__Assignment__c WHERE pse__Status__c='Scheduled'${billableFilter} AND pse__Resource__r.Name IN (${(resources || []).map((r) => `'${String(r).replace(/'/g, "\\'")}'`).join(",")}) AND pse__End_Date__c>=${windowStart} AND pse__Start_Date__c<=${windowEnd} ORDER BY pse__Resource__r.Name, pse__Project__r.Name`;
};

// ── Time report builder (pse__Timecard__c) ─ the dynamic report tab ─────────────
// A read-only, user-configured report over timecard splits. The user picks a
// month, a group-by, and which fields show as columns; this turns those choices
// into one SELECT. It is intentionally separate from the byte-for-byte-tested
// builders above so their snapshots never move.
//
// Safety properties (see the tab/hook): SELECT only (no DML path anywhere), the
// month filter and the Aldus/Meghan PM scope are always applied and not
// removable, a row cap bounds the pull, and the field names come from a describe
// allowlist (validated upstream), so user choices cannot inject arbitrary SOQL.

// Always in the SELECT regardless of which columns the user shows: the group keys
// (director/pod derive from the PM name via constants/teams.js) and the record Id.
export const REPORT_REQUIRED_FIELDS = [
  "Id",
  "pse__Resource__r.Name",
  "pse__Project__r.Name",
  "pse__Project__r.pse__Project_Manager__r.Name",
];

// Curated relationship columns offered alongside the object's own describe fields.
// Their traversal paths are known here so the picker can offer them without
// describing every related object. Deeper traversal is a later enhancement.
export const REPORT_RELATION_FIELDS = [
  { name: "pse__Resource__r.Name", label: "Resource", type: "string" },
  { name: "pse__Project__r.Name", label: "Project", type: "string" },
  { name: "pse__Project__r.pse__Account__r.Name", label: "Account", type: "string" },
  { name: "pse__Project__r.pse__Group__r.Name", label: "Group", type: "string" },
  { name: "pse__Project__r.pse__Project_Manager__r.Name", label: "Project manager", type: "string" },
];

// Bounds a runaway pull without truncating a normal month: one month for the
// in-scope pods runs a few thousand splits (April 2026 = 3,386), so 10k leaves
// headroom while still capping far below the full object. The proxy paginates.
export const REPORT_ROW_CAP = 10000;

// fields = ordered display field API names (validated against describe upstream).
// The required group/scope fields are merged in and de-duplicated. pmNames bounds
// the pull to the in-scope pods (which also excludes out-of-scope groups). Builder
// is non-aggregate, so it never aliases; the hook reads relationship objects.
export const buildTimecardReport = ({ fields, monthStart, monthEnd, pmNames, orderBy, limit }) => {
  const sel = [...new Set([...REPORT_REQUIRED_FIELDS, ...(fields || [])])];
  const pmList = (pmNames || []).map((n) => `'${String(n).replace(/'/g, "\\'")}'`).join(",");
  const order = orderBy ? ` ORDER BY ${orderBy}` : "";
  const cap = Number(limit) > 0 ? Number(limit) : REPORT_ROW_CAP;
  return `SELECT ${sel.join(", ")} FROM pse__Timecard__c WHERE pse__Approved__c = true AND pse__Project__r.pse__Project_Manager__r.Name IN (${pmList}) AND pse__Start_Date__c >= ${monthStart} AND pse__Start_Date__c <= ${monthEnd}${order} LIMIT ${cap}`;
};

// ── Utilization (pse__Timecard__c), by resource for a single month ──────────────
// SCOPE NOTE: utilization intentionally does NOT use the managed-services
// Project_Source__c filter that the revenue tabs (Actuals/Forecast/RPD) use.
// Utilization answers "is this person busy?", so it counts all approved billable
// hours on any real client project (excluding Internal/vacation), regardless of
// the project's source tag or owning group. Project_Source__c is a formula that
// is null on many in-scope projects, which falsely zeroed people who did billable
// work on cross-group or untagged projects. Keyed off the project, not the source.
export const utilizationBillable = (ms, me) =>
  `SELECT pse__Resource__r.Name resource,pse__Project__r.pse__Group__r.Name grp,pse__Project__r.pse__Project_Manager__r.Name pm,SUM(pse__Total_Hours__c) hours,SUM(Total_Billable_Amount_Formula__c) revenue FROM pse__Timecard__c WHERE pse__Approved__c=true AND pse__Billable__c=true AND (NOT pse__Project__r.Name LIKE 'Internal%') AND pse__Start_Date__c>=${ms} AND pse__Start_Date__c<=${me} GROUP BY pse__Resource__r.Name,pse__Project__r.pse__Group__r.Name,pse__Project__r.pse__Project_Manager__r.Name`;

export const utilizationVacation = (ms, me) =>
  `SELECT pse__Resource__r.Name resource,SUM(pse__Total_Hours__c) hours FROM pse__Timecard__c WHERE pse__Approved__c=true AND pse__Project__r.Name='${VACATION_PROJECT}' AND pse__Start_Date__c>=${ms} AND pse__Start_Date__c<=${me} GROUP BY pse__Resource__r.Name`;

export const utilizationCredited = (ms, me) =>
  `SELECT pse__Resource__r.Name resource,SUM(pse__Total_Hours__c) hours FROM pse__Timecard__c WHERE pse__Approved__c=true AND pse__Time_Credited__c=true AND (NOT pse__Project__r.Name LIKE 'Internal%') AND pse__Start_Date__c>=${ms} AND pse__Start_Date__c<=${me} GROUP BY pse__Resource__r.Name`;

// Per-person audit drill-down: every approved timecard split for one resource in
// the month, so a utilization number can be reconciled line-by-line against
// Salesforce. Non-aggregate (no field aliases allowed alongside relationship
// fields); the hook reads the nested relationship objects. Id is the timecard
// split record so rows can be found directly in SF reports.
export const utilizationPersonDetail = (resource, ms, me) =>
  `SELECT pse__Project__r.Name, pse__Project__r.pse__Account__r.Name, pse__Project__r.pse__Group__r.Name, pse__Project__r.pse__Project_Manager__r.Name, Project_Source__c, pse__Billable__c, pse__Time_Credited__c, pse__Total_Hours__c, Total_Billable_Amount_Formula__c, pse__Start_Date__c, Id FROM pse__Timecard__c WHERE pse__Approved__c=true AND pse__Resource__r.Name='${resource.replace(/'/g, "\\'")}' AND pse__Start_Date__c>=${ms} AND pse__Start_Date__c<=${me} ORDER BY pse__Project__r.Name, pse__Start_Date__c LIMIT 1000`;

// ── Account management / QBRs (Scheduled_Business_Review__c + Opportunity) ────────
// WHOLE COMPANY: no directorate / Project_Source scope here. Quarter bounds use the
// review held-date (Date__c) and opportunity dates. No direct opp<->QBR link is
// reliable (SBR.Opportunity__c is ~5% populated, Opportunity has no SBR lookup), so
// the QBR-to-opp association is inferred in the hook (same account, opp created in
// the quarter on/after the review date).
// Includes the free-text note fields (summary + outcomes + health) so the same
// pull feeds the metrics table, the per-review source-notes view, and the on-demand
// AI synthesis. Non-aggregate, so no field aliases; long-text fields are select-only.
export const sbrNotesInQuarter = (start, end) =>
  `SELECT Name, Account__c, Account__r.Name, Date__c, Status__c, SBR_Outcome__c, Client_Temperature__c, X3_Month_Forecast__c, Account_Manager__r.Name, Summary__c, SBR_Outcome_Notes__c, Health_Summary__c, AM_Growth_Notes__c FROM Scheduled_Business_Review__c WHERE Date__c >= ${start} AND Date__c <= ${end} ORDER BY Date__c DESC LIMIT 2000`;

// Pipeline generated: opportunities created in the quarter (count + amount).
export const oppsCreatedInQuarter = (start, end) =>
  `SELECT COUNT(Id) cnt, SUM(Amount) amount FROM Opportunity WHERE DAY_ONLY(CreatedDate) >= ${start} AND DAY_ONLY(CreatedDate) <= ${end}`;

// Opportunities closed in the quarter, split won vs lost (for closed-won $, win rate, avg deal).
export const oppsClosedInQuarter = (start, end) =>
  `SELECT IsWon won, COUNT(Id) cnt, SUM(Amount) amount FROM Opportunity WHERE IsClosed = true AND CloseDate >= ${start} AND CloseDate <= ${end} GROUP BY IsWon`;

// Per-opportunity detail for opps created in the quarter, for the inferred
// QBR-to-opp match in the hook. Non-aggregate, so no field aliases.
export const oppsCreatedDetail = (start, end) =>
  `SELECT AccountId, Amount, IsWon, CreatedDate FROM Opportunity WHERE DAY_ONLY(CreatedDate) >= ${start} AND DAY_ONLY(CreatedDate) <= ${end} ORDER BY AccountId LIMIT 5000`;

// ── Period actuals (pse__Timecard__c), for Actuals / Forecast / Time detail ──────
export const periodByPM = (start, end) =>
  `SELECT pse__Project__r.pse__Group__r.Name grp, pse__Project__r.pse__Project_Manager__r.Name pm, SUM(Total_Billable_Amount_Formula__c) revenue, SUM(pse__Total_Hours__c) hours, COUNT(Id) splits FROM pse__Timecard__c WHERE ${BASE} AND pse__Start_Date__c >= ${start} AND pse__Start_Date__c <= ${end} GROUP BY pse__Project__r.pse__Group__r.Name, pse__Project__r.pse__Project_Manager__r.Name ORDER BY pse__Project__r.pse__Group__r.Name`;

// NOTE: diverges from the original artifact query. The original selected
// MAX(pse__Time_Credited__c), but Salesforce rejects aggregate operators on a
// checkbox field (MALFORMED_QUERY against the live REST API). The project-level
// "credited" tag was cosmetic (not used in revenue/RPD math), so it's dropped.
export const periodByProject = (start, end) =>
  `SELECT pse__Project__r.Name proj, pse__Project__r.pse__Account__r.Name acct, pse__Project__r.pse__Group__r.Name grp, pse__Project__r.pse__Project_Manager__r.Name pm, pse__Project__c projId, SUM(Total_Billable_Amount_Formula__c) revenue, SUM(pse__Total_Hours__c) hours FROM pse__Timecard__c WHERE ${BASE} AND pse__Start_Date__c >= ${start} AND pse__Start_Date__c <= ${end} GROUP BY pse__Project__r.Name, pse__Project__r.pse__Account__r.Name, pse__Project__r.pse__Group__r.Name, pse__Project__r.pse__Project_Manager__r.Name, pse__Project__c ORDER BY SUM(Total_Billable_Amount_Formula__c) DESC`;

export const periodCredited = (start, end) =>
  `SELECT pse__Project__r.pse__Group__r.Name grp, pse__Project__r.pse__Project_Manager__r.Name pm, SUM(pse__Total_Hours__c) hours FROM pse__Timecard__c WHERE pse__Approved__c = true AND pse__Time_Credited__c = true AND Project_Source__c IN ${SRC} AND pse__Start_Date__c >= ${start} AND pse__Start_Date__c <= ${end} GROUP BY pse__Project__r.pse__Group__r.Name, pse__Project__r.pse__Project_Manager__r.Name`;

// Credited hours grouped by project, so credited can be shown at the account level
// (periodCredited only groups by group + PM). Same documented filter
// (pse__Time_Credited__c = true), just GROUP BY the project; not in RPD.
export const periodCreditedByProject = (start, end) =>
  `SELECT pse__Project__c projId, SUM(pse__Total_Hours__c) hours FROM pse__Timecard__c WHERE pse__Approved__c = true AND pse__Time_Credited__c = true AND Project_Source__c IN ${SRC} AND pse__Start_Date__c >= ${start} AND pse__Start_Date__c <= ${end} GROUP BY pse__Project__c`;

export const periodVacation = (start, end) =>
  `SELECT pse__Resource__r.Name resource, pse__Project__r.pse__Group__r.Name grp, pse__Project__r.pse__Project_Manager__r.Name pm, SUM(pse__Total_Hours__c) hours FROM pse__Timecard__c WHERE pse__Approved__c = true AND pse__Project__r.Name = '${VACATION_PROJECT}' AND pse__Start_Date__c >= ${start} AND pse__Start_Date__c <= ${end} GROUP BY pse__Resource__r.Name, pse__Project__r.pse__Group__r.Name, pse__Project__r.pse__Project_Manager__r.Name`;

// NOTE: diverges from the original artifact query. The original aliased every
// selected field (resource, proj, hours, ...), but Salesforce rejects field
// aliasing on a non-aggregate query (MALFORMED_QUERY: "only aggregate expressions
// use field aliasing") — so it could never run live. Aliases removed; the
// consuming hook (usePeriodData.fetchDetail) flattens the relationship objects
// back to the friendly keys the Time detail tab expects. Same fields, same scope.
export const periodDetail = (start, end) =>
  `SELECT pse__Resource__r.Name, pse__Project__r.Name, pse__Project__r.pse__Account__r.Name, pse__Project__r.pse__Group__r.Name, pse__Project__r.pse__Project_Manager__r.Name, pse__Total_Hours__c, Total_Billable_Amount_Formula__c, pse__Billable__c, pse__Time_Credited__c, pse__Start_Date__c, Project_Source__c, Id FROM pse__Timecard__c WHERE pse__Approved__c = true AND pse__Start_Date__c >= ${start} AND pse__Start_Date__c <= ${end} AND (Project_Source__c IN ${SRC} OR pse__Project__r.Name = '${VACATION_PROJECT}') ORDER BY pse__Start_Date__c DESC LIMIT 200`;

// ── Data audit (five data-quality checks) ───────────────────────────────────────
export const auditZeroRates = () =>
  `SELECT Id, Name, pse__Resource__r.Name resource, pse__Project__r.Name proj, pse__Project__r.pse__Group__r.Name grp, pse__Bill_Rate__c billRate, pse__Planned_Bill_Rate__c plannedRate, pse__Status__c status FROM pse__Assignment__c WHERE pse__Is_Billable__c = true AND pse__Status__c = 'Scheduled' AND pse__Bill_Rate__c = 0 AND pse__Planned_Bill_Rate__c = 0 AND pse__Project__r.Project_Source__c IN ${SRC} LIMIT 50`;

export const auditZeroRevSplits = (since = "2026-01-01") =>
  `SELECT Id, Name, pse__Resource__r.Name resource, pse__Project__r.Name proj, pse__Project__r.pse__Group__r.Name grp, pse__Total_Hours__c hours, Total_Billable_Amount_Formula__c revenue, pse__Start_Date__c startDate FROM pse__Timecard__c WHERE pse__Approved__c = true AND pse__Billable__c = true AND Total_Billable_Amount_Formula__c = 0 AND pse__Total_Hours__c > 0 AND Project_Source__c IN ${SRC} AND pse__Start_Date__c >= ${since} LIMIT 50`;

export const auditNullSrc = () =>
  `SELECT Id, Name, pse__Account__r.Name acct, pse__Group__r.Name grp, pse__Project_Manager__r.Name pm, Project_Source__c src, pse__Stage__c stage FROM pse__Proj__c WHERE Project_Source__c = null AND pse__Stage__c NOT IN ('Closed','Cancelled','Lost') AND pse__Group__r.Name IN ('Aldus Behan','Meghan Saunders','Tatiane Sensini') LIMIT 50`;

export const auditFormulaDrift = (since = "2026-01-01") =>
  `SELECT Id, Name, pse__Resource__r.Name resource, pse__Project__r.Name proj, CAD_Revenue__c cadRevenue, Total_Billable_Amount_Formula__c formulaRevenue, pse__Start_Date__c startDate FROM pse__Timecard__c WHERE pse__Approved__c = true AND pse__Billable__c = true AND CAD_Revenue__c != Total_Billable_Amount_Formula__c AND Total_Billable_Amount_Formula__c > 0 AND Project_Source__c IN ${SRC} AND pse__Start_Date__c >= ${since} LIMIT 50`;

export const auditZeroSchedHrs = (minEndDate = "2026-01-01") =>
  `SELECT Id, Name, pse__Resource__r.Name resource, pse__Project__r.Name proj, pse__Project__r.pse__Group__r.Name grp, pse__Scheduled_Hours__c scheduledHours, pse__Start_Date__c startDate, pse__End_Date__c endDate FROM pse__Assignment__c WHERE pse__Is_Billable__c = true AND pse__Status__c = 'Scheduled' AND pse__Scheduled_Hours__c = 0 AND pse__Project__r.Project_Source__c IN ${SRC} AND pse__End_Date__c >= ${minEndDate} LIMIT 50`;
