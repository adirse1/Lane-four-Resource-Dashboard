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

// ── Resource planner (pse__Assignment__c -> pse__Schedule__c) ───────────────────
// Forward-looking weekly capacity. The assignment is the parent record; the real
// per-day/per-week committed hours live on the related Schedule (pse__Schedule__c)
// as a weekday pattern (Monday_Hours .. Sunday_Hours) over its own Start/End dates.
// pse__Scheduled_Hours__c on the assignment is a span TOTAL (multi-year spans) and
// is NOT used. Scoped by resource (the person), so a person's commitments on any
// group's project count toward their capacity. Non-aggregate, so no field aliases
// (Salesforce rejects them); the hook flattens the relationship objects and buckets
// the weekday hours into Monday-weeks.
export const resourcePlannerAssignments = (windowStart, windowEnd, resources) =>
  `SELECT pse__Resource__r.Name, pse__Project__r.Name, pse__Project__r.pse__Group__r.Name, pse__Project__r.pse__Project_Manager__r.Name, pse__Schedule__r.pse__Start_Date__c, pse__Schedule__r.pse__End_Date__c, pse__Schedule__r.pse__Monday_Hours__c, pse__Schedule__r.pse__Tuesday_Hours__c, pse__Schedule__r.pse__Wednesday_Hours__c, pse__Schedule__r.pse__Thursday_Hours__c, pse__Schedule__r.pse__Friday_Hours__c, pse__Schedule__r.pse__Saturday_Hours__c, pse__Schedule__r.pse__Sunday_Hours__c, Id FROM pse__Assignment__c WHERE pse__Status__c='Scheduled' AND pse__Is_Billable__c=true AND pse__Schedule__c!=null AND pse__Resource__r.Name IN (${(resources || []).map((r) => `'${String(r).replace(/'/g, "\\'")}'`).join(",")}) AND pse__Schedule__r.pse__End_Date__c>=${windowStart} AND pse__Schedule__r.pse__Start_Date__c<=${windowEnd} ORDER BY pse__Resource__r.Name, pse__Schedule__r.pse__Start_Date__c`;

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
