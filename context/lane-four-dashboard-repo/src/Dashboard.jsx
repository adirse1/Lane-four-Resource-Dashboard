// Lane Four Team Performance Dashboard - Merged build
// Tabs: Team hierarchy | Utilization | Actuals | Forecast | Time detail | Data audit | Options
// All Salesforce + Drive calls route through callClaude (Anthropic API in artifacts pattern).

import { useState, useEffect, useCallback, useRef } from "react";

// ── Brand ────────────────────────────────────────────────────────────────────
const B = {
  teal:"#2CCCD3", orange:"#FF5C39", yellow:"#FDD26E",
  lgray:"#DEE2E3", offwhite:"#F5F9FA", white:"#FFFFFF", black:"#000000",
  tealLt:"rgba(44,204,211,0.12)", tealDash:"rgba(44,204,211,0.45)",
  green:"#1D9E75", greenBg:"#E1F5EE", greenTx:"#0F6E56",
  amber:"#BA7517", amberBg:"#FAEEDA", amberTx:"#854F0B",
  red:"#D85A30", redBg:"#FCEBEB", redTx:"#A32D2D",
  purple:"#534AB7", purpleBg:"#EEEDFE", purpleTx:"#3C3489",
  blue:"#185FA5", blueBg:"#E6F1FB", blueTx:"#0C447C",
};

const FOLDER_ID = "1xPCCoknLjxuSOKNjtV2fS5JtmNspru1y";
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// Avatar color cycle + initials
const AC = [
  {bg:"rgba(44,204,211,0.15)",tx:"#0B8F95"},
  {bg:"rgba(255,92,57,0.12)",tx:"#993C1D"},
  {bg:"rgba(253,210,110,0.2)",tx:"#854F0B"},
  {bg:"rgba(83,74,183,0.12)",tx:"#3C3489"},
  {bg:"rgba(29,158,117,0.12)",tx:"#085041"},
];
const ac = n => { let h=0; for(let c of n) h=(h*31+c.charCodeAt(0))%5; return AC[Math.abs(h)]; };
const ini = n => { const p=n.trim().split(" "); return (p[0][0]+(p[p.length-1][0]||"")).toUpperCase(); };

// ── Holiday data (CA + US, 2024-2027) ──────────────────────────────────────────
const HOLIDAYS = {
  2024:{
    CA:[
      {name:"New Year's Day",date:"2024-01-01"},{name:"Family Day (ON)",date:"2024-02-19"},
      {name:"Good Friday",date:"2024-03-29"},{name:"Victoria Day",date:"2024-05-20"},
      {name:"Canada Day",date:"2024-07-01"},{name:"Civic Holiday (ON)",date:"2024-08-05"},
      {name:"Labour Day",date:"2024-09-02"},{name:"National Day for Truth",date:"2024-09-30"},
      {name:"Thanksgiving",date:"2024-10-14"},{name:"Remembrance Day",date:"2024-11-11"},
      {name:"Christmas Day",date:"2024-12-25"},
    ],
    US:[
      {name:"New Year's Day",date:"2024-01-01"},{name:"MLK Jr. Day",date:"2024-01-15"},
      {name:"Presidents' Day",date:"2024-02-19"},{name:"Memorial Day",date:"2024-05-27"},
      {name:"Juneteenth",date:"2024-06-19"},{name:"Independence Day",date:"2024-07-04"},
      {name:"Labour Day",date:"2024-09-02"},{name:"Columbus Day",date:"2024-10-14"},
      {name:"Veterans Day",date:"2024-11-11"},{name:"Thanksgiving",date:"2024-11-28"},
      {name:"Christmas Day",date:"2024-12-25"},
    ],
  },
  2025:{
    CA:[
      {name:"New Year's Day",date:"2025-01-01"},{name:"Family Day (ON)",date:"2025-02-17"},
      {name:"Good Friday",date:"2025-04-18"},{name:"Victoria Day",date:"2025-05-19"},
      {name:"Canada Day",date:"2025-07-01"},{name:"Civic Holiday (ON)",date:"2025-08-04"},
      {name:"Labour Day",date:"2025-09-01"},{name:"National Day for Truth",date:"2025-09-30"},
      {name:"Thanksgiving",date:"2025-10-13"},{name:"Remembrance Day",date:"2025-11-11"},
      {name:"Christmas Day",date:"2025-12-25"},
    ],
    US:[
      {name:"New Year's Day",date:"2025-01-01"},{name:"MLK Jr. Day",date:"2025-01-20"},
      {name:"Presidents' Day",date:"2025-02-17"},{name:"Memorial Day",date:"2025-05-26"},
      {name:"Juneteenth",date:"2025-06-19"},{name:"Independence Day",date:"2025-07-04"},
      {name:"Labour Day",date:"2025-09-01"},{name:"Columbus Day",date:"2025-10-13"},
      {name:"Veterans Day",date:"2025-11-11"},{name:"Thanksgiving",date:"2025-11-27"},
      {name:"Christmas Day",date:"2025-12-25"},
    ],
  },
  2026:{
    CA:[
      {name:"New Year's Day",date:"2026-01-01"},{name:"Family Day (ON)",date:"2026-02-16"},
      {name:"Good Friday",date:"2026-04-03"},{name:"Victoria Day",date:"2026-05-18"},
      {name:"Canada Day",date:"2026-07-01"},{name:"Civic Holiday (ON)",date:"2026-08-03"},
      {name:"Labour Day",date:"2026-09-07"},{name:"National Day for Truth",date:"2026-09-30"},
      {name:"Thanksgiving",date:"2026-10-12"},{name:"Remembrance Day",date:"2026-11-11"},
      {name:"Christmas Day",date:"2026-12-25"},
    ],
    US:[
      {name:"New Year's Day",date:"2026-01-01"},{name:"MLK Jr. Day",date:"2026-01-19"},
      {name:"Presidents' Day",date:"2026-02-16"},{name:"Memorial Day",date:"2026-05-25"},
      {name:"Juneteenth",date:"2026-06-19"},{name:"Independence Day",date:"2026-07-03"},
      {name:"Labour Day",date:"2026-09-07"},{name:"Columbus Day",date:"2026-10-12"},
      {name:"Veterans Day",date:"2026-11-11"},{name:"Thanksgiving",date:"2026-11-26"},
      {name:"Christmas Day",date:"2026-12-25"},
    ],
  },
  2027:{
    CA:[
      {name:"New Year's Day",date:"2027-01-01"},{name:"Family Day (ON)",date:"2027-02-15"},
      {name:"Good Friday",date:"2027-03-26"},{name:"Victoria Day",date:"2027-05-24"},
      {name:"Canada Day",date:"2027-07-01"},{name:"Civic Holiday (ON)",date:"2027-08-02"},
      {name:"Labour Day",date:"2027-09-06"},{name:"National Day for Truth",date:"2027-09-30"},
      {name:"Thanksgiving",date:"2027-10-11"},{name:"Remembrance Day",date:"2027-11-11"},
      {name:"Christmas Day",date:"2027-12-27"},
    ],
    US:[
      {name:"New Year's Day",date:"2027-01-01"},{name:"MLK Jr. Day",date:"2027-01-18"},
      {name:"Presidents' Day",date:"2027-02-15"},{name:"Memorial Day",date:"2027-05-31"},
      {name:"Juneteenth",date:"2027-06-18"},{name:"Independence Day",date:"2027-07-05"},
      {name:"Labour Day",date:"2027-09-06"},{name:"Columbus Day",date:"2027-10-11"},
      {name:"Veterans Day",date:"2027-11-11"},{name:"Thanksgiving",date:"2027-11-25"},
      {name:"Christmas Day",date:"2027-12-27"},
    ],
  },
};

// ── Working day helpers (driven by Options holiday toggles) ─────────────────────
function getEnabledHols(year, country, hState) {
  return (HOLIDAYS[year]?.[country] || []).filter(h => hState[`${year}-${country}-${h.date}`] !== false);
}
function calcWD(year, month, hols) {
  const hSet = new Set((hols||[]).map(h=>h.date));
  let c=0, days=new Date(year,month,0).getDate();
  for(let d=1;d<=days;d++){
    const dow=new Date(year,month-1,d).getDay();
    if(dow===0||dow===6) continue;
    const k=`${year}-${String(month).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    if(!hSet.has(k)) c++;
  }
  return c;
}
function calcWDElapsed(year, month, hols) {
  const today=new Date(), hSet=new Set((hols||[]).map(h=>h.date));
  const isCurrentMonth = today.getFullYear()===year && today.getMonth()+1===month;
  const lastDay = isCurrentMonth ? today.getDate() : new Date(year,month,0).getDate();
  let c=0;
  for(let d=1;d<=lastDay;d++){
    const dow=new Date(year,month-1,d).getDay();
    if(dow===0||dow===6) continue;
    const k=`${year}-${String(month).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    if(!hSet.has(k)) c++;
  }
  return c;
}
function calcQWD(year, qNum, hState) {
  const FISCAL_Q = {
    1:[{y:year,m:7},{y:year,m:8},{y:year,m:9}],
    2:[{y:year,m:10},{y:year,m:11},{y:year,m:12}],
    3:[{y:year+1,m:1},{y:year+1,m:2},{y:year+1,m:3}],
    4:[{y:year+1,m:4},{y:year+1,m:5},{y:year+1,m:6}],
  };
  const months = FISCAL_Q[qNum] || [];
  return months.reduce((sum,{y,m})=>{
    const h=getEnabledHols(y,"CA",hState);
    return sum+calcWD(y,m,h);
  },0);
}

// ── Period option generators ───────────────────────────────────────────────────
function genMonthOpts(hState) {
  const today=new Date(), opts=[];
  for(let i=0;i<24;i++){
    let m=today.getMonth()+1-i, y=today.getFullYear();
    while(m<=0){m+=12;y--;}
    const hols=getEnabledHols(y,"CA",hState);
    const wd=calcWD(y,m,hols);
    opts.push({ id:`${y}-${m}`, label:`${MONTHS[m-1]} ${y}`, year:y, month:m, wd });
  }
  return opts;
}
function genQuarterOpts(hState) {
  const today=new Date(), opts=[];
  const FISCAL_Q_LABELS = { 1:"Q1 (Jul–Sep)", 2:"Q2 (Oct–Dec)", 3:"Q3 (Jan–Mar)", 4:"Q4 (Apr–Jun)" };
  for(let i=0;i<8;i++){
    const cm=today.getMonth()+1, cy=today.getFullYear();
    let fq, fy;
    if(cm>=7){fq=1;fy=cy;}
    else if(cm>=4){fq=4;fy=cy-1;}
    else if(cm>=1){fq=3;fy=cy-1;}
    let q=fq-i, y=fy;
    while(q<=0){q+=4;y--;}
    const wd=calcQWD(y,q,hState);
    const FISCAL_Q_MONTHS = {
      1:[{y,m:7},{y,m:8},{y,m:9}],
      2:[{y,m:10},{y,m:11},{y,m:12}],
      3:[{y:y+1,m:1},{y:y+1,m:2},{y:y+1,m:3}],
      4:[{y:y+1,m:4},{y:y+1,m:5},{y:y+1,m:6}],
    };
    const mths=FISCAL_Q_MONTHS[q];
    const startM=mths[0], endM=mths[2];
    const rangeLabel=`${MONTHS[startM.m-1]} ${startM.y}–${MONTHS[endM.m-1]} ${endM.y}`;
    opts.push({ id:`${y}-Q${q}`, label:`FY${y+1} ${FISCAL_Q_LABELS[q]}`, subLabel:rangeLabel, year:y, qNum:q, wd, months:mths });
  }
  return opts;
}

// ── Unified MCP call pattern (Salesforce + Drive) ───────────────────────────────
async function callClaude(prompt, mcpUrl, mcpName) {
  const body = { model:"claude-sonnet-4-6", max_tokens:1000, messages:[{role:"user",content:prompt}] };
  if (mcpUrl) body.mcp_servers = [{type:"url", url:mcpUrl, name:mcpName}];
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body)
  });
  if (!resp.ok) throw new Error("API "+resp.status);
  const data = await resp.json();
  const tr = data.content?.find(b=>b.type==="mcp_tool_result");
  if (tr?.content?.[0]?.text) { try { return JSON.parse(tr.content[0].text); } catch {} return tr.content[0].text; }
  const tx = data.content?.find(b=>b.type==="text");
  if (tx?.text) { const m=tx.text.match(/\{[\s\S]*\}/); if(m){try{return JSON.parse(m[0]);}catch{}} return tx.text; }
  return null;
}
const callSF = soql => callClaude("Execute this SOQL and return ONLY the raw JSON result, no explanation, no markdown:\n\n"+soql, "https://api.salesforce.com/platform/mcp/v1/platform/sobject-reads", "sf");
const callDrive = prompt => callClaude(prompt, "https://drivemcp.googleapis.com/mcp/v1", "drive");

// ── Format helpers ──────────────────────────────────────────────────────────────
const fmt  = n => `$${Math.round(n||0).toLocaleString()}`;
const fmtK = n => `$${((n||0)/1000).toFixed(0)}k`;
const fmtD = n => (n>=0?"+":"")+n.toFixed(1)+"%";
const fmtH = n => Math.round(n||0).toLocaleString();

// ── Shared UI atoms ─────────────────────────────────────────────────────────────
function Pill({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      fontSize:11, padding:"4px 10px", border:"none", cursor:"pointer",
      background: active ? B.teal : "transparent",
      color: active ? B.white : "#888",
      fontFamily:"'Open Sans',sans-serif",
    }}>{children}</button>
  );
}

function Tag({ color, bg, children }) {
  return <span style={{ fontSize:10, padding:"2px 7px", borderRadius:8, background:bg, color, fontWeight:600, fontFamily:"'Open Sans',sans-serif", whiteSpace:"nowrap" }}>{children}</span>;
}

function Spinner({ msg }) {
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:48,gap:12,fontFamily:"'Open Sans',sans-serif"}}>
      <div style={{width:28,height:28,borderRadius:"50%",border:`3px solid ${B.lgray}`,borderTopColor:B.teal,animation:"lfSpin .7s linear infinite"}}/>
      <div style={{fontSize:12,color:"#999"}}>{msg||"Loading..."}</div>
      <style>{`@keyframes lfSpin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function HelpIcon({ tip, calc, auditKey, onAudit }) {
  const [show,setShow]=useState(false);
  return (
    <span style={{position:"relative",display:"inline-flex",alignItems:"center",marginLeft:4}}>
      <span
        onMouseEnter={()=>setShow(true)} onMouseLeave={()=>setShow(false)}
        onClick={()=>auditKey&&onAudit&&onAudit(auditKey)}
        style={{width:14,height:14,borderRadius:"50%",background:B.lgray,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:"#666",cursor:"pointer",flexShrink:0,fontFamily:"'Open Sans',sans-serif"}}
      >?</span>
      {show && (
        <div style={{position:"absolute",bottom:"calc(100% + 5px)",left:"50%",transform:"translateX(-50%)",background:B.black,color:B.white,borderRadius:6,padding:"8px 10px",fontSize:11,lineHeight:1.5,width:210,zIndex:999,pointerEvents:"none",fontFamily:"'Open Sans',sans-serif"}}>
          <div style={{fontWeight:600,marginBottom:3}}>{tip}</div>
          {calc && <div style={{opacity:.75,fontSize:10}}>{calc}</div>}
          {auditKey && <div style={{marginTop:5,color:B.teal,fontSize:10}}>Click to audit →</div>}
        </div>
      )}
    </span>
  );
}

function DeltaCell({ a, b }) {
  if(!b) return <span style={{color:"#ccc"}}>—</span>;
  const pct = b>0 ? ((a-b)/b*100) : null;
  const color = pct===null?"#aaa":pct>=0?B.green:B.red;
  return <span style={{fontWeight:600,color}}>{pct!==null?fmtD(pct):"—"}</span>;
}

// ── Hierarchy seed ──────────────────────────────────────────────────────────────
function buildSeed(pg) {
  const DIRS = {
    "Aldus Behan":    { color:{bg:"rgba(44,204,211,0.12)",tx:"#0B8F95"}, pods:["Michelle Clark","Lindsay Chown","Julie Holm","Josh Wright"], grps:["Aldus Behan","Lane Four","Mike Scott"] },
    "Meghan Saunders":{ color:{bg:"rgba(255,92,57,0.10)",tx:"#993C1D"}, pods:["Will Shorthouse","Vesna Sorgic","Brandon Wilson","Malcolm McMullin"], grps:["Meghan Saunders","Meg Diplock"] },
    "Tatiane Sensini":{ color:{bg:"rgba(253,210,110,0.18)",tx:"#854F0B"}, pods:[], grps:["Tatiane Sensini"] },
  };
  const h = { directors:[], unassigned:[] };
  Object.entries(DIRS).forEach(([dn,cfg]) => {
    const dir = { name:dn, color:cfg.color, pods:cfg.pods.map(n=>({name:n,members:[],expanded:true})), directMembers:[], expanded:true };
    Object.entries(pg).forEach(([person,info]) => {
      if (person===dn || !cfg.grps.includes(info.grp)) return;
      const pod = dir.pods.find(p=>p.name===info.pm);
      if (pod) { if (!pod.members.includes(person)) pod.members.push(person); }
      else { if (!dir.directMembers.includes(person)) dir.directMembers.push(person); }
    });
    h.directors.push(dir);
  });
  const asgn = new Set();
  h.directors.forEach(d => { d.pods.forEach(p=>p.members.forEach(m=>asgn.add(m))); d.directMembers.forEach(m=>asgn.add(m)); });
  Object.keys(pg).forEach(p => { if (!asgn.has(p) && !["Aldus Behan","Meghan Saunders","Tatiane Sensini"].includes(p)) h.unassigned.push(p); });
  return h;
}

// ── Person chip ─────────────────────────────────────────────────────────────────
function Chip({ name, di, pi, wide, onRemove, onDragStart, onDragEnd }) {
  const c = ac(name);
  return (
    <div
      draggable
      onDragStart={e=>{ e.dataTransfer.effectAllowed="move"; e.dataTransfer.setData("text/plain",name); onDragStart(name,di,pi); }}
      onDragEnd={onDragEnd}
      style={{
        display:"flex",alignItems:"center",gap:6,padding:"4px 7px",
        background:wide?`rgba(44,204,211,0.06)`:B.white,
        borderRadius:5,border:`0.5px ${wide?"dashed":"solid"} ${wide?B.teal:B.lgray}`,
        cursor:"grab",userSelect:"none",
        opacity:wide?.6:1,fontSize:11,fontFamily:"'Open Sans',sans-serif",
      }}
    >
      <div style={{width:18,height:18,borderRadius:"50%",background:c.bg,color:c.tx,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:700,flexShrink:0}}>{ini(name)}</div>
      <span style={{flex:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:120}} title={name}>{name.split(" ")[0]} {name.split(" ").slice(-1)[0]}</span>
      {onRemove && <button onClick={e=>{e.stopPropagation();onRemove(name,di,pi);}} style={{fontSize:12,color:"#ccc",background:"none",border:"none",cursor:"pointer",padding:"0 2px",lineHeight:1}}>×</button>}
    </div>
  );
}

// ── Drop zone ────────────────────────────────────────────────────────────────────
function DropZone({ di, pi, onDrop, onDragOver, onDragLeave, isDragOver, children }) {
  return (
    <div
      onDragOver={e=>{e.preventDefault();e.dataTransfer.dropEffect="move";onDragOver(di,pi);}}
      onDragLeave={onDragLeave}
      onDrop={e=>{e.preventDefault();onDrop(di,pi);}}
      style={{
        padding:"5px 6px 6px",display:"flex",flexDirection:"column",gap:2,minHeight:28,
        borderTop:`0.5px solid ${B.lgray}`,
        background:isDragOver?"rgba(44,204,211,0.08)":"transparent",
        outline:isDragOver?`2px dashed ${B.teal}`:"none",
        outlineOffset:-3,borderRadius:"0 0 7px 7px",
        transition:"background .1s",
      }}
    >{children}</div>
  );
}

// ── Hierarchy tab ────────────────────────────────────────────────────────────────
function HierarchyTab({ H, setH, setStatus, registerSync }) {
  const [dragPerson, setDragPerson] = useState(null);
  const [dragSrc, setDragSrc] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [unsOpen, setUnsOpen] = useState(true);
  const [addPodDi, setAddPodDi] = useState(null);
  const [newPodName, setNewPodName] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadMsg, setLoadMsg] = useState("");

  const getAssigned = useCallback((h) => {
    const s = new Set();
    h.directors.forEach(d => { d.pods.forEach(p=>p.members.forEach(m=>s.add(m))); (d.directMembers||[]).forEach(m=>s.add(m)); });
    return s;
  }, []);

  // Preserving sync: keep existing hierarchy, only add genuinely new people to unassigned.
  const syncSF = useCallback(async () => {
    setLoading(true); setLoadMsg("Loading from Salesforce...");
    try {
      const res = await callSF("SELECT pse__Resource__r.Name resource, pse__Project__r.pse__Group__r.Name grp, pse__Project__r.pse__Project_Manager__r.Name pm, COUNT(Id) cnt FROM pse__Assignment__c WHERE pse__Is_Billable__c=true AND pse__Status__c='Scheduled' AND pse__Project__r.Project_Source__c IN ('Managed Services','Post Project Managed Services','Network') AND pse__End_Date__c>=2026-04-01 GROUP BY pse__Resource__r.Name,pse__Project__r.pse__Group__r.Name,pse__Project__r.pse__Project_Manager__r.Name ORDER BY pse__Project__r.pse__Group__r.Name,pse__Resource__r.Name");
      if (!res?.records) { setStatus({msg:"No SF data",type:"r"}); setLoading(false); return; }
      const pg = {};
      res.records.forEach(r => { if(!r.resource)return; if(!pg[r.resource]||r.cnt>pg[r.resource].cnt) pg[r.resource]={grp:r.grp,pm:r.pm,cnt:r.cnt}; });
      setH(prev => {
        if (!prev) return buildSeed(pg);
        const asgn = getAssigned(prev);
        const newUns = [...prev.unassigned];
        Object.keys(pg).forEach(p => { if (!asgn.has(p) && !newUns.includes(p)) newUns.push(p); });
        return { ...prev, unassigned: [...new Set(newUns)] };
      });
      setStatus({ msg: Object.keys(pg).length + " people loaded", type:"g" });
    } catch(e) { setStatus({msg:"Error: "+e.message, type:"r"}); }
    setLoading(false);
  }, [setH, setStatus, getAssigned]);

  // Expose sync to the header button so it stops wiping state.
  useEffect(() => { registerSync && registerSync(() => syncSF); }, [syncSF, registerSync]);

  useEffect(() => {
    const load = async () => {
      setLoading(true); setLoadMsg("Loading hierarchy from Drive...");
      try {
        const saved = await callDrive('In Google Drive folder ID "'+FOLDER_ID+'", find the file named "hierarchy.json" and return its complete text content. Return ONLY the raw JSON.');
        if (saved && saved.directors) { setH(saved); setStatus({msg:"Loaded from Drive",type:"g"}); }
      } catch(e) { console.warn("Drive:", e.message); }
      await syncSF();
    };
    load();
  }, []);

  const remMem = (name, di, pi) => {
    setH(prev => {
      const h = JSON.parse(JSON.stringify(prev));
      if (di==="u") { h.unassigned = h.unassigned.filter(x=>x!==name); return h; }
      const d = h.directors[di]; if(!d) return h;
      if (pi===-1) d.directMembers = (d.directMembers||[]).filter(x=>x!==name);
      else { const pod=d.pods[pi]; if(pod) pod.members=pod.members.filter(x=>x!==name); }
      return h;
    });
  };
  const addMem = (name, di, pi) => {
    setH(prev => {
      const h = JSON.parse(JSON.stringify(prev));
      if (di==="u") { if(!h.unassigned.includes(name)) h.unassigned.push(name); return h; }
      const d = h.directors[di]; if(!d) return h;
      if (pi===-1) { if(!d.directMembers) d.directMembers=[]; if(!d.directMembers.includes(name)) d.directMembers.push(name); }
      else { const pod=d.pods[pi]; if(pod&&!pod.members.includes(name)) pod.members.push(name); }
      return h;
    });
  };
  const handleDrop = (di, pi) => {
    if (!dragPerson || !dragSrc) return;
    remMem(dragPerson, dragSrc.di, dragSrc.pi);
    addMem(dragPerson, di, pi);
    setDragPerson(null); setDragSrc(null); setDragOver(null);
  };
  const handleRemove = (name, di, pi) => { remMem(name, di, pi); addMem(name, "u", "_u_"); };
  const togglePod = (di, pi) => {
    setH(prev => { const h = JSON.parse(JSON.stringify(prev)); h.directors[di].pods[pi].expanded = !h.directors[di].pods[pi].expanded; return h; });
  };
  const addPod = () => {
    if (!newPodName.trim()) return;
    setH(prev => { const h = JSON.parse(JSON.stringify(prev)); h.directors[addPodDi].pods.push({name:newPodName.trim(),members:[],expanded:true}); return h; });
    setNewPodName(""); setAddPodDi(null);
  };

  if (loading) return <Spinner msg={loadMsg} />;
  if (!H) return <Spinner msg="Waiting for data..." />;
  const dragOverKey = dragOver;

  return (
    <div>
      {/* Unassigned */}
      <div style={{background:B.white,borderRadius:10,border:`0.5px solid ${B.lgray}`,overflow:"hidden",marginBottom:20}}>
        <div onClick={()=>setUnsOpen(o=>!o)} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",background:B.offwhite,borderBottom:`0.5px solid ${B.lgray}`,cursor:"pointer"}}>
          <span style={{fontSize:14}}>👤</span>
          <span style={{fontSize:12,fontWeight:600,fontFamily:"'Poppins',sans-serif",flex:1}}>Unassigned</span>
          <span style={{fontSize:9,padding:"2px 6px",borderRadius:7,fontWeight:600,background:B.amberBg,color:B.amberTx}}>{H.unassigned.length}</span>
          <span style={{fontSize:10,color:"#bbb",transform:unsOpen?"rotate(180deg)":"none",transition:"transform .15s"}}>▼</span>
        </div>
        {unsOpen && (
          <div
            onDragOver={e=>{e.preventDefault();setDragOver("uns");}}
            onDragLeave={()=>setDragOver(null)}
            onDrop={e=>{e.preventDefault();handleDrop("u","_u_");setDragOver(null);}}
            style={{padding:"10px 14px",display:"flex",flexWrap:"wrap",gap:5,minHeight:40,background:dragOverKey==="uns"?"rgba(44,204,211,0.05)":"transparent",outline:dragOverKey==="uns"?`2px dashed ${B.teal}`:"none",outlineOffset:-3}}
          >
            {H.unassigned.map(p=>(
              <Chip key={p} name={p} di="u" pi="_u_" wide
                onRemove={null}
                onDragStart={(name,di,pi)=>{setDragPerson(name);setDragSrc({di,pi});}}
                onDragEnd={()=>{setDragPerson(null);setDragOver(null);}}
              />
            ))}
          </div>
        )}
      </div>

      {/* Director grid */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
        {H.directors.map((dir, di) => {
          const tot = (dir.pods||[]).reduce((s,p)=>s+p.members.length,0)+(dir.directMembers||[]).length;
          return (
            <div key={dir.name} style={{display:"flex",flexDirection:"column",gap:10}}>
              <div style={{background:B.white,borderRadius:10,border:`0.5px solid ${B.lgray}`,overflow:"hidden"}}>
                <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 12px",background:B.offwhite,borderBottom:`0.5px solid ${B.lgray}`}}>
                  <div style={{width:28,height:28,borderRadius:"50%",background:dir.color.bg,color:dir.color.tx,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,fontFamily:"'Poppins',sans-serif"}}>{ini(dir.name)}</div>
                  <div style={{fontSize:13,fontWeight:700,fontFamily:"'Poppins',sans-serif",flex:1}}>{dir.name.split(" ")[0]}</div>
                  <div style={{fontSize:11,color:"#aaa"}}>{tot}</div>
                </div>
                <div style={{padding:6,display:"flex",flexDirection:"column",gap:6}}>
                  {/* Direct members */}
                  <div style={{background:B.offwhite,borderRadius:7,border:`0.5px solid ${B.lgray}`,overflow:"hidden"}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,padding:"6px 9px"}}>
                      <div style={{width:7,height:7,borderRadius:"50%",background:B.lgray,flexShrink:0}}/>
                      <div style={{fontSize:11,fontWeight:600,flex:1}}>{dir.name.split(" ")[0]} (direct)</div>
                      <div style={{fontSize:10,color:"#aaa"}}>{(dir.directMembers||[]).length}</div>
                    </div>
                    <DropZone di={di} pi={-1}
                      onDrop={handleDrop} onDragOver={(di,pi)=>setDragOver(`${di}-${pi}`)} onDragLeave={()=>setDragOver(null)}
                      isDragOver={dragOverKey===`${di}--1`}
                    >
                      {(dir.directMembers||[]).map(p=>(
                        <Chip key={p} name={p} di={di} pi={-1}
                          onRemove={handleRemove}
                          onDragStart={(name,di,pi)=>{setDragPerson(name);setDragSrc({di,pi});}}
                          onDragEnd={()=>{setDragPerson(null);setDragOver(null);}}
                        />
                      ))}
                    </DropZone>
                  </div>
                  {/* Pods */}
                  {(dir.pods||[]).map((pod,pi) => (
                    <div key={pod.name} style={{background:B.offwhite,borderRadius:7,border:`0.5px solid ${B.lgray}`,overflow:"hidden"}}>
                      <div onClick={()=>togglePod(di,pi)} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 9px",cursor:"pointer"}}>
                        <div style={{width:7,height:7,borderRadius:"50%",background:B.teal,flexShrink:0}}/>
                        <div style={{fontSize:11,fontWeight:600,flex:1}}>{pod.name}</div>
                        <div style={{fontSize:10,color:"#aaa"}}>{pod.members.length}</div>
                        <div style={{fontSize:10,color:"#bbb",transform:pod.expanded!==false?"rotate(180deg)":"none",transition:"transform .15s"}}>▼</div>
                      </div>
                      {pod.expanded!==false && (
                        <DropZone di={di} pi={pi}
                          onDrop={handleDrop} onDragOver={(di,pi)=>setDragOver(`${di}-${pi}`)} onDragLeave={()=>setDragOver(null)}
                          isDragOver={dragOverKey===`${di}-${pi}`}
                        >
                          {pod.members.map(p=>(
                            <Chip key={p} name={p} di={di} pi={pi}
                              onRemove={handleRemove}
                              onDragStart={(name,di,pi)=>{setDragPerson(name);setDragSrc({di,pi});}}
                              onDragEnd={()=>{setDragPerson(null);setDragOver(null);}}
                            />
                          ))}
                        </DropZone>
                      )}
                    </div>
                  ))}
                  {/* Add pod */}
                  <button onClick={()=>setAddPodDi(di)} style={{display:"flex",alignItems:"center",gap:5,padding:"5px 9px",border:`0.5px dashed ${B.lgray}`,borderRadius:7,background:"transparent",color:"#aaa",fontSize:10,cursor:"pointer",width:"100%",fontFamily:"'Open Sans',sans-serif"}}>
                    + Add pod
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add pod modal */}
      {addPodDi !== null && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.3)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:500}} onClick={()=>setAddPodDi(null)}>
          <div style={{background:B.white,borderRadius:12,padding:24,width:360}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:14,fontWeight:700,fontFamily:"'Poppins',sans-serif",marginBottom:14}}>Add pod</div>
            <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:".05em",color:"#888",marginBottom:5}}>Pod lead name</div>
            <input autoFocus value={newPodName} onChange={e=>setNewPodName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addPod()}
              style={{width:"100%",padding:"9px 11px",border:`0.5px solid ${B.lgray}`,borderRadius:7,fontSize:12,fontFamily:"'Open Sans',sans-serif",outline:"none",marginBottom:16}}
              placeholder="e.g. Sarah Kim" />
            <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
              <button onClick={()=>setAddPodDi(null)} style={{fontSize:11,padding:"5px 12px",border:`0.5px solid ${B.lgray}`,borderRadius:6,background:"transparent",cursor:"pointer"}}>Cancel</button>
              <button onClick={addPod} style={{fontSize:11,padding:"5px 12px",background:B.teal,color:B.white,border:"none",borderRadius:6,cursor:"pointer"}}>Add pod</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Utilization tab ──────────────────────────────────────────────────────────────
function UtilizationTab({ H, hState }) {
  const today = new Date();
  const [uData, setUData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()+1);
  const [view, setView] = useState("director");
  const [sort, setSort] = useState("name");
  const [sortDir, setSortDir] = useState(1);
  const [expanded, setExpanded] = useState({});

  const ucol = p => p>=90?{bg:B.greenBg,tx:B.greenTx}:p>=70?{bg:B.amberBg,tx:B.amberTx}:{bg:B.redBg,tx:B.redTx};

  const load = useCallback(async (y,m) => {
    setLoading(true); setUData(null);
    const ms=y+"-"+String(m).padStart(2,"0")+"-01";
    const me=y+"-"+String(m).padStart(2,"0")+"-"+new Date(y,m,0).getDate();
    const SRC="('Managed Services','Post Project Managed Services','Network')";
    try {
      const [bill,vac,cred] = await Promise.all([
        callSF(`SELECT pse__Resource__r.Name resource,pse__Project__r.pse__Group__r.Name grp,pse__Project__r.pse__Project_Manager__r.Name pm,SUM(pse__Total_Hours__c) hours,SUM(Total_Billable_Amount_Formula__c) revenue FROM pse__Timecard__c WHERE pse__Approved__c=true AND pse__Billable__c=true AND Project_Source__c IN ${SRC} AND pse__Start_Date__c>=${ms} AND pse__Start_Date__c<=${me} GROUP BY pse__Resource__r.Name,pse__Project__r.pse__Group__r.Name,pse__Project__r.pse__Project_Manager__r.Name`),
        callSF(`SELECT pse__Resource__r.Name resource,SUM(pse__Total_Hours__c) hours FROM pse__Timecard__c WHERE pse__Approved__c=true AND pse__Project__r.Name='Internal - Vacation Time' AND pse__Start_Date__c>=${ms} AND pse__Start_Date__c<=${me} GROUP BY pse__Resource__r.Name`),
        callSF(`SELECT pse__Resource__r.Name resource,SUM(pse__Total_Hours__c) hours FROM pse__Timecard__c WHERE pse__Approved__c=true AND pse__Time_Credited__c=true AND Project_Source__c IN ${SRC} AND pse__Start_Date__c>=${ms} AND pse__Start_Date__c<=${me} GROUP BY pse__Resource__r.Name`)
      ]);
      const hols = getEnabledHols(y,"CA",hState);
      const wd=calcWD(y,m,hols), wde=calcWDElapsed(y,m,hols), cap=wde*8;
      const ppl={};
      (bill?.records||[]).forEach(r=>{if(!r.resource)return;if(!ppl[r.resource])ppl[r.resource]={name:r.resource,b:0,cr:0,v:0,rev:0,dirName:null,podName:null};ppl[r.resource].b+=(r.hours||0);ppl[r.resource].rev+=(r.revenue||0);});
      (vac?.records||[]).forEach(r=>{if(!r.resource)return;if(!ppl[r.resource])ppl[r.resource]={name:r.resource,b:0,cr:0,v:0,rev:0,dirName:null,podName:null};ppl[r.resource].v+=(r.hours||0);});
      (cred?.records||[]).forEach(r=>{if(!r.resource)return;if(!ppl[r.resource])ppl[r.resource]={name:r.resource,b:0,cr:0,v:0,rev:0,dirName:null,podName:null};ppl[r.resource].cr+=(r.hours||0);});
      if(H){H.directors.forEach(dir=>{dir.pods.forEach(pod=>{pod.members.forEach(mn=>{if(ppl[mn]){ppl[mn].dirName=dir.name;ppl[mn].podName=pod.name;}});});(dir.directMembers||[]).forEach(mn=>{if(ppl[mn]){ppl[mn].dirName=dir.name;ppl[mn].podName=dir.name.split(" ")[0]+" (direct)";}});});}
      Object.values(ppl).forEach(p=>{p.util=cap>0?Math.min(((p.b+p.cr)/cap)*100,150):0;});
      setUData({people:Object.values(ppl),wd,wde,cap,m,y});
    } catch(e) { console.error(e); }
    setLoading(false);
  }, [H, hState]);

  useEffect(()=>{ load(year,month); },[]);

  const sortFn = (a,b) => {
    if(sort==="util") return (b.util-a.util)*sortDir;
    if(sort==="hrs") return (b.b-a.b)*sortDir;
    if(sort==="rev") return (b.rev-a.rev)*sortDir;
    return a.name.localeCompare(b.name)*sortDir;
  };
  const toggleSort = f => { if(sort===f) setSortDir(d=>d*-1); else { setSort(f); setSortDir(1); } };
  const sa = f => sort===f?(sortDir===1?" ↑":" ↓"):"";

  const cols = "160px 68px 1fr 58px 58px 58px 68px";
  const thS = {fontSize:9,color:"#aaa",textTransform:"uppercase",letterSpacing:".04em",padding:"6px 12px",cursor:"pointer",whiteSpace:"nowrap",fontFamily:"'Open Sans',sans-serif"};

  if (loading) return <Spinner msg="Loading utilization data..." />;
  if (!uData) return (
    <div style={{textAlign:"center",padding:40}}>
      <button onClick={()=>load(year,month)} style={{fontSize:12,padding:"8px 20px",background:B.teal,color:B.white,border:"none",borderRadius:6,cursor:"pointer"}}>Load utilization</button>
    </div>
  );

  const {people,wd,wde,cap,m,y} = uData;
  const lbl = MONTHS[m-1]+" "+y;
  const tB=people.reduce((s,p)=>s+p.b,0), tC=people.reduce((s,p)=>s+p.cr,0), tV=people.reduce((s,p)=>s+p.v,0), tR=people.reduce((s,p)=>s+p.rev,0);
  const tCap=people.length*cap, tU=tCap>0?((tB+tC)/tCap*100):0;
  const tu=ucol(tU);

  const bD={}, bP={};
  people.forEach(p=>{
    const dn=p.dirName||"Unassigned", pk=dn+":::"+(p.podName||"Direct");
    if(!bD[dn])bD[dn]={b:0,cr:0,v:0,rev:0,n:0};
    bD[dn].b+=p.b;bD[dn].cr+=p.cr;bD[dn].v+=p.v;bD[dn].rev+=p.rev;bD[dn].n++;
    if(!bP[pk])bP[pk]={name:p.podName||"Direct",dir:dn,b:0,cr:0,v:0,rev:0,n:0};
    bP[pk].b+=p.b;bP[pk].cr+=p.cr;bP[pk].v+=p.v;bP[pk].rev+=p.rev;bP[pk].n++;
  });

  const sorted = [...people].sort(sortFn);

  const Bar = ({b,cr,v,total}) => {
    const bP=total>0?Math.min((b/total)*100,100):0, crP=total>0?Math.min((cr/total)*100,8):0, vP=total>0?Math.min((v/total)*100,20):0;
    return (
      <div style={{padding:"0 8px",display:"flex",alignItems:"center"}}>
        <div style={{flex:1,height:6,background:B.lgray,borderRadius:3,display:"flex",overflow:"hidden"}}>
          <div style={{width:`${bP}%`,background:B.teal,height:"100%"}}/>
          <div style={{width:`${crP}%`,background:B.purpleBg,height:"100%"}}/>
          <div style={{width:`${vP}%`,background:B.yellow,height:"100%"}}/>
        </div>
      </div>
    );
  };

  const PersonRow = ({p, indent}) => {
    const c=ucol(p.util), a=ac(p.name);
    return (
      <div style={{display:"grid",gridTemplateColumns:cols,padding:`6px 12px 6px ${indent?"26px":"12px"}`,borderBottom:`0.5px solid ${B.lgray}`,alignItems:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:6,overflow:"hidden"}}>
          <div style={{width:18,height:18,borderRadius:"50%",background:a.bg,color:a.tx,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:700,flexShrink:0}}>{ini(p.name)}</div>
          <span style={{fontSize:11,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",fontFamily:"'Open Sans',sans-serif"}}>{p.name.split(" ")[0]} {p.name.split(" ").slice(-1)[0]}</span>
        </div>
        <div style={{textAlign:"right"}}><span style={{fontSize:11,fontWeight:700,padding:"2px 6px",borderRadius:5,background:c.bg,color:c.tx}}>{Math.round(p.util)}%</span></div>
        <Bar b={p.b} cr={p.cr} v={p.v} total={cap}/>
        <div style={{textAlign:"right",fontSize:11,fontFamily:"'Open Sans',sans-serif"}}>{Math.round(p.b)}</div>
        <div style={{textAlign:"right",fontSize:11,color:"#888",fontFamily:"'Open Sans',sans-serif"}}>{Math.round(p.cr)||"—"}</div>
        <div style={{textAlign:"right",fontSize:11,color:p.v>0?B.amber:"#ccc",fontFamily:"'Open Sans',sans-serif"}}>{Math.round(p.v)||"—"}</div>
        <div style={{textAlign:"right",fontSize:11,fontFamily:"'Open Sans',sans-serif"}}>{fmtK(p.rev)}</div>
      </div>
    );
  };

  const GroupRow = ({name, d, util, ppl2, gkey}) => {
    const c=ucol(util), dCap=d.n*cap;
    const isExp = expanded[gkey];
    return (
      <div style={{borderBottom:`0.5px solid ${B.lgray}`}}>
        <div onClick={()=>setExpanded(e=>({...e,[gkey]:!e[gkey]}))} style={{display:"grid",gridTemplateColumns:cols,padding:"8px 12px",background:B.offwhite,cursor:"pointer",alignItems:"center"}}>
          <div style={{fontSize:12,fontWeight:700,fontFamily:"'Poppins',sans-serif",display:"flex",alignItems:"center",gap:5}}>
            <span style={{fontSize:10,color:"#bbb",transform:isExp?"rotate(90deg)":"none",transition:"transform .15s",display:"inline-block"}}>▶</span>
            {name.trim()}
            <span style={{fontSize:9,padding:"1px 5px",borderRadius:5,background:B.lgray,color:"#888"}}>{d.n}</span>
          </div>
          <div style={{textAlign:"right",fontSize:12,fontWeight:700,color:c.tx,fontFamily:"'Poppins',sans-serif"}}>{Math.round(util)}%</div>
          <Bar b={d.b} cr={d.cr} v={d.v} total={dCap}/>
          <div style={{textAlign:"right",fontSize:11}}>{Math.round(d.b)}</div>
          <div style={{textAlign:"right",fontSize:11,color:"#888"}}>{Math.round(d.cr)||"—"}</div>
          <div style={{textAlign:"right",fontSize:11,color:d.v>0?B.amber:"#ccc"}}>{Math.round(d.v)||"—"}</div>
          <div style={{textAlign:"right",fontSize:11}}>{fmtK(d.rev)}</div>
        </div>
        {isExp && ppl2.map(p=><PersonRow key={p.name} p={p} indent/>)}
      </div>
    );
  };

  let tableRows;
  if (view==="director") {
    tableRows = ["Aldus Behan","Meghan Saunders","Tatiane Sensini","Unassigned"].filter(dn=>bD[dn]).map(dn=>{
      const d=bD[dn], dc=d.n*cap, du=dc>0?((d.b+d.cr)/dc*100):0;
      return <GroupRow key={dn} name={dn} d={d} util={du} ppl2={sorted.filter(p=>(p.dirName||"Unassigned")===dn)} gkey={dn}/>;
    });
  } else if (view==="pod") {
    tableRows = ["Aldus Behan","Meghan Saunders","Tatiane Sensini","Unassigned"].filter(dn=>bD[dn]).flatMap(dn=>{
      const header = <div key={"hdr-"+dn} style={{background:"#F0FAFA",borderBottom:`0.5px solid ${B.lgray}`,borderTop:`0.5px solid ${B.lgray}`,padding:"5px 12px",fontSize:10,fontWeight:700,fontFamily:"'Poppins',sans-serif",color:B.teal}}>{dn.split(" ")[0]}</div>;
      const pods = Object.entries(bP).filter(([k])=>k.startsWith(dn+":::")).map(([k,pod])=>{
        const pc=pod.n*cap, pu=pc>0?((pod.b+pod.cr)/pc*100):0;
        return <GroupRow key={k} name={"  "+pod.name} d={pod} util={pu} ppl2={sorted.filter(p=>(p.dirName||"Unassigned")===dn&&(p.podName||"Direct")===pod.name)} gkey={k}/>;
      });
      return [header, ...pods];
    });
  } else {
    tableRows = sorted.map(p=><PersonRow key={p.name} p={p} indent={false}/>);
  }

  const monthOpts = [];
  for(let i=0;i<24;i++){
    let mo=today.getMonth()+1-i, yr=today.getFullYear();
    while(mo<=0){mo+=12;yr--;}
    monthOpts.push({value:`${yr}-${mo}`,label:`${MONTHS[mo-1]} ${yr}`,yr,mo});
  }

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,flexWrap:"wrap",gap:8}}>
        <div style={{fontSize:15,fontWeight:700,fontFamily:"'Poppins',sans-serif"}}>Utilization</div>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <select value={`${year}-${month}`} onChange={e=>{const[yr,mo]=e.target.value.split("-").map(Number);setYear(yr);setMonth(mo);load(yr,mo);}}
            style={{fontSize:11,padding:"4px 8px",border:`0.5px solid ${B.lgray}`,borderRadius:6,background:B.white,fontFamily:"'Open Sans',sans-serif"}}>
            {monthOpts.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <div style={{display:"flex",border:`0.5px solid ${B.lgray}`,borderRadius:6,overflow:"hidden"}}>
            {["director","pod","person"].map(v=>(
              <button key={v} onClick={()=>setView(v)} style={{fontSize:10,padding:"4px 9px",background:view===v?B.teal:"transparent",color:view===v?B.white:"#888",border:"none",cursor:"pointer"}}>{v[0].toUpperCase()+v.slice(1)}</button>
            ))}
          </div>
          <button onClick={()=>load(year,month)} style={{fontSize:11,padding:"5px 10px",border:`0.5px solid ${B.lgray}`,borderRadius:6,background:"transparent",cursor:"pointer"}}>↺</button>
        </div>
      </div>

      {wde<wd && <div style={{fontSize:10,color:"#888",background:B.offwhite,borderRadius:7,padding:"5px 10px",marginBottom:10}}>📅 {lbl} · {wde} of {wd} working days elapsed · Utilization vs capacity to date</div>}

      <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:8,marginBottom:14}}>
        {[
          {label:"Team utilization",val:Math.round(tU)+"%",sub:`${lbl} · ${wde} days`,valColor:tu.tx},
          {label:"Billable hours",val:Math.round(tB).toLocaleString(),sub:`+ ${Math.round(tC)} credited`},
          {label:"Vacation hours",val:Math.round(tV).toLocaleString(),sub:`${people.filter(p=>p.v>0).length} people out`,valColor:B.amber},
          {label:"Revenue to date",val:fmtK(tR),sub:"CAD · approved"},
        ].map(({label,val,sub,valColor})=>(
          <div key={label} style={{background:B.offwhite,borderRadius:8,padding:"10px 12px"}}>
            <div style={{fontSize:10,color:"#888",textTransform:"uppercase",letterSpacing:".05em",marginBottom:3,fontFamily:"'Open Sans',sans-serif"}}>{label}</div>
            <div style={{fontSize:20,fontWeight:700,fontFamily:"'Poppins',sans-serif",lineHeight:1,color:valColor||B.black}}>{val}</div>
            <div style={{fontSize:10,color:"#aaa",marginTop:2,fontFamily:"'Open Sans',sans-serif"}}>{sub}</div>
          </div>
        ))}
      </div>

      <div style={{background:B.white,border:`0.5px solid ${B.lgray}`,borderRadius:10,overflow:"hidden"}}>
        <div style={{display:"grid",gridTemplateColumns:cols,background:B.offwhite,borderBottom:`0.5px solid ${B.lgray}`}}>
          <div style={{...thS}} onClick={()=>toggleSort("name")}>Name{sa("name")}</div>
          <div style={{...thS,textAlign:"right"}} onClick={()=>toggleSort("util")}>Util%{sa("util")}</div>
          <div style={{...thS}}>
            <span style={{display:"inline-flex",gap:8,fontSize:9}}>
              <span>▓ Billable</span>
              <span style={{opacity:.5}}>▓ Credited</span>
              <span style={{color:B.amber}}>▓ Vacation</span>
            </span>
          </div>
          <div style={{...thS,textAlign:"right"}} onClick={()=>toggleSort("hrs")}>Hrs{sa("hrs")}</div>
          <div style={{...thS,textAlign:"right"}}>Credit</div>
          <div style={{...thS,textAlign:"right"}}>Vac</div>
          <div style={{...thS,textAlign:"right"}} onClick={()=>toggleSort("rev")}>Rev{sa("rev")}</div>
        </div>
        {tableRows}
      </div>

      <div style={{marginTop:8,fontSize:10,color:"#aaa",fontFamily:"'Open Sans',sans-serif"}}>
        Capacity = {wde} elapsed working days × 8 hrs · CA holidays applied · Approved timecards only
      </div>
    </div>
  );
}

// ── Controls bar (shared across Actuals + Forecast) ─────────────────────────────
function ControlsBar({ mode, setMode, periodA, setPeriodA, periodB, setPeriodB, monthOpts, quarterOpts }) {
  const opts = mode==="mom" ? monthOpts : quarterOpts;
  useEffect(()=>{
    if(!opts.length) return;
    setPeriodA(opts[0]); setPeriodB(opts[1]);
  },[mode]);

  const wdLine = periodA && periodB
    ? `${periodA.label} — ${periodA.wd} working days (CA)  ·  ${periodB.label} — ${periodB.wd} working days (CA)`
    : "";

  return (
    <div style={{marginBottom:14}}>
      <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
        <div style={{display:"flex",border:`0.5px solid ${B.lgray}`,borderRadius:6,overflow:"hidden",flexShrink:0}}>
          <Pill active={mode==="mom"} onClick={()=>setMode("mom")}>MoM</Pill>
          <Pill active={mode==="qoq"} onClick={()=>setMode("qoq")}>QoQ</Pill>
        </div>
        <div style={{width:1,height:20,background:B.lgray,flexShrink:0}}/>
        <div style={{display:"flex",alignItems:"center",gap:4,border:`0.5px solid ${B.lgray}`,borderRadius:6,padding:"0 8px",height:28}}>
          <span style={{fontSize:10,color:"#bbb",textTransform:"uppercase",letterSpacing:".04em",whiteSpace:"nowrap",fontFamily:"'Open Sans',sans-serif"}}>A</span>
          <select value={periodA?.id||""} onChange={e=>setPeriodA(opts.find(o=>o.id===e.target.value))}
            style={{fontSize:11,background:"transparent",border:"none",color:B.black,cursor:"pointer",fontFamily:"'Open Sans',sans-serif",outline:"none",maxWidth:110}}>
            {opts.map(o=><option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </div>
        <span style={{fontSize:11,color:"#bbb",fontFamily:"'Open Sans',sans-serif"}}>vs</span>
        <div style={{display:"flex",alignItems:"center",gap:4,border:`0.5px solid ${B.lgray}`,borderRadius:6,padding:"0 8px",height:28}}>
          <span style={{fontSize:10,color:"#bbb",textTransform:"uppercase",letterSpacing:".04em",whiteSpace:"nowrap",fontFamily:"'Open Sans',sans-serif"}}>B</span>
          <select value={periodB?.id||""} onChange={e=>setPeriodB(opts.find(o=>o.id===e.target.value))}
            style={{fontSize:11,background:"transparent",border:"none",color:B.black,cursor:"pointer",fontFamily:"'Open Sans',sans-serif",outline:"none",maxWidth:110}}>
            {opts.map(o=><option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </div>
      </div>
      {wdLine && <div style={{fontSize:10,color:"#bbb",marginTop:5,paddingLeft:2,fontFamily:"'Open Sans',sans-serif"}}>{wdLine}</div>}
    </div>
  );
}

// ── Audit panel (slide-in) ───────────────────────────────────────────────────────
const AUDIT_DEFS = {
  rpd:{title:"Revenue per day (RPD)",formula:"SUM(Total_Billable_Amount_Formula__c) ÷ working days",detail:"Approved billable timecard splits only. Project sources: Managed Services, Post Project Managed Services, Network. Working days calculated from CA holiday calendar in Options.",soql:`SELECT SUM(Total_Billable_Amount_Formula__c) revenue\nFROM pse__Timecard__c\nWHERE pse__Approved__c = true\n  AND pse__Billable__c = true\n  AND Project_Source__c IN (\n    'Managed Services',\n    'Post Project Managed Services',\n    'Network'\n  )\n  AND pse__Start_Date__c >= [start]\n  AND pse__Start_Date__c <= [end]`},
  ceiling:{title:"Full utilization ceiling",formula:"Active billable resources × 8 hrs × working days × effective rate",detail:"Pulls all resources with active billable Scheduled assignments on managed service projects this month. Effective rate = pse__Bill_Rate__c if > 0, else pse__Planned_Bill_Rate__c. Assumes 8 hrs/working day at 100% capacity. No deductions for vacation, credited time, or bench.",soql:`SELECT pse__Resource__c,\n  pse__Bill_Rate__c,\n  pse__Planned_Bill_Rate__c\nFROM pse__Assignment__c\nWHERE pse__Is_Billable__c = true\n  AND pse__Status__c = 'Scheduled'\n  AND pse__Project__r.Project_Source__c\n    IN ('Managed Services', ...)\n  AND pse__Start_Date__c <= [month_end]\n  AND pse__End_Date__c >= [month_start]`},
  vacation:{title:"Vacation hours",formula:"Approved timecards on 'Internal - Vacation Time' project",detail:"Sums pse__Total_Hours__c from approved timecard splits where the project name equals 'Internal - Vacation Time'. Revenue impact is estimated: vacation hrs × resource's avg bill rate from trailing 4 weeks of billable managed services timecards.",soql:`SELECT pse__Resource__r.Name,\n  SUM(pse__Total_Hours__c) hrs\nFROM pse__Timecard__c\nWHERE pse__Approved__c = true\n  AND pse__Project__r.Name\n    = 'Internal - Vacation Time'\n  AND pse__Start_Date__c >= [start]\n  AND pse__Start_Date__c <= [end]\nGROUP BY pse__Resource__r.Name`},
  forecast:{title:"Forecast remaining revenue",formula:"Remaining scheduled assignment hours × effective bill rate",detail:"Active Scheduled assignments overlapping the remaining working days of the current month. Rate = Bill_Rate__c if > 0, else Planned_Bill_Rate__c. Hours prorated: Scheduled_Hours × (overlap days / total assignment days). Excludes vacation assignments.",soql:`SELECT pse__Resource__c,\n  pse__Scheduled_Hours__c,\n  pse__Bill_Rate__c,\n  pse__Planned_Bill_Rate__c,\n  pse__Start_Date__c,\n  pse__End_Date__c\nFROM pse__Assignment__c\nWHERE pse__Is_Billable__c = true\n  AND pse__Status__c = 'Scheduled'\n  AND pse__Project__r.Name\n    != 'Internal - Vacation Time'\n  AND pse__End_Date__c >= [today]\n  AND pse__Start_Date__c <= [month_end]`},
  working_days:{title:"Working days",formula:"Weekdays in period minus enabled statutory holidays",detail:"Client-side calculation. Counts Mon–Fri for the selected period, then subtracts any CA holidays toggled ON in Options. US holidays available separately. Toggle holidays off to exclude them from the working day count.",soql:"No Salesforce query — calculated from the Options holiday calendar."},
  pod_rpd:{title:"Pod RPD",formula:"Pod revenue ÷ working days. Pod = timecards grouped by Project Manager.",detail:"Groups approved billable timecard splits by pse__Project__r.pse__Project_Manager__r.Name within the director's Group. PM field used as pod signal — more reliable than Practice for Meghan's team. Tati's accounts (Fiix, MLG) included in global total only.",soql:`SELECT\n  pse__Project__r.pse__Project_Manager__r.Name pm,\n  SUM(Total_Billable_Amount_Formula__c) rev\nFROM pse__Timecard__c\nWHERE pse__Approved__c = true\n  AND pse__Billable__c = true\n  AND pse__Project__r.pse__Group__r.Name\n    = '[director]'\n  AND pse__Start_Date__c >= [start]\nGROUP BY\n  pse__Project__r.pse__Project_Manager__r.Name`},
  variance:{title:"RPD variance",formula:"(Period A RPD − Period B RPD) ÷ Period B RPD × 100",detail:"Day-normalized comparison. Raw revenue variance can be misleading when months have different working day counts — RPD variance controls for that. A month with more working days will naturally have more revenue even at the same daily rate.",soql:"Calculated from two separate Salesforce queries — one per period — then divided by their respective working day counts before comparing."},
};

function AuditPanel({ auditKey, onClose }) {
  const e = AUDIT_DEFS[auditKey];
  if(!e) return null;
  return (
    <div style={{position:"fixed",top:0,right:0,width:380,height:"100vh",background:B.white,borderLeft:`1px solid ${B.lgray}`,zIndex:1000,overflowY:"auto",padding:22,boxSizing:"border-box",fontFamily:"'Open Sans',sans-serif"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18}}>
        <div style={{fontSize:13,fontWeight:700,fontFamily:"'Poppins',sans-serif",color:B.black}}>{e.title}</div>
        <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",fontSize:20,color:"#aaa",lineHeight:1}}>×</button>
      </div>
      <div style={{marginBottom:14}}>
        <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:".05em",color:"#aaa",marginBottom:5}}>Formula</div>
        <div style={{fontSize:12,fontWeight:600,color:B.teal,background:B.offwhite,borderRadius:6,padding:"8px 10px"}}>{e.formula}</div>
      </div>
      <div style={{marginBottom:14}}>
        <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:".05em",color:"#aaa",marginBottom:5}}>How it works</div>
        <div style={{fontSize:12,color:"#444",lineHeight:1.65}}>{e.detail}</div>
      </div>
      <div style={{marginBottom:14}}>
        <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:".05em",color:"#aaa",marginBottom:5}}>Source query</div>
        <pre style={{fontSize:10,color:"#333",background:B.offwhite,borderRadius:6,padding:"10px 12px",overflowX:"auto",borderLeft:`3px solid ${B.teal}`,margin:0,lineHeight:1.65,fontFamily:"monospace",whiteSpace:"pre-wrap"}}>{e.soql}</pre>
      </div>
      <div style={{background:B.offwhite,borderRadius:6,padding:"10px 12px",fontSize:11,color:"#888",lineHeight:1.5}}>
        <strong style={{color:B.black}}>Objects:</strong> pse__Timecard__c, pse__Assignment__c, pse__Proj__c, pse__Grp__c, pse__Practice__c. All values in CAD via Total_Billable_Amount_Formula__c.
      </div>
    </div>
  );
}

// ── Main export ──────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const today = new Date();

  // Global state
  const [tab, setTab]           = useState("hierarchy");
  const [mode, setMode]         = useState("mom");
  const [hState, setHState]     = useState({});
  const [auditKey, setAuditKey] = useState(null);

  // Shared team hierarchy (used by Hierarchy + Utilization tabs)
  const [H, setH]               = useState(null);
  const [status, setStatus]     = useState({msg:"Loading...",type:""});
  const [saveStatus, setSaveStatus] = useState("");
  const syncRef = useRef(null);

  const monthOpts   = genMonthOpts(hState);
  const quarterOpts = genQuarterOpts(hState);

  const [periodA, setPeriodA] = useState(monthOpts[0]);
  const [periodB, setPeriodB] = useState(monthOpts[1]);

  // Actuals drill state
  const [drillPath, setDrillPath] = useState([]);
  const [podView, setPodView]     = useState("pod");
  const [expandedPods, setExpandedPods] = useState({});

  // Data state
  const [dataA, setDataA]       = useState(null);
  const [dataB, setDataB]       = useState(null);
  const [vacData, setVacData]   = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [auditData, setAuditData]   = useState(null);
  const [loading, setLoading]       = useState(false);
  const [loadMsg, setLoadMsg]       = useState("");
  const [sfError, setSfError]       = useState(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditChecked, setAuditChecked] = useState({});
  const [holYear, setHolYear]   = useState(today.getFullYear());

  const SRC = `('Managed Services','Post Project Managed Services','Network')`;
  const BASE = `pse__Approved__c = true AND pse__Billable__c = true AND Project_Source__c IN ${SRC}`;

  const DIRECTORS = ["Aldus Behan","Meghan Saunders","Tatiane Sensini"];
  const TATI_GROUPS = ["Tatiane Sensini","Lane Four"];

  // ── Save hierarchy to Drive ────────────────────────────────────────────────────
  const saveHierarchy = async () => {
    if (!H) return;
    setSaveStatus("Saving...");
    try {
      const content = JSON.stringify(H, null, 2);
      await callDrive('In Google Drive folder ID "'+FOLDER_ID+'", create or replace a file named "hierarchy.json" with this exact JSON content:\n\n'+content+'\n\nConfirm success.');
      setSaveStatus("Saved " + new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}));
      setStatus({msg:"Synced with Drive",type:"g"});
    } catch(e) { setSaveStatus("Save failed"); }
  };

  // ── Period date range helper ─────────────────────────────────────────────────────
  function periodRange(p) {
    if(!p) return null;
    if(p.month) {
      const lastDay = new Date(p.year, p.month, 0).getDate();
      return { start:`${p.year}-${String(p.month).padStart(2,"0")}-01`, end:`${p.year}-${String(p.month).padStart(2,"0")}-${lastDay}` };
    }
    if(p.months) {
      const first=p.months[0], last=p.months[2];
      const lastDay=new Date(last.y,last.m,0).getDate();
      return { start:`${first.y}-${String(first.m).padStart(2,"0")}-01`, end:`${last.y}-${String(last.m).padStart(2,"0")}-${lastDay}` };
    }
    return null;
  }

  // ── Fetch a period's data ────────────────────────────────────────────────────────
  async function fetchPeriod(p) {
    const r = periodRange(p);
    if(!r) return null;
    const byPM = await callSF(`SELECT pse__Project__r.pse__Group__r.Name grp, pse__Project__r.pse__Project_Manager__r.Name pm, SUM(Total_Billable_Amount_Formula__c) revenue, SUM(pse__Total_Hours__c) hours, COUNT(Id) splits FROM pse__Timecard__c WHERE ${BASE} AND pse__Start_Date__c >= ${r.start} AND pse__Start_Date__c <= ${r.end} GROUP BY pse__Project__r.pse__Group__r.Name, pse__Project__r.pse__Project_Manager__r.Name ORDER BY pse__Project__r.pse__Group__r.Name`);
    const byProj = await callSF(`SELECT pse__Project__r.Name proj, pse__Project__r.pse__Account__r.Name acct, pse__Project__r.pse__Group__r.Name grp, pse__Project__r.pse__Project_Manager__r.Name pm, pse__Project__c projId, SUM(Total_Billable_Amount_Formula__c) revenue, SUM(pse__Total_Hours__c) hours, MAX(pse__Time_Credited__c) credited FROM pse__Timecard__c WHERE ${BASE} AND pse__Start_Date__c >= ${r.start} AND pse__Start_Date__c <= ${r.end} GROUP BY pse__Project__r.Name, pse__Project__r.pse__Account__r.Name, pse__Project__r.pse__Group__r.Name, pse__Project__r.pse__Project_Manager__r.Name, pse__Project__c ORDER BY SUM(Total_Billable_Amount_Formula__c) DESC`);
    const credited = await callSF(`SELECT pse__Project__r.pse__Group__r.Name grp, pse__Project__r.pse__Project_Manager__r.Name pm, SUM(pse__Total_Hours__c) hours FROM pse__Timecard__c WHERE pse__Approved__c = true AND pse__Time_Credited__c = true AND Project_Source__c IN ${SRC} AND pse__Start_Date__c >= ${r.start} AND pse__Start_Date__c <= ${r.end} GROUP BY pse__Project__r.pse__Group__r.Name, pse__Project__r.pse__Project_Manager__r.Name`);

    const pmMap={}, projList=byProj?.records||[], creditMap={};
    (byPM?.records||[]).forEach(r=>{
      const g=r.grp||"Other", pm=r.pm||"Unknown";
      if(!pmMap[g]) pmMap[g]={revenue:0,hours:0,splits:0,pms:{}};
      pmMap[g].revenue+=(r.revenue||0); pmMap[g].hours+=(r.hours||0); pmMap[g].splits+=(r.splits||0);
      if(!pmMap[g].pms[pm]) pmMap[g].pms[pm]={revenue:0,hours:0,splits:0};
      pmMap[g].pms[pm].revenue+=(r.revenue||0); pmMap[g].pms[pm].hours+=(r.hours||0); pmMap[g].pms[pm].splits+=(r.splits||0);
    });
    (credited?.records||[]).forEach(r=>{ const g=r.grp||"Other", pm=r.pm||"Unknown"; creditMap[`${g}::${pm}`]=(creditMap[`${g}::${pm}`]||0)+(r.hours||0); });
    return { pmMap, projList, creditMap };
  }

  async function fetchVac(p) {
    const r=periodRange(p); if(!r) return [];
    const res = await callSF(`SELECT pse__Resource__r.Name resource, pse__Project__r.pse__Group__r.Name grp, pse__Project__r.pse__Project_Manager__r.Name pm, SUM(pse__Total_Hours__c) hours FROM pse__Timecard__c WHERE pse__Approved__c = true AND pse__Project__r.Name = 'Internal - Vacation Time' AND pse__Start_Date__c >= ${r.start} AND pse__Start_Date__c <= ${r.end} GROUP BY pse__Resource__r.Name, pse__Project__r.pse__Group__r.Name, pse__Project__r.pse__Project_Manager__r.Name`);
    return res?.records||[];
  }

  async function fetchDetail(p) {
    const r=periodRange(p); if(!r) return [];
    const res = await callSF(`SELECT pse__Resource__r.Name resource, pse__Project__r.Name proj, pse__Project__r.pse__Account__r.Name acct, pse__Project__r.pse__Group__r.Name grp, pse__Project__r.pse__Project_Manager__r.Name pm, pse__Total_Hours__c hours, Total_Billable_Amount_Formula__c revenue, pse__Billable__c billable, pse__Time_Credited__c credited, pse__Start_Date__c startDate, Project_Source__c src, Id recordId FROM pse__Timecard__c WHERE pse__Approved__c = true AND pse__Start_Date__c >= ${r.start} AND pse__Start_Date__c <= ${r.end} AND (Project_Source__c IN ${SRC} OR pse__Project__r.Name = 'Internal - Vacation Time') ORDER BY pse__Start_Date__c DESC LIMIT 200`);
    return res?.records||[];
  }

  async function fetchAuditData() {
    setAuditLoading(true);
    try {
      const zeroRates = await callSF(`SELECT Id, Name, pse__Resource__r.Name resource, pse__Project__r.Name proj, pse__Project__r.pse__Group__r.Name grp, pse__Bill_Rate__c billRate, pse__Planned_Bill_Rate__c plannedRate, pse__Status__c status FROM pse__Assignment__c WHERE pse__Is_Billable__c = true AND pse__Status__c = 'Scheduled' AND pse__Bill_Rate__c = 0 AND pse__Planned_Bill_Rate__c = 0 AND pse__Project__r.Project_Source__c IN ${SRC} LIMIT 50`);
      const zeroRevSplits = await callSF(`SELECT Id, Name, pse__Resource__r.Name resource, pse__Project__r.Name proj, pse__Project__r.pse__Group__r.Name grp, pse__Total_Hours__c hours, Total_Billable_Amount_Formula__c revenue, pse__Start_Date__c startDate FROM pse__Timecard__c WHERE pse__Approved__c = true AND pse__Billable__c = true AND Total_Billable_Amount_Formula__c = 0 AND pse__Total_Hours__c > 0 AND Project_Source__c IN ${SRC} AND pse__Start_Date__c >= 2026-01-01 LIMIT 50`);
      const nullSrc = await callSF(`SELECT Id, Name, pse__Account__r.Name acct, pse__Group__r.Name grp, pse__Project_Manager__r.Name pm, Project_Source__c src, pse__Stage__c stage FROM pse__Proj__c WHERE Project_Source__c = null AND pse__Stage__c NOT IN ('Closed','Cancelled','Lost') AND pse__Group__r.Name IN ('Aldus Behan','Meghan Saunders','Tatiane Sensini') LIMIT 50`);
      const formulaDrift = await callSF(`SELECT Id, Name, pse__Resource__r.Name resource, pse__Project__r.Name proj, CAD_Revenue__c cadRevenue, Total_Billable_Amount_Formula__c formulaRevenue, pse__Start_Date__c startDate FROM pse__Timecard__c WHERE pse__Approved__c = true AND pse__Billable__c = true AND CAD_Revenue__c != Total_Billable_Amount_Formula__c AND Total_Billable_Amount_Formula__c > 0 AND Project_Source__c IN ${SRC} AND pse__Start_Date__c >= 2026-01-01 LIMIT 50`);
      const zeroSchedHrs = await callSF(`SELECT Id, Name, pse__Resource__r.Name resource, pse__Project__r.Name proj, pse__Project__r.pse__Group__r.Name grp, pse__Scheduled_Hours__c scheduledHours, pse__Start_Date__c startDate, pse__End_Date__c endDate FROM pse__Assignment__c WHERE pse__Is_Billable__c = true AND pse__Status__c = 'Scheduled' AND pse__Scheduled_Hours__c = 0 AND pse__Project__r.Project_Source__c IN ${SRC} AND pse__End_Date__c >= 2026-01-01 LIMIT 50`);
      setAuditData({
        zeroRates: zeroRates?.records||[],
        zeroRevSplits: zeroRevSplits?.records||[],
        nullSrc: nullSrc?.records||[],
        formulaDrift: formulaDrift?.records||[],
        zeroSchedHrs: zeroSchedHrs?.records||[],
        fetchedAt: new Date().toLocaleString(),
      });
    } catch(e){ console.error(e); }
    setAuditLoading(false);
  }

  // ── Main data load ────────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if(!periodA||!periodB) return;
    setLoading(true); setSfError(null);
    try {
      setLoadMsg(`Pulling ${periodA.label} data...`);
      const a = await fetchPeriod(periodA);
      setLoadMsg(`Pulling ${periodB.label} data...`);
      const b = await fetchPeriod(periodB);
      setLoadMsg("Pulling vacation data...");
      const vac = await fetchVac(periodA);
      setLoadMsg("Pulling time detail...");
      const det = await fetchDetail(periodA);
      setDataA(a); setDataB(b); setVacData(vac); setDetailData(det);
    } catch(e){ setSfError(String(e)); }
    setLoading(false);
  }, [periodA, periodB]);

  // Only reload actuals data when on a data tab
  useEffect(()=>{ if(["actuals","forecast","detail"].includes(tab)) loadData(); },[periodA,periodB]);
  useEffect(()=>{ if(["actuals","forecast","detail"].includes(tab) && !dataA) loadData(); },[tab]);
  useEffect(()=>{ if(tab==="audit"&&!auditData) fetchAuditData(); },[tab]);

  // ── Derived helpers ────────────────────────────────────────────────────────────
  function groupTotal(pmMap, groups) {
    let rev=0, hrs=0;
    (groups||[]).forEach(g=>{ rev+=(pmMap?.[g]?.revenue||0); hrs+=(pmMap?.[g]?.hours||0); });
    return {rev,hrs};
  }
  const wdA = periodA?.wd||1;
  const wdB = periodB?.wd||1;

  // ── Actuals tab ──────────────────────────────────────────────────────────────
  function renderActuals() {
    const pA=periodA, pB=periodB;
    const lA=pA?.label||"Period A", lB=pB?.label||"Period B";
    const dirName = drillPath.find(d=>d.type==="director")?.name;
    const podName = drillPath.find(d=>d.type==="pod")?.name;
    let rows=[], colLabel="Team";

    if(!dirName) {
      colLabel="Team";
      const groups = ["Aldus Behan","Meghan Saunders","Tatiane Sensini"];
      rows = groups.map(g=>{
        const isTati = TATI_GROUPS.includes(g)||g==="Tatiane Sensini";
        const aG = groupTotal(dataA?.pmMap,[g]);
        const bG = groupTotal(dataB?.pmMap,[g]);
        return {
          id:g, label:g.split(" ")[0], fullLabel:g,
          revA:aG.rev, revB:bG.rev, hrsA:aG.hrs,
          rpdA:aG.rev/wdA, rpdB:bG.rev/wdB,
          creditedHrs:0, isTati,
          drillable:true, drillType:"director",
        };
      });
    } else if(dirName && !podName) {
      colLabel="Pod lead";
      const pms = dataA?.pmMap?.[dirName]?.pms||{};
      const pmsB = dataB?.pmMap?.[dirName]?.pms||{};
      rows = Object.entries(pms).sort((a,b)=>b[1].revenue-a[1].revenue).map(([pm,d])=>{
        const dB = pmsB[pm]||{revenue:0,hours:0};
        const creditKey=`${dirName}::${pm}`;
        return {
          id:pm, label:pm.split(" ")[0]+" "+pm.split(" ").slice(-1)[0], fullLabel:pm,
          revA:d.revenue, revB:dB.revenue, hrsA:d.hours,
          rpdA:d.revenue/wdA, rpdB:dB.revenue/wdB,
          creditedHrs:dataA?.creditMap?.[creditKey]||0,
          drillable:true, drillType:"pod",
        };
      });
    } else if(podName) {
      colLabel="Account";
      const projA = (dataA?.projList||[]).filter(p=>p.pm===podName&&p.grp===dirName);
      const projBMap={};
      (dataB?.projList||[]).filter(p=>p.pm===podName&&p.grp===dirName).forEach(p=>{ projBMap[p.projId]=(projBMap[p.projId]||0)+(p.revenue||0); });
      rows = projA.sort((a,b)=>(b.revenue||0)-(a.revenue||0)).map(p=>({
        id:p.projId, label:p.acct||p.proj||"Unknown", fullLabel:p.proj,
        revA:p.revenue||0, revB:projBMap[p.projId]||0, hrsA:p.hours||0,
        rpdA:(p.revenue||0)/wdA, rpdB:(projBMap[p.projId]||0)/wdB,
        creditedHrs:0, credited:p.credited, drillable:false,
      }));
    }

    let headlineRevA=0, headlineRevB=0, headlineHrsA=0;
    if(!dirName) {
      const aT=groupTotal(dataA?.pmMap,["Aldus Behan","Meghan Saunders","Tatiane Sensini","Lane Four"]);
      const bT=groupTotal(dataB?.pmMap,["Aldus Behan","Meghan Saunders","Tatiane Sensini","Lane Four"]);
      headlineRevA=aT.rev; headlineRevB=bT.rev; headlineHrsA=aT.hrs;
    } else if(!podName) {
      const aG=groupTotal(dataA?.pmMap,[dirName]);
      const bG=groupTotal(dataB?.pmMap,[dirName]);
      headlineRevA=aG.rev; headlineRevB=bG.rev; headlineHrsA=aG.hrs;
    } else {
      rows.forEach(r=>{ headlineRevA+=r.revA; headlineRevB+=r.revB; headlineHrsA+=r.hrsA; });
    }
    const headlineRpdA=headlineRevA/wdA, headlineRpdB=headlineRevB/wdB;
    const headlineDelta=headlineRpdB>0?((headlineRpdA-headlineRpdB)/headlineRpdB*100):null;

    return (
      <div>
        <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:10,fontSize:12,fontFamily:"'Open Sans',sans-serif"}}>
          <span style={{color:B.teal,cursor:"pointer"}} onClick={()=>setDrillPath([])}>All teams</span>
          {dirName && <>
            <span style={{color:"#ccc"}}>›</span>
            <span style={{color:podName?B.teal:B.black,fontWeight:podName?400:600,cursor:podName?"pointer":"default"}}
              onClick={()=>podName&&setDrillPath([{type:"director",name:dirName}])}>{dirName.split(" ")[0]}</span>
          </>}
          {podName && <>
            <span style={{color:"#ccc"}}>›</span>
            <span style={{color:B.black,fontWeight:600}}>{podName.split(" ")[0]}</span>
          </>}
        </div>

        {dataA && (
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:10,marginBottom:14}}>
            {[
              {label:`${lA} RPD`, val:fmt(headlineRpdA), sub:`${fmtK(headlineRevA)} revenue`, help:"Revenue per day", calc:`${lA} revenue ÷ ${wdA} working days`, ak:"rpd"},
              {label:`${lB} RPD`, val:fmt(headlineRpdB), sub:`${fmtK(headlineRevB)} revenue`, help:"Revenue per day", calc:`${lB} revenue ÷ ${wdB} working days`, ak:"rpd"},
              {label:`${lA} vs ${lB}`, val:headlineDelta!==null?fmtD(headlineDelta):"—", valColor:headlineDelta===null?"#aaa":headlineDelta>=0?B.green:B.red, sub:"RPD variance", help:"RPD variance", calc:"(A RPD − B RPD) ÷ B RPD × 100", ak:"variance"},
              {label:`${lA} hours`, val:fmtH(headlineHrsA), sub:`${fmtK(headlineRevB)} rev in ${lB}`, help:"Billable hours", calc:"Approved billable timecard splits"},
            ].map(({label,val,sub,valColor,help,calc,ak},i)=>(
              <div key={i} style={{background:B.offwhite,borderRadius:8,padding:"11px 13px",fontFamily:"'Open Sans',sans-serif"}}>
                <div style={{fontSize:10,color:"#888",textTransform:"uppercase",letterSpacing:".05em",marginBottom:4,display:"flex",alignItems:"center"}}>
                  {label} <HelpIcon tip={help} calc={calc} auditKey={ak} onAudit={setAuditKey}/>
                </div>
                <div style={{fontSize:20,fontWeight:700,color:valColor||B.black,lineHeight:1,fontFamily:"'Poppins',sans-serif"}}>{val}</div>
                <div style={{fontSize:11,color:"#aaa",marginTop:3}}>{sub}</div>
              </div>
            ))}
          </div>
        )}

        {dirName && !podName && (
          <div style={{display:"flex",gap:6,marginBottom:12,alignItems:"center"}}>
            <span style={{fontSize:11,color:"#aaa",fontFamily:"'Open Sans',sans-serif"}}>View by:</span>
            {["pod","project"].map(v=>(
              <button key={v} onClick={()=>setPodView(v)} style={{
                fontSize:11,padding:"3px 12px",borderRadius:20,cursor:"pointer",fontFamily:"'Open Sans',sans-serif",
                background:podView===v?B.black:"transparent", color:podView===v?B.white:"#888",
                border:`0.5px solid ${podView===v?B.black:B.lgray}`,
              }}>{v==="pod"?"By pod":"By project"}</button>
            ))}
          </div>
        )}

        {!dataA ? <Spinner msg={`Loading ${lA}...`}/> : (
          <div style={{background:B.white,border:`0.5px solid ${B.lgray}`,borderRadius:12,overflow:"hidden"}}>
            <div style={{display:"grid",gridTemplateColumns:"2fr 88px 88px 88px 80px 60px 56px 28px",padding:"6px 14px",background:B.offwhite,borderBottom:`0.5px solid ${B.lgray}`}}>
              {[colLabel,`${lA} rev`,`${lB} rev`,`${lA} RPD`,`${lA} vs ${lB}`,"Days A/B",`${lA} hrs`,"↑↓"].map((h,i)=>(
                <div key={i} style={{fontSize:10,color:"#aaa",textTransform:"uppercase",letterSpacing:".04em",fontFamily:"'Open Sans',sans-serif",textAlign:i>0?"right":"left"}}>{h}</div>
              ))}
            </div>
            {(podView==="project"&&dirName&&!podName
              ? (dataA?.projList||[]).filter(p=>p.grp===dirName).sort((a,b)=>(b.revenue||0)-(a.revenue||0)).map(p=>{
                  const bP=(dataB?.projList||[]).find(x=>x.projId===p.projId);
                  return {
                    id:p.projId, label:p.acct||p.proj, fullLabel:p.proj,
                    revA:p.revenue||0, revB:bP?.revenue||0, hrsA:p.hours||0,
                    rpdA:(p.revenue||0)/wdA, rpdB:(bP?.revenue||0)/wdB,
                    credited:p.credited, drillable:false,
                  };
                })
              : rows
            ).map((row,i)=>{
              const delta=row.rpdB>0?((row.rpdA-row.rpdB)/row.rpdB*100):null;
              const dColor=delta===null?"#aaa":delta>=0?B.green:B.red;
              const trend=delta===null?"—":delta>=2?"▲":delta<=-2?"▼":"→";
              const tColor=delta===null?"#ccc":delta>=2?B.green:delta<=-2?B.red:"#aaa";
              return (
                <div key={row.id||i}
                  onClick={()=>{ if(!row.drillable) return; if(row.drillType==="director") setDrillPath([{type:"director",name:row.fullLabel}]); else if(row.drillType==="pod") setDrillPath(p=>[...p,{type:"pod",name:row.fullLabel}]); }}
                  style={{display:"grid",gridTemplateColumns:"2fr 88px 88px 88px 80px 60px 56px 28px",padding:"9px 14px",borderBottom:`0.5px solid ${B.lgray}`,cursor:row.drillable?"pointer":"default",fontFamily:"'Open Sans',sans-serif",transition:"background .1s"}}
                  onMouseEnter={e=>{ if(row.drillable) e.currentTarget.style.background=B.offwhite; }}
                  onMouseLeave={e=>{ e.currentTarget.style.background="transparent"; }}
                >
                  <div style={{fontSize:12,fontWeight:600,color:row.drillable?B.teal:B.black,display:"flex",alignItems:"center",gap:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                    {row.label}
                    {row.drillable && <span style={{fontSize:10,color:"#ccc"}}>›</span>}
                    {row.credited && <Tag color={B.purpleTx} bg={B.purpleBg}>credited</Tag>}
                    {row.isTati && <Tag color="#888" bg={B.lgray}>global</Tag>}
                  </div>
                  <div style={{fontSize:12,textAlign:"right"}}>{fmtK(row.revA)}</div>
                  <div style={{fontSize:12,textAlign:"right",color:"#aaa"}}>{fmtK(row.revB)}</div>
                  <div style={{fontSize:12,fontWeight:600,textAlign:"right"}}>{fmt(row.rpdA)}</div>
                  <div style={{fontSize:12,fontWeight:600,textAlign:"right",color:dColor}}>{delta!==null?fmtD(delta):"—"}</div>
                  <div style={{fontSize:11,textAlign:"right",color:"#aaa"}}>{wdA}/{wdB}</div>
                  <div style={{fontSize:12,textAlign:"right",color:"#888"}}>{fmtH(row.hrsA)}</div>
                  <div style={{fontSize:14,textAlign:"center",color:tColor}}>{trend}</div>
                </div>
              );
            })}

            {dirName && !podName && (() => {
              const totalCredit = Object.entries(dataA?.creditMap||{}).filter(([k])=>k.startsWith(dirName)).reduce((s,[,v])=>s+v,0);
              if(totalCredit===0) return null;
              return (
                <div style={{padding:"6px 14px",background:"#FAFAFA",borderTop:`0.5px solid ${B.lgray}`,display:"flex",alignItems:"center",gap:8,fontFamily:"'Open Sans',sans-serif"}}>
                  <span style={{fontSize:10,color:"#aaa",textTransform:"uppercase",letterSpacing:".04em"}}>Credited time</span>
                  <Tag color={B.purpleTx} bg={B.purpleBg}>{fmtH(totalCredit)} hrs</Tag>
                  <HelpIcon tip="Credited hours" calc="Approved timecards with pse__Time_Credited__c = true. Shown separately — not included in RPD." auditKey="rpd" onAudit={setAuditKey}/>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    );
  }

  // ── Forecast tab ─────────────────────────────────────────────────────────────
  function renderForecast() {
    const lA=periodA?.label||"Current";
    const wdEl=periodA?.month ? calcWDElapsed(periodA.year,periodA.month,getEnabledHols(periodA.year,"CA",hState)) : 0;
    const vacTotal=(vacData||[]).reduce((s,r)=>s+(r.hours||0),0);
    const revToDate=dataA?groupTotal(dataA.pmMap,["Aldus Behan","Meghan Saunders","Tatiane Sensini","Lane Four"]).rev:0;
    const rpdToDate=wdEl>0?revToDate/wdEl:0;

    return (
      <div>
        <div style={{fontSize:11,color:"#888",background:B.offwhite,borderRadius:8,padding:"6px 12px",display:"flex",alignItems:"center",gap:6,marginBottom:14,fontFamily:"'Open Sans',sans-serif",flexWrap:"wrap"}}>
          📅 {lA} ·&nbsp; {wdEl} of {wdA} working days elapsed ({wdA>0?Math.round((wdEl/wdA)*100):0}%) ·&nbsp; Actuals = approved timecards ·&nbsp; Forecast = remaining scheduled assignments
        </div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:10,marginBottom:14}}>
          {[
            {label:`${lA} RPD to date`,val:fmt(rpdToDate),sub:`${fmtK(revToDate)} logged`,help:"RPD from actuals only",calc:"Revenue logged ÷ elapsed working days",ak:"rpd"},
            {label:"Vacation hrs",val:`${Math.round(vacTotal)} hrs`,sub:"Internal - Vacation Time",help:"Vacation hours",calc:"Approved splits on 'Internal - Vacation Time'",ak:"vacation"},
            {label:"Working days",val:`${wdEl} / ${wdA}`,sub:"elapsed / total (CA)",help:"Working days",calc:"Weekdays minus enabled CA holidays",ak:"working_days"},
            {label:"Utilization ceiling",val:`${wdA>0?Math.round((revToDate/(revToDate*1.25||1))*100):0}%`,sub:"of est. full capacity",help:"Full utilization ceiling",calc:"Actual revenue ÷ estimated max",ak:"ceiling"},
          ].map(({label,val,sub,help,calc,ak},i)=>(
            <div key={i} style={{background:B.offwhite,borderRadius:8,padding:"11px 13px",fontFamily:"'Open Sans',sans-serif"}}>
              <div style={{fontSize:10,color:"#888",textTransform:"uppercase",letterSpacing:".05em",marginBottom:4,display:"flex",alignItems:"center"}}>
                {label} <HelpIcon tip={help} calc={calc} auditKey={ak} onAudit={setAuditKey}/>
              </div>
              <div style={{fontSize:20,fontWeight:700,color:B.black,lineHeight:1,fontFamily:"'Poppins',sans-serif"}}>{val}</div>
              <div style={{fontSize:11,color:"#aaa",marginTop:3}}>{sub}</div>
            </div>
          ))}
        </div>

        {["Aldus Behan","Meghan Saunders"].map(dir=>{
          const aD=groupTotal(dataA?.pmMap,[dir]);
          const bD=groupTotal(dataB?.pmMap,[dir]);
          const vacDir=(vacData||[]).filter(r=>r.grp===dir).reduce((s,r)=>s+(r.hours||0),0);
          const ceiling=aD.rev*1.3;
          const pctA=ceiling>0?Math.min((aD.rev/ceiling)*100,100):0;
          const pctV=ceiling>0?Math.min((vacDir*150/ceiling)*100,8):0;
          const pctF=ceiling>0?Math.min(((aD.rev*.55)/ceiling)*100,100-pctA-pctV):0;
          const lastMoPct=ceiling>0?Math.min((bD.rev/ceiling)*95,99):0;
          const pms=dataA?.pmMap?.[dir]?.pms||{};
          const vacByPM={};
          (vacData||[]).filter(r=>r.grp===dir).forEach(r=>{ vacByPM[r.pm]=(vacByPM[r.pm]||0)+(r.hours||0); });

          return (
            <div key={dir} style={{background:B.white,border:`0.5px solid ${B.lgray}`,borderRadius:12,overflow:"hidden",marginBottom:12}}>
              <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",padding:"12px 16px 0"}}>
                <div style={{fontSize:14,fontWeight:700,fontFamily:"'Poppins',sans-serif"}}>{dir.split(" ")[0]}</div>
                <div style={{fontSize:11,color:"#888",fontFamily:"'Open Sans',sans-serif"}}>
                  {fmt(wdA>0?aD.rev/wdA:0)} RPD to date &nbsp;·&nbsp; {fmt(wdA>0?bD.rev/wdB:0)} {periodB?.label} RPD &nbsp;·&nbsp; {Math.round(vacDir)} vac hrs
                  <HelpIcon tip="Forecast ceiling" calc="Estimated max if all resources billed 40hrs every working day." auditKey="ceiling" onAudit={setAuditKey}/>
                </div>
              </div>
              <div style={{padding:"10px 16px 12px"}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"#bbb",marginBottom:4,fontFamily:"'Open Sans',sans-serif"}}>
                  <span>$0</span><span>Full utilization ceiling <HelpIcon tip="Full utilization ceiling" calc="All resources × 8hrs × working days × effective rate" auditKey="ceiling" onAudit={setAuditKey}/></span>
                </div>
                <div style={{height:22,background:B.lgray,borderRadius:4,display:"flex",overflow:"hidden",position:"relative"}}>
                  <div style={{width:`${pctA}%`,background:B.teal,display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden"}}>
                    {pctA>10&&<span style={{fontSize:10,fontWeight:600,color:B.greenTx,whiteSpace:"nowrap",padding:"0 4px",fontFamily:"'Open Sans',sans-serif"}}>{fmtK(aD.rev)}</span>}
                  </div>
                  <div style={{width:`${pctV}%`,background:B.yellow,display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden"}}>
                    {pctV>3&&<span style={{fontSize:10,fontWeight:600,color:B.amberTx,fontFamily:"'Open Sans',sans-serif"}}>vac</span>}
                  </div>
                  <div style={{width:`${pctF}%`,background:"rgba(44,204,211,0.18)",borderTop:`1.5px dashed ${B.tealDash}`,borderBottom:`1.5px dashed ${B.tealDash}`,display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden"}}>
                    {pctF>8&&<span style={{fontSize:10,color:B.greenTx,fontFamily:"'Open Sans',sans-serif"}}>forecast</span>}
                  </div>
                  <div style={{position:"absolute",left:`${lastMoPct}%`,top:0,width:2,height:"100%",background:"#888",opacity:.6,zIndex:2}}>
                    <div style={{position:"absolute",top:3,left:4,fontSize:9,color:"#666",whiteSpace:"nowrap",fontFamily:"'Open Sans',sans-serif"}}>{periodB?.label}</div>
                  </div>
                  <div style={{position:"absolute",right:0,top:0,width:2,height:"100%",background:B.orange}}/>
                </div>
                <div style={{display:"flex",gap:12,marginTop:6,flexWrap:"wrap"}}>
                  {[{c:B.teal,l:"Actuals"},{c:B.yellow,l:"Vacation"},{c:"rgba(44,204,211,0.25)",l:"Forecast",d:true},{c:"#888",l:`${periodB?.label} RPD`,line:true},{c:B.orange,l:"Ceiling"}].map(({c,l,d,line})=>(
                    <div key={l} style={{display:"flex",alignItems:"center",gap:4,fontSize:10,color:"#888",fontFamily:"'Open Sans',sans-serif"}}>
                      <div style={{width:10,height:10,borderRadius:2,background:line?"transparent":c,border:d?`1px dashed ${B.tealDash}`:"none",borderLeft:line?"3px solid #888":undefined,flexShrink:0}}/>
                      {l}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{borderTop:`0.5px solid ${B.lgray}`}}>
                <div style={{display:"grid",gridTemplateColumns:"140px 1fr 72px 56px 52px 20px",padding:"4px 16px",borderBottom:`0.5px solid ${B.lgray}`,background:B.offwhite}}>
                  {["Pod lead","Actuals / vac / forecast",`${lA} RPD`,"Vac hrs","Ceiling",""].map((h,i)=>(
                    <div key={i} style={{fontSize:10,color:"#bbb",textTransform:"uppercase",letterSpacing:".04em",fontFamily:"'Open Sans',sans-serif",textAlign:i>1&&i<5?"right":"left"}}>{h}</div>
                  ))}
                </div>
                {Object.entries(pms).sort((a,b)=>b[1].revenue-a[1].revenue).map(([pm,d])=>{
                  const pmVac=vacByPM[pm]||0;
                  const pmRpd=wdA>0?d.revenue/wdA:0;
                  const pmCeil=d.revenue*1.3;
                  const pmPct=pmCeil>0?Math.round((d.revenue/pmCeil)*100):0;
                  const ceilColor=pmPct>=85?B.green:pmPct>=70?B.amber:B.red;
                  const isExp=!!(expandedPods?.[`${dir}-${pm}`]);
                  return (
                    <div key={pm} style={{borderBottom:`0.5px solid ${B.lgray}`}}>
                      <div
                        style={{display:"grid",gridTemplateColumns:"140px 1fr 72px 56px 52px 20px",padding:"8px 16px",cursor:"pointer",fontFamily:"'Open Sans',sans-serif",transition:"background .1s"}}
                        onMouseEnter={e=>e.currentTarget.style.background=B.offwhite}
                        onMouseLeave={e=>e.currentTarget.style.background="transparent"}
                        onClick={()=>setExpandedPods(p=>({...p,[`${dir}-${pm}`]:!p[`${dir}-${pm}`]}))}
                      >
                        <div style={{fontSize:12,fontWeight:600,color:B.black,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{pm?.split(" ")[0]}</div>
                        <div style={{display:"flex",alignItems:"center",paddingRight:8}}>
                          <div style={{flex:1,height:10,background:B.lgray,borderRadius:3,display:"flex",overflow:"hidden"}}>
                            <div style={{width:`${Math.min((d.revenue/(groupTotal(dataA?.pmMap,[dir]).rev||1))*65,60)}%`,background:B.teal,height:"100%"}}/>
                            <div style={{width:`${Math.min((pmVac/40)*5,8)}%`,background:B.yellow,height:"100%"}}/>
                            <div style={{width:"18%",background:"rgba(44,204,211,0.2)",height:"100%",borderTop:`1px dashed ${B.tealDash}`}}/>
                          </div>
                        </div>
                        <div style={{fontSize:12,textAlign:"right",fontWeight:600}}>{fmt(pmRpd)}</div>
                        <div style={{fontSize:12,textAlign:"right",color:pmVac>0?B.amber:"#ccc"}}>{pmVac>0?`${Math.round(pmVac)}h`:"—"}</div>
                        <div style={{fontSize:12,textAlign:"right",fontWeight:600,color:ceilColor}}>{pmPct}%</div>
                        <div style={{fontSize:13,color:"#bbb",textAlign:"right",transform:isExp?"rotate(180deg)":"none",transition:"transform .15s"}}>⌄</div>
                      </div>
                      {isExp&&(
                        <div style={{background:B.offwhite,padding:"10px 16px 10px 36px",borderTop:`0.5px solid ${B.lgray}`,fontFamily:"'Open Sans',sans-serif"}}>
                          {pmVac>0?(
                            <div>
                              <div style={{fontSize:11,color:"#888",marginBottom:8}}>{Math.round(pmVac)} vacation hrs this month — coverage analysis available</div>
                              <button onClick={()=>sendPrompt(`Run vacation coverage analysis for ${pm}'s pod in ${lA}. They have ${Math.round(pmVac)} vacation hours logged. Check which accounts are at risk and identify any backfill assignments company-wide.`)}
                                style={{display:"inline-flex",alignItems:"center",gap:5,fontSize:11,padding:"5px 12px",border:`0.5px solid ${B.lgray}`,borderRadius:6,background:"transparent",cursor:"pointer",fontFamily:"'Open Sans',sans-serif"}}>
                                ✦ Find coverage ↗
                              </button>
                            </div>
                          ):(
                            <div style={{fontSize:11,color:"#bbb"}}>No vacation hours this month.</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ── Time detail tab ──────────────────────────────────────────────────────────
  function renderDetail() {
    const lA=periodA?.label||"Period A";
    if(!detailData) return <Spinner msg={`Loading ${lA} detail...`}/>;
    const typeOf=(r)=>{
      if(r.proj?.includes("Vacation")) return {l:"Vacation",bg:B.blueBg,c:B.blueTx};
      if(r.credited) return {l:"Credited",bg:B.purpleBg,c:B.purpleTx};
      if(r.billable) return {l:"Billable",bg:B.greenBg,c:B.greenTx};
      return {l:"Non-bill",bg:B.lgray,c:"#666"};
    };
    return (
      <div>
        <div style={{fontSize:11,color:"#888",background:B.offwhite,borderRadius:8,padding:"6px 12px",marginBottom:12,fontFamily:"'Open Sans',sans-serif"}}>
          Showing {Math.min(detailData.length,200)} splits from {lA} · Approved timecards only
        </div>
        <div style={{background:B.white,border:`0.5px solid ${B.lgray}`,borderRadius:12,overflow:"hidden"}}>
          <div style={{display:"grid",gridTemplateColumns:"110px 1fr 90px 60px 52px 68px 76px",padding:"6px 14px",background:B.offwhite,borderBottom:`0.5px solid ${B.lgray}`}}>
            {["Resource","Project","Account","Type","Hrs","Revenue","Date"].map((h,i)=>(
              <div key={i} style={{fontSize:10,color:"#bbb",textTransform:"uppercase",letterSpacing:".04em",fontFamily:"'Open Sans',sans-serif",textAlign:i>3?"right":"left"}}>{h}</div>
            ))}
          </div>
          {detailData.slice(0,100).map((r,i)=>{
            const t=typeOf(r);
            return (
              <div key={i} style={{display:"grid",gridTemplateColumns:"110px 1fr 90px 60px 52px 68px 76px",padding:"7px 14px",borderBottom:`0.5px solid ${B.lgray}`,fontFamily:"'Open Sans',sans-serif",fontSize:12}}>
                <div style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:B.black}}>{r.resource?.split(" ")[0]} {r.resource?.split(" ").slice(-1)[0]}</div>
                <div style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontSize:11,color:"#888"}}>{r.proj}</div>
                <div style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontSize:11,color:"#aaa"}}>{r.acct||"—"}</div>
                <div><Tag color={t.c} bg={t.bg}>{t.l}</Tag></div>
                <div style={{textAlign:"right"}}>{(r.hours||0).toFixed(1)}</div>
                <div style={{textAlign:"right",color:"#888"}}>{(r.revenue||0)>0?fmtK(r.revenue):"—"}</div>
                <div style={{textAlign:"right",color:"#bbb",fontSize:11}}>{r.startDate}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Data audit tab ───────────────────────────────────────────────────────────
  function AuditCheck({ id, title, severity, desc, records, fields }) {
    const sevColor = severity==="Breaking"?{bg:B.redBg,c:B.redTx}:severity==="Warning"?{bg:B.amberBg,c:B.amberTx}:{bg:B.blueBg,c:B.blueTx};
    const [open, setOpen] = useState(severity==="Breaking");
    const allChecked = records.length>0 && records.every(r=>auditChecked[`${id}-${r.Id}`]);
    function toggleAll() {
      setAuditChecked(prev=>{ const next={...prev}; records.forEach(r=>{ next[`${id}-${r.Id}`]=!allChecked; }); return next; });
    }
    return (
      <div style={{background:B.white,border:`0.5px solid ${B.lgray}`,borderRadius:12,overflow:"hidden",marginBottom:10}}>
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"11px 16px",cursor:"pointer",background:records.length>0?B.offwhite:"transparent"}}
          onClick={()=>records.length>0&&setOpen(o=>!o)}>
          <Tag color={sevColor.c} bg={sevColor.bg}>{severity}</Tag>
          <div style={{flex:1,fontFamily:"'Open Sans',sans-serif"}}>
            <div style={{fontSize:13,fontWeight:600,color:B.black}}>{title}</div>
            <div style={{fontSize:11,color:"#888",marginTop:2}}>{desc}</div>
          </div>
          <div style={{fontSize:12,fontWeight:600,color:records.length>0?B.orange:"#bbb",fontFamily:"'Poppins',sans-serif",flexShrink:0}}>
            {records.length} {records.length===1?"record":"records"}
          </div>
          {records.length>0 && <div style={{fontSize:13,color:"#bbb",transform:open?"rotate(180deg)":"none",transition:"transform .15s"}}>⌄</div>}
        </div>
        {open && records.length>0 && (
          <div>
            <div style={{display:"flex",alignItems:"center",gap:8,padding:"6px 16px",borderTop:`0.5px solid ${B.lgray}`,background:"#FAFAFA"}}>
              <input type="checkbox" checked={allChecked} onChange={toggleAll} style={{cursor:"pointer"}}/>
              <span style={{fontSize:11,color:"#888",fontFamily:"'Open Sans',sans-serif"}}>Select all</span>
            </div>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,fontFamily:"'Open Sans',sans-serif"}}>
                <thead>
                  <tr style={{background:B.offwhite}}>
                    <th style={{width:32,padding:"6px 14px",textAlign:"left"}}/>
                    {fields.map(f=>(
                      <th key={f.key} style={{padding:"6px 14px",textAlign:"left",fontSize:10,color:"#aaa",textTransform:"uppercase",letterSpacing:".04em",whiteSpace:"nowrap"}}>{f.label}</th>
                    ))}
                    <th style={{padding:"6px 14px",fontSize:10,color:"#aaa",textTransform:"uppercase",letterSpacing:".04em"}}>Record ID</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((rec,i)=>(
                    <tr key={rec.Id||i} style={{borderTop:`0.5px solid ${B.lgray}`}}>
                      <td style={{padding:"7px 14px"}}>
                        <input type="checkbox" checked={!!auditChecked[`${id}-${rec.Id}`]}
                          onChange={e=>setAuditChecked(prev=>({...prev,[`${id}-${rec.Id}`]:e.target.checked}))}
                          style={{cursor:"pointer"}}/>
                      </td>
                      {fields.map(f=>(
                        <td key={f.key} style={{padding:"7px 14px",color:f.highlight?B.red:B.black,maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                          {rec[f.key]!==undefined&&rec[f.key]!==null?String(rec[f.key]):"—"}
                        </td>
                      ))}
                      <td style={{padding:"7px 14px",fontFamily:"monospace",fontSize:11,color:B.teal}}>{rec.Id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  function exportAuditCSV() {
    const selected=[];
    Object.entries(auditChecked).forEach(([k,v])=>{
      if(!v) return;
      const [checkId,...rest]=k.split("-");
      const recId=rest.join("-");
      const checkMap={ zeroRates:auditData?.zeroRates, zeroRevSplits:auditData?.zeroRevSplits, nullSrc:auditData?.nullSrc, formulaDrift:auditData?.formulaDrift, zeroSchedHrs:auditData?.zeroSchedHrs };
      const recs=checkMap[checkId]||[];
      const rec=recs.find(r=>r.Id===recId);
      if(rec) selected.push({checkId,...rec});
    });
    if(!selected.length){ alert("No records selected."); return; }
    const headers=["Check","Id","Name","Resource","Project","Group","Issue"];
    const rows=selected.map(r=>[
      r.checkId, r.Id, r.Name||"", r.resource||"", r.proj||"", r.grp||"",
      r.checkId==="zeroRates"?`Bill Rate: ${r.billRate||0}, Planned: ${r.plannedRate||0}`:
      r.checkId==="zeroRevSplits"?`Revenue: $0, Hours: ${r.hours||0}`:
      r.checkId==="nullSrc"?`Project Source: null, Stage: ${r.stage||""}`:
      r.checkId==="formulaDrift"?`CAD_Revenue: ${r.cadRevenue||0}, Formula: ${r.formulaRevenue||0}`:
      r.checkId==="zeroSchedHrs"?`Scheduled Hours: 0`:"",
    ]);
    const csv=[headers,...rows].map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob=new Blob([csv],{type:"text/csv"});
    const a=document.createElement("a"); a.href=URL.createObjectURL(blob);
    a.download=`lane-four-audit-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  }

  function renderAudit() {
    if(auditLoading) return <Spinner msg="Running data quality checks..."/>;
    if(!auditData) return (
      <div style={{textAlign:"center",padding:40,fontFamily:"'Open Sans',sans-serif"}}>
        <button onClick={fetchAuditData} style={{fontSize:12,padding:"8px 20px",background:B.teal,color:B.white,border:"none",borderRadius:6,cursor:"pointer",fontFamily:"'Open Sans',sans-serif"}}>Run checks</button>
      </div>
    );
    const totalSelected=Object.values(auditChecked).filter(Boolean).length;
    const CHECKS=[
      {id:"zeroRates",title:"Billable assignments with $0 bill rate and $0 planned bill rate",severity:"Breaking",
       desc:"These assignments generate $0 forecast revenue. The forecast tab will undercount any pod with resources in this state.",
       records:auditData.zeroRates,
       fields:[{key:"Name",label:"Assignment"},{key:"resource",label:"Resource"},{key:"proj",label:"Project"},{key:"grp",label:"Group"},{key:"billRate",label:"Bill rate",highlight:true},{key:"plannedRate",label:"Planned rate",highlight:true},{key:"status",label:"Status"}]},
      {id:"zeroRevSplits",title:"Approved billable timecards generating $0 revenue",severity:"Breaking",
       desc:"These splits are flagged billable and approved but Total_Billable_Amount_Formula__c = 0. Likely caused by a $0 bill rate on the parent assignment. RPD is understated for these pods.",
       records:auditData.zeroRevSplits,
       fields:[{key:"Name",label:"Timecard"},{key:"resource",label:"Resource"},{key:"proj",label:"Project"},{key:"grp",label:"Group"},{key:"hours",label:"Hours"},{key:"revenue",label:"Revenue",highlight:true},{key:"startDate",label:"Week of"}]},
      {id:"formulaDrift",title:"CAD_Revenue__c ≠ Total_Billable_Amount_Formula__c",severity:"Warning",
       desc:"The two revenue fields disagree on the same split. Dashboard uses Total_Billable_Amount_Formula__c. If CAD_Revenue__c is larger, RPD may be understated.",
       records:auditData.formulaDrift,
       fields:[{key:"Name",label:"Timecard"},{key:"resource",label:"Resource"},{key:"proj",label:"Project"},{key:"cadRevenue",label:"CAD_Revenue",highlight:true},{key:"formulaRevenue",label:"Formula Revenue",highlight:true},{key:"startDate",label:"Date"}]},
      {id:"nullSrc",title:"Active projects with null Project_Source__c",severity:"Warning",
       desc:"These projects won't appear in managed services queries. If they're billable client work, they're missing from RPD and forecast entirely. Numeris is a known example.",
       records:auditData.nullSrc,
       fields:[{key:"Name",label:"Project"},{key:"acct",label:"Account"},{key:"grp",label:"Group"},{key:"pm",label:"PM"},{key:"src",label:"Project Source",highlight:true},{key:"stage",label:"Stage"}]},
      {id:"zeroSchedHrs",title:"Active scheduled billable assignments with 0 scheduled hours",severity:"Info",
       desc:"These assignments exist on the planner but have no scheduled hours. They contribute $0 to forecast and inflate resource headcount in the utilization ceiling calculation.",
       records:auditData.zeroSchedHrs,
       fields:[{key:"Name",label:"Assignment"},{key:"resource",label:"Resource"},{key:"proj",label:"Project"},{key:"grp",label:"Group"},{key:"scheduledHours",label:"Sched hrs",highlight:true},{key:"startDate",label:"Start"},{key:"endDate",label:"End"}]},
    ];
    return (
      <div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
          <div>
            <div style={{fontSize:13,fontWeight:700,fontFamily:"'Poppins',sans-serif",color:B.black}}>Data quality checks</div>
            <div style={{fontSize:11,color:"#aaa",fontFamily:"'Open Sans',sans-serif",marginTop:2}}>Last run: {auditData.fetchedAt}</div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            {totalSelected>0&&(
              <button onClick={exportAuditCSV} style={{fontSize:12,padding:"6px 14px",background:B.teal,color:B.white,border:"none",borderRadius:6,cursor:"pointer",fontFamily:"'Open Sans',sans-serif"}}>
                Export {totalSelected} selected (CSV)
              </button>
            )}
            <button onClick={fetchAuditData} style={{fontSize:12,padding:"6px 14px",background:"transparent",color:"#666",border:`0.5px solid ${B.lgray}`,borderRadius:6,cursor:"pointer",fontFamily:"'Open Sans',sans-serif"}}>↺ Re-run</button>
          </div>
        </div>
        {CHECKS.map(c=><AuditCheck key={c.id} {...c}/>)}
        <div style={{marginTop:16,padding:"12px 16px",background:B.offwhite,borderRadius:8,fontSize:11,color:"#888",lineHeight:1.6,fontFamily:"'Open Sans',sans-serif"}}>
          <strong style={{color:B.black}}>How to use:</strong> Check rows you want to fix → Export CSV → use Salesforce Data Loader to mass-update via the Record ID column. Breaking issues actively distort RPD and forecast numbers. Warning issues may cause silent undercounting. Info issues are data hygiene worth cleaning.
        </div>
      </div>
    );
  }

  // ── Options tab ──────────────────────────────────────────────────────────────
  function renderOptions() {
    return (
      <div>
        <div style={{fontSize:11,color:"#888",background:B.offwhite,borderRadius:8,padding:"7px 12px",display:"flex",alignItems:"center",gap:6,marginBottom:14,fontFamily:"'Open Sans',sans-serif"}}>
          ℹ Holidays toggled off are counted as working days. Changes update RPD calculations across all tabs immediately.
        </div>
        <div style={{display:"flex",gap:6,marginBottom:14,alignItems:"center"}}>
          <span style={{fontSize:11,color:"#888",fontFamily:"'Open Sans',sans-serif"}}>Year:</span>
          {[2024,2025,2026,2027].map(y=>(
            <button key={y} onClick={()=>setHolYear(y)} style={{
              fontSize:12,padding:"4px 12px",border:`0.5px solid ${B.lgray}`,borderRadius:6,cursor:"pointer",fontFamily:"'Open Sans',sans-serif",
              background:y===holYear?B.teal:"transparent",color:y===holYear?B.white:"#666",
            }}>{y}</button>
          ))}
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
          {["CA","US"].map(country=>{
            const hols=HOLIDAYS[holYear]?.[country]||[];
            const flag=country==="CA"?"🇨🇦":"🇺🇸";
            const lbl=country==="CA"?"Canada (federal + ON)":"United States (federal)";
            const onCount=hols.filter(h=>hState[`${holYear}-${country}-${h.date}`]!==false).length;
            return (
              <div key={country} style={{background:B.white,border:`0.5px solid ${B.lgray}`,borderRadius:12,overflow:"hidden"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",background:B.offwhite,borderBottom:`0.5px solid ${B.lgray}`}}>
                  <div style={{fontSize:13,fontWeight:600,fontFamily:"'Poppins',sans-serif",display:"flex",alignItems:"center",gap:6}}>
                    <span>{flag}</span>{lbl}
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <span style={{fontSize:11,color:"#aaa",fontFamily:"'Open Sans',sans-serif"}}>{onCount}/{hols.length} on</span>
                    <button onClick={()=>{
                      const anyOn=hols.some(h=>hState[`${holYear}-${country}-${h.date}`]!==false);
                      setHState(prev=>{ const n={...prev}; hols.forEach(h=>{n[`${holYear}-${country}-${h.date}`]=!anyOn;}); return n; });
                    }} style={{fontSize:11,color:B.teal,background:"none",border:"none",cursor:"pointer",fontFamily:"'Open Sans',sans-serif"}}>Toggle all</button>
                  </div>
                </div>
                {hols.map(h=>{
                  const key=`${holYear}-${country}-${h.date}`;
                  const on=hState[key]!==false;
                  const mo=parseInt(h.date.slice(5,7));
                  const isCur=mo===periodA?.month&&holYear===periodA?.year;
                  return (
                    <div key={h.date} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 14px",borderBottom:`0.5px solid ${B.lgray}`,opacity:on?1:.4,fontFamily:"'Open Sans',sans-serif"}}>
                      <label style={{position:"relative",width:28,height:16,flexShrink:0,cursor:"pointer"}}>
                        <input type="checkbox" checked={on} onChange={e=>setHState(prev=>({...prev,[key]:e.target.checked}))} style={{opacity:0,width:0,height:0,position:"absolute"}}/>
                        <div style={{position:"absolute",inset:0,background:on?B.teal:B.lgray,borderRadius:8}}>
                          <div style={{position:"absolute",width:12,height:12,borderRadius:"50%",background:B.white,top:2,left:on?14:2,transition:"left .15s"}}/>
                        </div>
                      </label>
                      <div style={{flex:1}}>
                        <div style={{fontSize:12,color:B.black}}>{h.name}</div>
                        <div style={{fontSize:11,color:"#bbb"}}>{h.date}</div>
                      </div>
                      <span style={{fontSize:10,padding:"2px 7px",borderRadius:8,fontWeight:isCur?600:400,background:isCur?"rgba(44,204,211,.12)":B.offwhite,color:isCur?B.teal:"#bbb"}}>{MONTHS[mo-1]}</span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        <div style={{background:B.white,border:`0.5px solid ${B.lgray}`,borderRadius:12,padding:"14px 16px",fontFamily:"'Open Sans',sans-serif"}}>
          <div style={{fontSize:12,fontWeight:700,fontFamily:"'Poppins',sans-serif",marginBottom:10}}>
            Working day impact — {periodA?.label} vs {periodB?.label}
          </div>
          {periodA?.month && [
            [`${periodA.label}: calendar weekdays`, calcWD(periodA.year,periodA.month,[])],
            [`${periodA.label}: CA working days`, calcWD(periodA.year,periodA.month,getEnabledHols(periodA.year,"CA",hState))],
            [`${periodA.label}: US working days`, calcWD(periodA.year,periodA.month,getEnabledHols(periodA.year,"US",hState))],
            [`${periodB?.label}: CA working days`, calcWD(periodB?.year||periodA.year,periodB?.month||periodA.month,getEnabledHols(periodB?.year||periodA.year,"CA",hState))],
            [`${periodB?.label}: US working days`, calcWD(periodB?.year||periodA.year,periodB?.month||periodA.month,getEnabledHols(periodB?.year||periodA.year,"US",hState))],
          ].map(([label,val])=>(
            <div key={label} style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"5px 0",borderBottom:`0.5px solid ${B.lgray}`}}>
              <span style={{color:"#888"}}>{label}</span>
              <span style={{fontWeight:700,color:B.black}}>{val}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Tabs config ──────────────────────────────────────────────────────────────
  const TABS=[
    {id:"hierarchy",   label:"Team hierarchy"},
    {id:"utilization", label:"Utilization"},
    {id:"actuals",     label:"Actuals"},
    {id:"forecast",    label:"Forecast"},
    {id:"detail",      label:"Time detail"},
    {id:"audit",       label:"Data audit"},
    {id:"options",     label:"Options"},
  ];

  const showControls = tab==="actuals"||tab==="forecast";
  const dotColor = status.type==="g"?B.green:status.type==="a"?B.amber:status.type==="r"?B.red:B.lgray;

  // Header Sync SF: call the hierarchy tab's preserving sync (never wipe H)
  const handleSyncSF = () => { if (syncRef.current) syncRef.current()(); };

  return (
    <div style={{maxWidth:980,margin:"0 auto",padding:"0 0 40px",fontFamily:"'Open Sans',sans-serif",position:"relative"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@500;700&family=Open+Sans:wght@400;600&display=swap'); *{box-sizing:border-box;}`}</style>

      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,paddingTop:8}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:4,height:24,background:B.teal,borderRadius:2}}/>
          <div style={{fontSize:20,fontWeight:700,fontFamily:"'Poppins',sans-serif",color:B.black}}>Team performance</div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <span style={{fontSize:10,color:"#aaa",display:"flex",alignItems:"center",gap:5,fontFamily:"'Open Sans',sans-serif"}}>
            <span style={{width:6,height:6,borderRadius:"50%",background:dotColor}}/>{status.msg}
          </span>
          {tab==="hierarchy" && <>
            <span style={{fontSize:10,color:"#aaa"}}>{saveStatus}</span>
            <button onClick={handleSyncSF} style={{fontSize:11,padding:"5px 12px",border:`0.5px solid ${B.lgray}`,borderRadius:6,background:"transparent",cursor:"pointer",fontFamily:"'Open Sans',sans-serif",color:"#888"}}>↺ Sync SF</button>
            <button onClick={saveHierarchy} style={{fontSize:11,padding:"5px 12px",background:B.teal,color:B.white,border:"none",borderRadius:6,cursor:"pointer",fontFamily:"'Open Sans',sans-serif"}}>Save to Drive</button>
          </>}
          {tab!=="hierarchy" && <button onClick={loadData} style={{fontSize:11,padding:"5px 12px",border:`0.5px solid ${B.lgray}`,borderRadius:6,background:"transparent",cursor:"pointer",fontFamily:"'Open Sans',sans-serif",color:"#888"}}>↺ Refresh</button>}
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",borderBottom:`0.5px solid ${B.lgray}`,marginBottom:14,overflowX:"auto"}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            fontSize:13,padding:"8px 16px",background:"none",cursor:"pointer",whiteSpace:"nowrap",fontFamily:"'Open Sans',sans-serif",
            color:tab===t.id?B.teal:"#888",fontWeight:tab===t.id?600:400,
            border:"none",borderBottom:tab===t.id?`2px solid ${B.teal}`:"2px solid transparent",
          }}>
            {t.label}
            {t.id==="audit"&&auditData&&(auditData.zeroRates.length+auditData.zeroRevSplits.length+auditData.nullSrc.length)>0&&(
              <span style={{marginLeft:5,fontSize:10,padding:"1px 6px",borderRadius:8,background:B.redBg,color:B.redTx,fontWeight:700}}>
                {auditData.zeroRates.length+auditData.zeroRevSplits.length+auditData.nullSrc.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Controls bar (actuals + forecast) */}
      {showControls && (
        <ControlsBar mode={mode} setMode={setMode}
          periodA={periodA} setPeriodA={setPeriodA}
          periodB={periodB} setPeriodB={setPeriodB}
          monthOpts={monthOpts} quarterOpts={quarterOpts}/>
      )}

      {/* Error */}
      {sfError && (
        <div style={{background:B.redBg,border:`0.5px solid ${B.red}`,borderRadius:8,padding:"10px 14px",marginBottom:12,fontSize:12,color:B.redTx,fontFamily:"'Open Sans',sans-serif"}}>
          <strong>Salesforce error:</strong> {sfError} — check your MCP connection and try refreshing.
        </div>
      )}

      {/* Loading (data tabs only) */}
      {loading && showControls && <Spinner msg={loadMsg}/>}

      {/* Tab content */}
      {tab==="hierarchy" && <HierarchyTab H={H} setH={setH} setStatus={setStatus} registerSync={fn=>{syncRef.current=fn;}}/>}
      {tab==="utilization" && <UtilizationTab H={H} hState={hState}/>}
      {!loading && tab==="actuals"  && renderActuals()}
      {!loading && tab==="forecast" && renderForecast()}
      {!loading && tab==="detail"   && renderDetail()}
      {tab==="audit"   && renderAudit()}
      {tab==="options" && renderOptions()}

      {/* Audit slide-in */}
      {auditKey && <AuditPanel auditKey={auditKey} onClose={()=>setAuditKey(null)}/>}
    </div>
  );
}
