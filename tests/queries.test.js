// Regression guard on SOQL. Each builder must produce byte-identical output to
// the original inline strings from the pre-refactor Dashboard.jsx. The data model
// is authoritative (see lib/queries.js); these snapshots make any drift a test
// failure rather than a silent revenue miscalculation.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as Q from "../src/lib/queries.js";

const SRC = `('Managed Services','Post Project Managed Services','Network')`;
const BASE = `pse__Approved__c = true AND pse__Billable__c = true AND Project_Source__c IN ${SRC}`;
const ms = "2026-04-01", me = "2026-04-30";
const start = "2026-04-01", end = "2026-04-30";

const cases = {
  hierarchyAssignments: [
    Q.hierarchyAssignments(),
    `SELECT pse__Resource__r.Name resource, pse__Project__r.pse__Group__r.Name grp, pse__Project__r.pse__Project_Manager__r.Name pm, COUNT(Id) cnt FROM pse__Assignment__c WHERE pse__Is_Billable__c=true AND pse__Status__c='Scheduled' AND pse__Project__r.Project_Source__c IN ('Managed Services','Post Project Managed Services','Network') AND pse__End_Date__c>=2026-04-01 GROUP BY pse__Resource__r.Name,pse__Project__r.pse__Group__r.Name,pse__Project__r.pse__Project_Manager__r.Name ORDER BY pse__Project__r.pse__Group__r.Name,pse__Resource__r.Name`,
  ],
  // Intentionally diverges from the original: utilization dropped the
  // Project_Source__c IN SRC scope in favor of "all billable client work"
  // (exclude Internal/vacation), because the source formula was null on many
  // in-scope projects and falsely zeroed people. Signed off; see queries.js.
  utilizationBillable: [
    Q.utilizationBillable(ms, me),
    `SELECT pse__Resource__r.Name resource,pse__Project__r.pse__Group__r.Name grp,pse__Project__r.pse__Project_Manager__r.Name pm,SUM(pse__Total_Hours__c) hours,SUM(Total_Billable_Amount_Formula__c) revenue FROM pse__Timecard__c WHERE pse__Approved__c=true AND pse__Billable__c=true AND (NOT pse__Project__r.Name LIKE 'Internal%') AND pse__Start_Date__c>=${ms} AND pse__Start_Date__c<=${me} GROUP BY pse__Resource__r.Name,pse__Project__r.pse__Group__r.Name,pse__Project__r.pse__Project_Manager__r.Name`,
  ],
  utilizationVacation: [
    Q.utilizationVacation(ms, me),
    `SELECT pse__Resource__r.Name resource,SUM(pse__Total_Hours__c) hours FROM pse__Timecard__c WHERE pse__Approved__c=true AND pse__Project__r.Name='Internal - Vacation Time' AND pse__Start_Date__c>=${ms} AND pse__Start_Date__c<=${me} GROUP BY pse__Resource__r.Name`,
  ],
  // Diverges from the original for the same reason as utilizationBillable.
  utilizationCredited: [
    Q.utilizationCredited(ms, me),
    `SELECT pse__Resource__r.Name resource,SUM(pse__Total_Hours__c) hours FROM pse__Timecard__c WHERE pse__Approved__c=true AND pse__Time_Credited__c=true AND (NOT pse__Project__r.Name LIKE 'Internal%') AND pse__Start_Date__c>=${ms} AND pse__Start_Date__c<=${me} GROUP BY pse__Resource__r.Name`,
  ],
  // New: per-person audit drill-down (non-aggregate, escapes quotes in the name).
  utilizationPersonDetail: [
    Q.utilizationPersonDetail("Jordan Roylance", ms, me),
    `SELECT pse__Project__r.Name, pse__Project__r.pse__Account__r.Name, pse__Project__r.pse__Group__r.Name, pse__Project__r.pse__Project_Manager__r.Name, Project_Source__c, pse__Billable__c, pse__Time_Credited__c, pse__Total_Hours__c, Total_Billable_Amount_Formula__c, pse__Start_Date__c, Id FROM pse__Timecard__c WHERE pse__Approved__c=true AND pse__Resource__r.Name='Jordan Roylance' AND pse__Start_Date__c>=${ms} AND pse__Start_Date__c<=${me} ORDER BY pse__Project__r.Name, pse__Start_Date__c LIMIT 1000`,
  ],
  // Resource planner: assignments scoped by resource, scheduled hours distributed
  // by the hook. Non-aggregate, no field aliases; resource list escaped + joined.
  scheduledAssignments: [
    Q.scheduledAssignments("2026-06-22", "2026-10-12", ["Jordan Roylance", "Will Shorthouse"]),
    `SELECT pse__Resource__r.Name, pse__Project__r.Name, pse__Project__r.pse__Group__r.Name, pse__Project__r.pse__Project_Manager__r.Name, pse__Start_Date__c, pse__End_Date__c, pse__Scheduled_Hours__c, Id FROM pse__Assignment__c WHERE pse__Status__c='Scheduled' AND pse__Is_Billable__c=true AND pse__Resource__r.Name IN ('Jordan Roylance','Will Shorthouse') AND pse__End_Date__c>=2026-06-22 AND pse__Start_Date__c<=2026-10-12 ORDER BY pse__Resource__r.Name, pse__Project__r.Name`,
  ],
  // Forecast variant: drops the billable-only filter and adds pse__Is_Billable__c
  // so committed time can be split into billable / non-billable / vacation.
  scheduledAssignmentsAll: [
    Q.scheduledAssignments("2026-06-22", "2026-10-12", ["Jordan Roylance", "Will Shorthouse"], { includeNonBillable: true }),
    `SELECT pse__Resource__r.Name, pse__Project__r.Name, pse__Project__r.pse__Group__r.Name, pse__Project__r.pse__Project_Manager__r.Name, pse__Start_Date__c, pse__End_Date__c, pse__Scheduled_Hours__c, Id, pse__Is_Billable__c FROM pse__Assignment__c WHERE pse__Status__c='Scheduled' AND pse__Resource__r.Name IN ('Jordan Roylance','Will Shorthouse') AND pse__End_Date__c>=2026-06-22 AND pse__Start_Date__c<=2026-10-12 ORDER BY pse__Resource__r.Name, pse__Project__r.Name`,
  ],
  // Dynamic report builder: a new, additional builder (existing snapshots above are
  // untouched). Asserts required group/scope fields are always present, dedup works,
  // the month + PM scope + row cap are mandatory, and no aliasing.
  buildTimecardReport: [
    Q.buildTimecardReport({ fields: ["pse__Total_Hours__c", "Total_Billable_Amount_Formula__c"], monthStart: "2026-04-01", monthEnd: "2026-04-30", pmNames: ["Lindsay Chown", "Will Shorthouse"], orderBy: "pse__Project__r.pse__Project_Manager__r.Name" }),
    `SELECT Id, pse__Resource__r.Name, pse__Project__r.Name, pse__Project__r.pse__Project_Manager__r.Name, pse__Total_Hours__c, Total_Billable_Amount_Formula__c FROM pse__Timecard__c WHERE pse__Approved__c = true AND pse__Project__r.pse__Project_Manager__r.Name IN ('Lindsay Chown','Will Shorthouse') AND pse__Start_Date__c >= 2026-04-01 AND pse__Start_Date__c <= 2026-04-30 ORDER BY pse__Project__r.pse__Project_Manager__r.Name LIMIT 10000`,
  ],
  buildTimecardReportDedup: [
    Q.buildTimecardReport({ fields: ["pse__Resource__r.Name", "pse__Start_Date__c"], monthStart: "2026-05-01", monthEnd: "2026-05-31", pmNames: ["Josh Wright"], limit: 500 }),
    `SELECT Id, pse__Resource__r.Name, pse__Project__r.Name, pse__Project__r.pse__Project_Manager__r.Name, pse__Start_Date__c FROM pse__Timecard__c WHERE pse__Approved__c = true AND pse__Project__r.pse__Project_Manager__r.Name IN ('Josh Wright') AND pse__Start_Date__c >= 2026-05-01 AND pse__Start_Date__c <= 2026-05-31 LIMIT 500`,
  ],
  periodByPM: [
    Q.periodByPM(start, end),
    `SELECT pse__Project__r.pse__Group__r.Name grp, pse__Project__r.pse__Project_Manager__r.Name pm, SUM(Total_Billable_Amount_Formula__c) revenue, SUM(pse__Total_Hours__c) hours, COUNT(Id) splits FROM pse__Timecard__c WHERE ${BASE} AND pse__Start_Date__c >= ${start} AND pse__Start_Date__c <= ${end} GROUP BY pse__Project__r.pse__Group__r.Name, pse__Project__r.pse__Project_Manager__r.Name ORDER BY pse__Project__r.pse__Group__r.Name`,
  ],
  // Intentionally diverges from the original: MAX(pse__Time_Credited__c) was
  // removed because Salesforce rejects aggregates on a checkbox field. See queries.js.
  periodByProject: [
    Q.periodByProject(start, end),
    `SELECT pse__Project__r.Name proj, pse__Project__r.pse__Account__r.Name acct, pse__Project__r.pse__Group__r.Name grp, pse__Project__r.pse__Project_Manager__r.Name pm, pse__Project__c projId, SUM(Total_Billable_Amount_Formula__c) revenue, SUM(pse__Total_Hours__c) hours FROM pse__Timecard__c WHERE ${BASE} AND pse__Start_Date__c >= ${start} AND pse__Start_Date__c <= ${end} GROUP BY pse__Project__r.Name, pse__Project__r.pse__Account__r.Name, pse__Project__r.pse__Group__r.Name, pse__Project__r.pse__Project_Manager__r.Name, pse__Project__c ORDER BY SUM(Total_Billable_Amount_Formula__c) DESC`,
  ],
  periodCredited: [
    Q.periodCredited(start, end),
    `SELECT pse__Project__r.pse__Group__r.Name grp, pse__Project__r.pse__Project_Manager__r.Name pm, SUM(pse__Total_Hours__c) hours FROM pse__Timecard__c WHERE pse__Approved__c = true AND pse__Time_Credited__c = true AND Project_Source__c IN ${SRC} AND pse__Start_Date__c >= ${start} AND pse__Start_Date__c <= ${end} GROUP BY pse__Project__r.pse__Group__r.Name, pse__Project__r.pse__Project_Manager__r.Name`,
  ],
  periodCreditedByProject: [
    Q.periodCreditedByProject(start, end),
    `SELECT pse__Project__c projId, SUM(pse__Total_Hours__c) hours FROM pse__Timecard__c WHERE pse__Approved__c = true AND pse__Time_Credited__c = true AND Project_Source__c IN ${SRC} AND pse__Start_Date__c >= ${start} AND pse__Start_Date__c <= ${end} GROUP BY pse__Project__c`,
  ],
  // Account management / QBRs (whole company, no scope filter).
  sbrNotesInQuarter: [
    Q.sbrNotesInQuarter(start, end),
    `SELECT Name, Account__c, Account__r.Name, Date__c, Status__c, SBR_Outcome__c, Client_Temperature__c, X3_Month_Forecast__c, Account_Manager__r.Name, Summary__c, SBR_Outcome_Notes__c, Health_Summary__c, AM_Growth_Notes__c FROM Scheduled_Business_Review__c WHERE Date__c >= ${start} AND Date__c <= ${end} ORDER BY Date__c DESC LIMIT 2000`,
  ],
  oppsCreatedInQuarter: [
    Q.oppsCreatedInQuarter(start, end),
    `SELECT COUNT(Id) cnt, SUM(Amount) amount FROM Opportunity WHERE DAY_ONLY(CreatedDate) >= ${start} AND DAY_ONLY(CreatedDate) <= ${end}`,
  ],
  oppsClosedInQuarter: [
    Q.oppsClosedInQuarter(start, end),
    `SELECT IsWon won, COUNT(Id) cnt, SUM(Amount) amount FROM Opportunity WHERE IsClosed = true AND CloseDate >= ${start} AND CloseDate <= ${end} GROUP BY IsWon`,
  ],
  oppsCreatedDetail: [
    Q.oppsCreatedDetail(start, end),
    `SELECT AccountId, Amount, IsWon, CreatedDate FROM Opportunity WHERE DAY_ONLY(CreatedDate) >= ${start} AND DAY_ONLY(CreatedDate) <= ${end} ORDER BY AccountId LIMIT 5000`,
  ],
  periodVacation: [
    Q.periodVacation(start, end),
    `SELECT pse__Resource__r.Name resource, pse__Project__r.pse__Group__r.Name grp, pse__Project__r.pse__Project_Manager__r.Name pm, SUM(pse__Total_Hours__c) hours FROM pse__Timecard__c WHERE pse__Approved__c = true AND pse__Project__r.Name = 'Internal - Vacation Time' AND pse__Start_Date__c >= ${start} AND pse__Start_Date__c <= ${end} GROUP BY pse__Resource__r.Name, pse__Project__r.pse__Group__r.Name, pse__Project__r.pse__Project_Manager__r.Name`,
  ],
  // Intentionally diverges from the original: field aliases removed because
  // Salesforce rejects aliasing on a non-aggregate query (it could never run
  // live). The hook flattens relationship objects to the friendly keys. Signed
  // off; see queries.js + usePeriodData.fetchDetail.
  periodDetail: [
    Q.periodDetail(start, end),
    `SELECT pse__Resource__r.Name, pse__Project__r.Name, pse__Project__r.pse__Account__r.Name, pse__Project__r.pse__Group__r.Name, pse__Project__r.pse__Project_Manager__r.Name, pse__Total_Hours__c, Total_Billable_Amount_Formula__c, pse__Billable__c, pse__Time_Credited__c, pse__Start_Date__c, Project_Source__c, Id FROM pse__Timecard__c WHERE pse__Approved__c = true AND pse__Start_Date__c >= ${start} AND pse__Start_Date__c <= ${end} AND (Project_Source__c IN ${SRC} OR pse__Project__r.Name = 'Internal - Vacation Time') ORDER BY pse__Start_Date__c DESC LIMIT 200`,
  ],
  auditZeroRates: [
    Q.auditZeroRates(),
    `SELECT Id, Name, pse__Resource__r.Name resource, pse__Project__r.Name proj, pse__Project__r.pse__Group__r.Name grp, pse__Bill_Rate__c billRate, pse__Planned_Bill_Rate__c plannedRate, pse__Status__c status FROM pse__Assignment__c WHERE pse__Is_Billable__c = true AND pse__Status__c = 'Scheduled' AND pse__Bill_Rate__c = 0 AND pse__Planned_Bill_Rate__c = 0 AND pse__Project__r.Project_Source__c IN ${SRC} LIMIT 50`,
  ],
  auditZeroRevSplits: [
    Q.auditZeroRevSplits(),
    `SELECT Id, Name, pse__Resource__r.Name resource, pse__Project__r.Name proj, pse__Project__r.pse__Group__r.Name grp, pse__Total_Hours__c hours, Total_Billable_Amount_Formula__c revenue, pse__Start_Date__c startDate FROM pse__Timecard__c WHERE pse__Approved__c = true AND pse__Billable__c = true AND Total_Billable_Amount_Formula__c = 0 AND pse__Total_Hours__c > 0 AND Project_Source__c IN ${SRC} AND pse__Start_Date__c >= 2026-01-01 LIMIT 50`,
  ],
  auditNullSrc: [
    Q.auditNullSrc(),
    `SELECT Id, Name, pse__Account__r.Name acct, pse__Group__r.Name grp, pse__Project_Manager__r.Name pm, Project_Source__c src, pse__Stage__c stage FROM pse__Proj__c WHERE Project_Source__c = null AND pse__Stage__c NOT IN ('Closed','Cancelled','Lost') AND pse__Group__r.Name IN ('Aldus Behan','Meghan Saunders','Tatiane Sensini') LIMIT 50`,
  ],
  auditFormulaDrift: [
    Q.auditFormulaDrift(),
    `SELECT Id, Name, pse__Resource__r.Name resource, pse__Project__r.Name proj, CAD_Revenue__c cadRevenue, Total_Billable_Amount_Formula__c formulaRevenue, pse__Start_Date__c startDate FROM pse__Timecard__c WHERE pse__Approved__c = true AND pse__Billable__c = true AND CAD_Revenue__c != Total_Billable_Amount_Formula__c AND Total_Billable_Amount_Formula__c > 0 AND Project_Source__c IN ${SRC} AND pse__Start_Date__c >= 2026-01-01 LIMIT 50`,
  ],
  auditZeroSchedHrs: [
    Q.auditZeroSchedHrs(),
    `SELECT Id, Name, pse__Resource__r.Name resource, pse__Project__r.Name proj, pse__Project__r.pse__Group__r.Name grp, pse__Scheduled_Hours__c scheduledHours, pse__Start_Date__c startDate, pse__End_Date__c endDate FROM pse__Assignment__c WHERE pse__Is_Billable__c = true AND pse__Status__c = 'Scheduled' AND pse__Scheduled_Hours__c = 0 AND pse__Project__r.Project_Source__c IN ${SRC} AND pse__End_Date__c >= 2026-01-01 LIMIT 50`,
  ],
};

for (const [name, [built, original]] of Object.entries(cases)) {
  test(`${name} matches original SOQL byte-for-byte`, () => {
    assert.equal(built, original);
  });
}
