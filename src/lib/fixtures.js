// Local-dev fixtures. When VITE_USE_FIXTURES is on (default in `npm run dev`),
// callSF / callDrive resolve to this sample data instead of hitting the MCP
// connectors, so the UI renders without Salesforce/Drive credentials.
//
// This is sample data for visual review only. It is NOT the April 2026 sanity
// numbers and must never be used to validate revenue/RPD.

// Sample roster mapped onto the real director/pod structure (constants/teams.js).
const PEOPLE = [
  { name: "Sarah Kim", grp: "Aldus Behan", pm: "Michelle Clark", hours: 148, revenue: 30200 },
  { name: "Ella Brown", grp: "Aldus Behan", pm: "Michelle Clark", hours: 132, revenue: 26800 },
  { name: "Tom Lee", grp: "Lane Four", pm: "Lindsay Chown", hours: 156, revenue: 33100 },
  { name: "Nina Patel", grp: "Aldus Behan", pm: "Julie Holm", hours: 120, revenue: 22400 },
  { name: "Omar Farah", grp: "Mike Scott", pm: "Josh Wright", hours: 144, revenue: 28900 },
  { name: "Raj Singh", grp: "Meghan Saunders", pm: "Will Shorthouse", hours: 160, revenue: 35200 },
  { name: "Mia Wong", grp: "Meg Diplock", pm: "Vesna Sorgic", hours: 138, revenue: 27600 },
  { name: "Leo Garcia", grp: "Meghan Saunders", pm: "Brandon Wilson", hours: 112, revenue: 19800 },
  { name: "Anna Schmidt", grp: "Meghan Saunders", pm: "Malcolm McMullin", hours: 150, revenue: 31900 },
  { name: "Paulo Costa", grp: "Meghan Saunders", pm: "Brandon Wilson", hours: 154, revenue: 32500 },
  { name: "Julia Rocha", grp: "Aldus Behan", pm: "Julie Holm", hours: 126, revenue: 24100 },
  { name: "Chris Day", grp: "Unscoped Group", pm: "Unknown", hours: 88, revenue: 12200 },
];

const VACATION = [
  { name: "Ella Brown", grp: "Aldus Behan", pm: "Michelle Clark", hours: 16 },
  { name: "Leo Garcia", grp: "Meghan Saunders", pm: "Brandon Wilson", hours: 24 },
];

const CREDITED = [
  { name: "Nina Patel", grp: "Aldus Behan", pm: "Julie Holm", hours: 8 },
  { name: "Mia Wong", grp: "Meg Diplock", pm: "Vesna Sorgic", hours: 6 },
];

// Slight month-over-month variation so period A vs B deltas aren't all zero.
function monthFactor(soql) {
  const m = soql.match(/(\d{4})-(\d{2})-01/);
  const month = m ? parseInt(m[2], 10) : 4;
  return 1 + (month - 4) * 0.04;
}

function aggByPM(people, factor) {
  const map = {};
  people.forEach((p) => {
    const k = p.grp + "|" + p.pm;
    if (!map[k]) map[k] = { grp: p.grp, pm: p.pm, revenue: 0, hours: 0, splits: 0 };
    map[k].revenue += Math.round(p.revenue * factor);
    map[k].hours += Math.round(p.hours * factor);
    map[k].splits += 4;
  });
  return Object.values(map);
}

function projects(people, factor) {
  return people.map((p, i) => ({
    proj: `${p.pm.split(" ")[0]} Project ${i + 1}`,
    acct: `Account ${String.fromCharCode(65 + (i % 8))}`,
    grp: p.grp, pm: p.pm, projId: `p${i + 1}`,
    revenue: Math.round(p.revenue * factor), hours: Math.round(p.hours * factor),
    credited: false,
  }));
}

// Resolve a SOQL string to a sample {records} payload.
export function sfFixture(soql) {
  const factor = monthFactor(soql);

  // pse__Assignment__c queries
  if (soql.includes("FROM pse__Assignment__c")) {
    if (soql.includes("COUNT(Id) cnt")) {
      return { records: PEOPLE.map((p) => ({ resource: p.name, grp: p.grp, pm: p.pm, cnt: 3 })) };
    }
    if (soql.includes("pse__Bill_Rate__c = 0")) {
      return { records: [{ Id: "a01", Name: "ASG-1001", resource: "Leo Garcia", proj: "Brandon Project 8", grp: "Meghan Saunders", billRate: 0, plannedRate: 0, status: "Scheduled" }] };
    }
    if (soql.includes("pse__Scheduled_Hours__c = 0")) {
      return { records: [{ Id: "a02", Name: "ASG-1042", resource: "Omar Farah", proj: "Josh Project 5", grp: "Aldus Behan", scheduledHours: 0, startDate: "2026-04-01", endDate: "2026-06-30" }] };
    }
    // Resource planner: assignments with a span total (pse__Scheduled_Hours__c) the
    // hook distributes across the span. Two projects per in-scope person (year-long
    // spans -> ~20h and ~12h per week), plus a third for Sarah Kim to push her over.
    if (soql.includes("pse__Resource__r.Name IN (")) {
      // Forecast variant drops the billable-only filter and selects the flag.
      const incNonBill = !soql.includes("pse__Is_Billable__c=true");
      const span = { pse__Start_Date__c: "2026-01-01", pse__End_Date__c: "2026-12-31" }; // ~260 working days
      const mk = (p, i, sched, suffix, billable = true, projName) => ({
        pse__Resource__r: { Name: p.name },
        pse__Project__r: { Name: projName || `${p.pm.split(" ")[0]} ${suffix}`, pse__Group__r: { Name: p.grp }, pse__Project_Manager__r: { Name: p.pm } },
        ...span, pse__Scheduled_Hours__c: sched, Id: `asg${i}${suffix[0]}`, pse__Is_Billable__c: billable,
      });
      const inScope = PEOPLE.filter((p) => p.grp !== "Unscoped Group");
      const recs = inScope.flatMap((p, i) => [mk(p, i, 1040, "Retainer"), mk(p, i, 624, "Project")]);
      recs.push({ pse__Resource__r: { Name: "Sarah Kim" }, pse__Project__r: { Name: "Michelle Overflow", pse__Group__r: { Name: "Aldus Behan" }, pse__Project_Manager__r: { Name: "Michelle Clark" } }, ...span, pse__Scheduled_Hours__c: 1040, Id: "asg-extra", pse__Is_Billable__c: true });
      // Non-billable + future vacation, so the forecast segments are non-empty in
      // fixtures mode (vacation = the VACATION_PROJECT, a non-billable project).
      if (incNonBill) {
        inScope.forEach((p, i) => {
          recs.push(mk(p, i, 130, "Vacation", false, "Internal - Vacation Time"));
          recs.push(mk(p, i, 210, "AdminTime", false, "Internal - Admin Time"));
        });
      }
      return { records: recs };
    }
    return { records: [] };
  }

  // pse__Proj__c (null source audit)
  if (soql.includes("FROM pse__Proj__c")) {
    return { records: [{ Id: "pr1", Name: "Numeris Retainer", acct: "Numeris", grp: "Aldus Behan", pm: "Michelle Clark", src: null, stage: "In Progress" }] };
  }

  // pse__Timecard__c queries
  if (soql.includes("FROM pse__Timecard__c")) {
    // Report builder (buildTimecardReport): scoped by PM name, returns nested
    // relationship shape so the hook's path-based field reader works as in live.
    if (soql.includes("pse__Project__r.pse__Project_Manager__r.Name IN (")) {
      const inScope = PEOPLE.filter((p) => p.grp !== "Unscoped Group");
      const mk = (p, i, half, rev) => ({
        Id: `tc-r${i}${half}`,
        Name: `TC-${4000 + i}${half}`,
        pse__Resource__r: { Name: p.name },
        pse__Project__r: {
          Name: `${p.pm.split(" ")[0]} Project ${i + 1}`,
          pse__Account__r: { Name: `Account ${String.fromCharCode(65 + (i % 8))}` },
          pse__Group__r: { Name: p.grp },
          pse__Project_Manager__r: { Name: p.pm },
        },
        pse__Total_Hours__c: Math.round(p.hours * (half === "a" ? 0.6 : 0.4) * factor),
        Total_Billable_Amount_Formula__c: rev,
        CAD_Revenue__c: rev,
        pse__Billable__c: true,
        pse__Time_Credited__c: false,
        pse__Start_Date__c: half === "a" ? "2026-04-13" : "2026-04-20",
        Project_Source__c: "Managed Services",
      });
      return { records: inScope.flatMap((p, i) => [mk(p, i, "a", Math.round(p.revenue * 0.6 * factor)), mk(p, i, "b", Math.round(p.revenue * 0.4 * factor))]) };
    }
    if (soql.includes("CAD_Revenue__c !=")) {
      return { records: [{ Id: "tc1", Name: "TC-2201", resource: "Sarah Kim", proj: "Michelle Project 1", cadRevenue: 31000, formulaRevenue: 30200, startDate: "2026-04-13" }] };
    }
    if (soql.includes("Total_Billable_Amount_Formula__c = 0")) {
      return { records: [{ Id: "tc2", Name: "TC-2310", resource: "Leo Garcia", proj: "Brandon Project 8", grp: "Meghan Saunders", hours: 12, revenue: 0, startDate: "2026-04-06" }] };
    }
    // Vacation: utilization variant groups by resource only; period variant adds grp/pm.
    if (soql.includes("Internal - Vacation Time")) {
      if (soql.includes("pse__Project__r.pse__Group__r.Name grp")) {
        return { records: VACATION.map((v) => ({ resource: v.name, grp: v.grp, pm: v.pm, hours: v.hours })) };
      }
      return { records: VACATION.map((v) => ({ resource: v.name, hours: v.hours })) };
    }
    // Credited: by-project (account level), by group+pm (period), or by resource (utilization).
    if (soql.includes("pse__Time_Credited__c=true") || soql.includes("pse__Time_Credited__c = true")) {
      if (soql.includes("pse__Project__c projId")) {
        return { records: [{ projId: "p1", hours: 6 }, { projId: "p4", hours: 4 }] };
      }
      if (soql.includes("pse__Project__r.pse__Group__r.Name grp")) {
        return { records: CREDITED.map((c) => ({ grp: c.grp, pm: c.pm, hours: c.hours })) };
      }
      return { records: CREDITED.map((c) => ({ resource: c.name, hours: c.hours })) };
    }
    // Time detail (raw splits)
    if (soql.includes("Id recordId") || soql.includes("LIMIT 200")) {
      return {
        records: PEOPLE.flatMap((p, i) => ([
          { resource: p.name, proj: `${p.pm.split(" ")[0]} Project ${i + 1}`, acct: `Account ${String.fromCharCode(65 + (i % 8))}`, grp: p.grp, pm: p.pm, hours: Math.round(p.hours * 0.6), revenue: Math.round(p.revenue * 0.6), billable: true, credited: false, startDate: "2026-04-13", src: "Managed Services", recordId: `d${i}a` },
          { resource: p.name, proj: `${p.pm.split(" ")[0]} Project ${i + 1}`, acct: `Account ${String.fromCharCode(65 + (i % 8))}`, grp: p.grp, pm: p.pm, hours: Math.round(p.hours * 0.4), revenue: Math.round(p.revenue * 0.4), billable: true, credited: false, startDate: "2026-04-20", src: "Managed Services", recordId: `d${i}b` },
        ])),
      };
    }
    // Utilization billable: by resource with grp + pm
    if (soql.includes("SUM(Total_Billable_Amount_Formula__c) revenue") && soql.includes("pse__Resource__r.Name resource")) {
      return { records: PEOPLE.map((p) => ({ resource: p.name, grp: p.grp, pm: p.pm, hours: Math.round(p.hours * factor), revenue: Math.round(p.revenue * factor) })) };
    }
    // periodByProject: has projId
    if (soql.includes("pse__Project__c projId")) {
      return { records: projects(PEOPLE, factor) };
    }
    // periodByPM: has COUNT(Id) splits
    if (soql.includes("COUNT(Id) splits")) {
      return { records: aggByPM(PEOPLE, factor) };
    }
  }

  // Account management: Scheduled Business Reviews (QBRs)
  if (soql.includes("FROM Scheduled_Business_Review__c")) {
    return { records: [
      { Name: "SBR-1001", Account__c: "001a", Account__r: { Name: "Acme Corp" }, Date__c: "2026-05-12", Status__c: "Completed", SBR_Outcome__c: "Services Continuation", Client_Temperature__c: "Green (good)", X3_Month_Forecast__c: "Increase", Account_Manager__r: { Name: "Megan Diplock" }, Summary__c: "Happy with delivery, asking about AI use cases.", SBR_Outcome_Notes__c: "Renew managed services, scope an AI pilot.", Health_Summary__c: "Strong relationship.", AM_Growth_Notes__c: "Expansion likely next quarter." },
      { Name: "SBR-1002", Account__c: "001b", Account__r: { Name: "Globex Inc." }, Date__c: "2026-04-22", Status__c: "Completed", SBR_Outcome__c: "Churn", Client_Temperature__c: "Red (bad)", X3_Month_Forecast__c: "Decrease", Account_Manager__r: { Name: "Aldus Behan" }, Summary__c: "Frustrated with response times, budget under review.", SBR_Outcome_Notes__c: "Escalation: exec sponsor wants a recovery plan.", Health_Summary__c: "At risk.", AM_Growth_Notes__c: "" },
      { Name: "SBR-1003", Account__c: "001c", Account__r: { Name: "Initech" }, Date__c: "2026-06-01", Status__c: "Scheduled", SBR_Outcome__c: "Hours Expansion", Client_Temperature__c: "Gold (gold)", X3_Month_Forecast__c: "Stay the Same", Account_Manager__r: { Name: "Meghan Saunders" }, Summary__c: "Scaling, also asking about AI.", SBR_Outcome_Notes__c: "Increase weekly hours.", Health_Summary__c: "Good.", AM_Growth_Notes__c: "Add a second pod." },
    ] };
  }

  // Account management: Opportunity aggregates / detail
  if (soql.includes("FROM Opportunity")) {
    if (soql.includes("GROUP BY IsWon")) {
      return { records: [{ won: true, cnt: 9, amount: 412000 }, { won: false, cnt: 11, amount: 268000 }] };
    }
    if (soql.includes("COUNT(Id) cnt")) {
      return { records: [{ cnt: 24, amount: 1180000 }] };
    }
    if (soql.includes("AccountId, Amount, IsWon, CreatedDate")) {
      return { records: [
        { AccountId: "001a", Amount: 60000, IsWon: true, CreatedDate: "2026-05-20T10:00:00.000+0000" },
        { AccountId: "001a", Amount: 40000, IsWon: false, CreatedDate: "2026-06-02T10:00:00.000+0000" },
        { AccountId: "001c", Amount: 90000, IsWon: false, CreatedDate: "2026-06-10T10:00:00.000+0000" },
      ] };
    }
  }

  return { records: [] };
}

// Canned describe for the report builder's column picker (fixtures mode). A
// representative slice of pse__Timecard__c direct fields with label / API name /
// type / filterable / groupable, mirroring the live describe payload shape.
export function describeFixture(_sobject) {
  return {
    fields: [
      { label: "Total Hours", name: "pse__Total_Hours__c", type: "double", filterable: true, groupable: false, custom: true },
      { label: "Total Billable Amount (Formula)", name: "Total_Billable_Amount_Formula__c", type: "double", filterable: true, groupable: false, custom: true },
      { label: "CAD Revenue", name: "CAD_Revenue__c", type: "double", filterable: true, groupable: false, custom: true },
      { label: "Billable", name: "pse__Billable__c", type: "boolean", filterable: true, groupable: true, custom: true },
      { label: "Time Credited", name: "pse__Time_Credited__c", type: "boolean", filterable: true, groupable: true, custom: true },
      { label: "Approved", name: "pse__Approved__c", type: "boolean", filterable: true, groupable: true, custom: true },
      { label: "Start Date", name: "pse__Start_Date__c", type: "date", filterable: true, groupable: true, custom: true },
      { label: "Project Source", name: "Project_Source__c", type: "string", filterable: true, groupable: false, custom: true },
      { label: "Name", name: "Name", type: "string", filterable: true, groupable: true, custom: false },
    ],
  };
}
