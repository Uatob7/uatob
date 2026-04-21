import { useState } from "react";
import {
  ArrowLeft, Search, X, Eye, UserX, UserCheck, Trash2,
  AlertTriangle, Mail, Hash, Calendar, Shield, ChevronDown,
  Lock, Flag, FileText, Download, RotateCcw,
  CheckCircle, Clock, Ban, Users, Activity,
  MoreHorizontal, ChevronRight, MapPin
} from "lucide-react";

// ─── Tokens ───────────────────────────────────────────────────────────────────
const C = {
  bg:          "#f7f6f3",
  surface:     "#ffffff",
  surfaceHov:  "#fafaf8",
  border:      "#e8e5df",
  borderHov:   "#d1cdc5",
  accent:      "#16a34a",
  accentLight: "#f0fdf4",
  accentMid:   "#dcfce7",
  text:        "#1a1a18",
  textSub:     "#4a4a45",
  textMuted:   "#9a9890",
  red:         "#dc2626",
  redLight:    "#fef2f2",
  redMid:      "#fee2e2",
  yellow:      "#d97706",
  yellowLight: "#fffbeb",
  yellowMid:   "#fef3c7",
  blue:        "#2563eb",
  blueLight:   "#eff6ff",
  blueMid:     "#dbeafe",
  purple:      "#7c3aed",
  purpleLight: "#f5f3ff",
  purpleMid:   "#ede9fe",
  shadow:      "0 1px 3px rgba(0,0,0,0.06),0 4px 12px rgba(0,0,0,0.04)",
  shadowMd:    "0 4px 16px rgba(0,0,0,0.08),0 1px 4px rgba(0,0,0,0.04)",
  shadowLg:    "0 12px 40px rgba(0,0,0,0.14),0 2px 8px rgba(0,0,0,0.06)",
};
const font = "'Outfit', sans-serif";
const mono = "'JetBrains Mono', monospace";

// ─── Mock data ────────────────────────────────────────────────────────────────
const MOCK = [
  { id:"1", uid:"1yLA7icXzLaTSXB7MKF0kVRjwG73", name:"Marcus Webb",  email:"marcus.webb@gmail.com",  status:"active",    createdAt:"2026-01-14", rides:42, rating:4.9, lastRide:"2026-04-19", welcomeEmailSent:true,  adminNote:"" },
  { id:"2", uid:"3mPQ2abXzLaTSXB7NKG1mWSjxH84", name:"Priya Nair",   email:"priya.n@outlook.com",   status:"active",    createdAt:"2026-02-03", rides:17, rating:4.7, lastRide:"2026-04-20", welcomeEmailSent:true,  adminNote:"" },
  { id:"3", uid:"9xRT5cdYwMbUYC8OLH2nXTUkyI95", name:"dfdfddf",      email:"dfdfddf@live.com",      status:"suspended", createdAt:"2026-04-21", rides:0,  rating:null, lastRide:null,          welcomeEmailSent:true,  adminNote:"Flagged during signup" },
  { id:"4", uid:"7kWS8efZvNcVZD9PMI3oYUVlzJ06", name:"Jordan Lee",   email:"jordlee@icloud.com",    status:"active",    createdAt:"2026-03-11", rides:8,  rating:4.5, lastRide:"2026-04-15", welcomeEmailSent:true,  adminNote:"" },
  { id:"5", uid:"2bXU6ghAvOdWAE0QNJ4pZVWmAK17", name:"Talia Frost",  email:"talia@protonmail.com",  status:"banned",    createdAt:"2026-01-28", rides:3,  rating:2.1, lastRide:"2026-02-10", welcomeEmailSent:false, adminNote:"Multiple chargebacks" },
];

function fmt(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
}
function initials(name) {
  return (name||"?").trim().split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase();
}
const ACOLORS=[["#bbf7d0","#15803d"],["#bfdbfe","#1d4ed8"],["#fde68a","#92400e"],["#e9d5ff","#6d28d9"],["#fecdd3","#be123c"],["#a7f3d0","#065f46"]];
function acolor(name){ return ACOLORS[(name||"?").charCodeAt(0)%ACOLORS.length]; }

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({name,size=40}){
  const [bg,fg]=acolor(name);
  return <div style={{width:size,height:size,borderRadius:"50%",background:bg,color:fg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:font,fontWeight:800,fontSize:size*.34,flexShrink:0,userSelect:"none"}}>{initials(name)}</div>;
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function Badge({status}){
  const m={active:{l:"Active",bg:C.accentMid,c:C.accent},suspended:{l:"Suspended",bg:C.yellowMid,c:C.yellow},banned:{l:"Banned",bg:C.redMid,c:C.red}};
  const s=m[status]||m.active;
  return <span style={{display:"inline-flex",alignItems:"center",gap:5,padding:"3px 9px",borderRadius:20,background:s.bg,color:s.c,fontFamily:font,fontSize:11,fontWeight:700}}>
    <span style={{width:5,height:5,borderRadius:"50%",background:s.c}}/>
    {s.l}
  </span>;
}

// ─── All actions catalogue ────────────────────────────────────────────────────
// Every button the admin might need, grouped by purpose
const ACTIONS=[
  // ── Info
  {id:"view",     label:"View Full Profile",   icon:<Eye size={15}/>,          color:C.blue,   bg:C.blueLight,   group:"info",    desc:"Open detailed rider profile in side panel"},
  {id:"history",  label:"Ride History",        icon:<Clock size={15}/>,        color:C.blue,   bg:C.blueLight,   group:"info",    desc:"Browse all past trips, fares, and routes"},
  // ── Communication
  {id:"email",    label:"Send Email",           icon:<Mail size={15}/>,         color:C.purple, bg:C.purpleLight, group:"comms",   desc:"Compose a direct email to this rider"},
  {id:"note",     label:"Add Admin Note",       icon:<FileText size={15}/>,     color:C.purple, bg:C.purpleLight, group:"comms",   desc:"Attach a private internal note to this account"},
  // ── Account
  {id:"reset",    label:"Send Password Reset",  icon:<Lock size={15}/>,         color:C.yellow, bg:C.yellowLight, group:"account", desc:"Email a password-reset link to the rider"},
  {id:"verify",   label:"Manually Verify",      icon:<CheckCircle size={15}/>,  color:C.accent, bg:C.accentLight, group:"account", desc:"Mark this account as email-verified without confirmation"},
  {id:"export",   label:"Export Rider Data",    icon:<Download size={15}/>,     color:C.yellow, bg:C.yellowLight, group:"account", desc:"Download all account data as JSON (GDPR request)"},
  // ── Moderation
  {id:"flag",     label:"Flag for Review",      icon:<Flag size={15}/>,         color:C.yellow, bg:C.yellowLight, group:"mod",     desc:"Escalate to senior admin with an optional note"},
  {id:"suspend",  label:"Suspend Account",      icon:<AlertTriangle size={15}/>,color:C.yellow, bg:C.yellowLight, group:"mod",     desc:"Temporarily remove platform access — reversible"},
  {id:"reinstate",label:"Reinstate Access",     icon:<UserCheck size={15}/>,    color:C.accent, bg:C.accentLight, group:"mod",     desc:"Restore full access after a suspension or ban"},
  {id:"ban",      label:"Ban Permanently",      icon:<Ban size={15}/>,          color:C.red,    bg:C.redLight,    group:"mod",     desc:"Block permanently — rider cannot create another account"},
  {id:"delete",   label:"Delete Account",       icon:<Trash2 size={15}/>,       color:C.red,    bg:C.redLight,    group:"mod",     desc:"Erase all data from Firestore and Auth — irreversible"},
];
const GROUPS=[{k:"info",l:"Information"},{k:"comms",l:"Communication"},{k:"account",l:"Account"},{k:"mod",l:"Moderation"}];

// ─── Bottom-sheet action menu ─────────────────────────────────────────────────
function ActionsMenu({rider,onClose,onAction}){
  return (
    <div style={{position:"fixed",inset:0,zIndex:800,display:"flex",alignItems:"flex-end",justifyContent:"center",background:"rgba(26,26,24,0.4)",backdropFilter:"blur(4px)"}} onClick={onClose}>
      <div style={{background:C.surface,borderRadius:"20px 20px 0 0",width:"100%",maxWidth:520,maxHeight:"88vh",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 -16px 48px rgba(0,0,0,0.18)",animation:"sUp .22s cubic-bezier(.32,.72,0,1)"}} onClick={e=>e.stopPropagation()}>
        <style>{`@keyframes sUp{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>

        {/* Drag handle */}
        <div style={{display:"flex",justifyContent:"center",padding:"12px 0 0"}}>
          <div style={{width:36,height:4,borderRadius:99,background:C.border}}/>
        </div>

        {/* Rider header */}
        <div style={{display:"flex",alignItems:"center",gap:12,padding:"14px 20px",borderBottom:`1px solid ${C.border}`}}>
          <Avatar name={rider.name} size={44}/>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontFamily:font,fontWeight:700,fontSize:15,color:C.text}}>{rider.name}</div>
            <div style={{fontFamily:font,fontSize:12.5,color:C.textMuted,marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{rider.email}</div>
          </div>
          <Badge status={rider.status}/>
        </div>

        {/* Actions grouped */}
        <div style={{overflowY:"auto",padding:"8px 12px 32px"}}>
          {GROUPS.map(grp=>{
            const items=ACTIONS.filter(a=>{
              if(a.group!==grp.k) return false;
              if(a.id==="reinstate") return rider.status==="suspended"||rider.status==="banned";
              if(a.id==="suspend")   return rider.status==="active";
              if(a.id==="ban")       return rider.status!=="banned";
              return true;
            });
            if(!items.length) return null;
            return (
              <div key={grp.k}>
                <div style={{fontFamily:font,fontSize:10.5,fontWeight:700,color:C.textMuted,textTransform:"uppercase",letterSpacing:"0.08em",padding:"12px 10px 6px"}}>{grp.l}</div>
                {items.map(a=>(
                  <button key={a.id} onClick={()=>{onClose();onAction(a.id,rider);}} style={{display:"flex",alignItems:"center",gap:12,width:"100%",padding:"10px 10px",borderRadius:12,border:"none",background:"none",cursor:"pointer",textAlign:"left"}}
                    onMouseEnter={e=>e.currentTarget.style.background=a.bg}
                    onMouseLeave={e=>e.currentTarget.style.background="none"}
                  >
                    <div style={{width:38,height:38,borderRadius:11,background:a.bg,display:"flex",alignItems:"center",justifyContent:"center",color:a.color,flexShrink:0}}>{a.icon}</div>
                    <div style={{flex:1}}>
                      <div style={{fontFamily:font,fontWeight:600,fontSize:14,color:(a.id==="delete"||a.id==="ban")?C.red:C.text}}>{a.label}</div>
                      <div style={{fontFamily:font,fontSize:12,color:C.textMuted,marginTop:1}}>{a.desc}</div>
                    </div>
                    <ChevronRight size={14} color={C.borderHov}/>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Confirm / input modal ────────────────────────────────────────────────────
function ConfirmModal({action,rider,note,setNote,onConfirm,onCancel}){
  const cfg={
    suspend:   {icon:<AlertTriangle size={20}/>, title:"Suspend Rider",    body:`${rider?.name} will lose app access until reinstated.`,               btn:"Suspend",          bc:C.yellow,  bt:"#1a1a18"},
    ban:       {icon:<Ban size={20}/>,           title:"Ban Permanently",  body:`${rider?.name} will be permanently blocked from UaTob.`,              btn:"Ban Permanently",  bc:C.red,     bt:"#fff"},
    delete:    {icon:<Trash2 size={20}/>,        title:"Delete Account",   body:`All data for ${rider?.name} will be erased. Cannot be undone.`,       btn:"Delete Account",   bc:C.red,     bt:"#fff"},
    reinstate: {icon:<UserCheck size={20}/>,     title:"Reinstate Access", body:`${rider?.name} will regain full access to the platform.`,             btn:"Reinstate",        bc:C.accent,  bt:"#fff"},
    flag:      {icon:<Flag size={20}/>,          title:"Flag for Review",  body:"Add an optional note for the reviewing admin.",                       btn:"Flag Rider",       bc:C.yellow,  bt:"#1a1a18", note:true},
    note:      {icon:<FileText size={20}/>,      title:"Admin Note",       body:"Internal only — not visible to the rider.",                           btn:"Save Note",        bc:C.accent,  bt:"#fff",    note:true},
  }[action];
  if(!cfg) return null;
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(26,26,24,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:900,backdropFilter:"blur(6px)",padding:20}}>
      <div style={{background:C.surface,borderRadius:20,padding:28,maxWidth:360,width:"100%",boxShadow:C.shadowLg}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
          <div style={{background:cfg.bc+"18",borderRadius:12,padding:10,display:"flex",color:cfg.bc}}>{cfg.icon}</div>
          <span style={{fontFamily:font,fontWeight:800,fontSize:16,color:C.text}}>{cfg.title}</span>
        </div>
        <p style={{fontFamily:font,fontSize:13.5,color:C.textSub,lineHeight:1.65,margin:"0 0 18px"}}>{cfg.body}</p>
        {cfg.note&&(
          <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Write a note…" rows={3} style={{width:"100%",boxSizing:"border-box",background:C.bg,border:`1px solid ${C.border}`,borderRadius:12,padding:"10px 12px",fontFamily:font,fontSize:13.5,color:C.text,resize:"none",outline:"none",marginBottom:18}}/>
        )}
        <div style={{display:"flex",gap:10}}>
          <button onClick={onCancel} style={{flex:1,padding:"11px 0",borderRadius:12,border:`1px solid ${C.border}`,background:C.bg,color:C.textSub,fontFamily:font,fontWeight:600,fontSize:14,cursor:"pointer"}}>Cancel</button>
          <button onClick={onConfirm} style={{flex:1,padding:"11px 0",borderRadius:12,border:"none",background:cfg.bc,color:cfg.bt,fontFamily:font,fontWeight:700,fontSize:14,cursor:"pointer"}}>{cfg.btn}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Side drawer ──────────────────────────────────────────────────────────────
function Drawer({rider,onClose,onAction}){
  if(!rider) return null;
  return (
    <div style={{position:"fixed",inset:0,zIndex:700,display:"flex",justifyContent:"flex-end",background:"rgba(26,26,24,0.3)",backdropFilter:"blur(3px)"}} onClick={onClose}>
      <div style={{width:320,background:C.surface,height:"100%",borderLeft:`1px solid ${C.border}`,display:"flex",flexDirection:"column",overflow:"hidden",boxShadow:"-8px 0 32px rgba(0,0,0,0.1)",animation:"dIn .22s cubic-bezier(.32,.72,0,1)"}} onClick={e=>e.stopPropagation()}>
        <style>{`@keyframes dIn{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>

        <div style={{padding:"18px 18px 0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontFamily:font,fontWeight:800,fontSize:15,color:C.text}}>Rider Profile</span>
          <button onClick={onClose} style={{background:C.bg,border:"none",borderRadius:8,padding:6,cursor:"pointer",color:C.textMuted,display:"flex"}}><X size={16}/></button>
        </div>

        <div style={{padding:"18px",borderBottom:`1px solid ${C.border}`,display:"flex",flexDirection:"column",alignItems:"center",gap:10,textAlign:"center"}}>
          <Avatar name={rider.name} size={60}/>
          <div>
            <div style={{fontFamily:font,fontWeight:800,fontSize:18,color:C.text}}>{rider.name}</div>
            <div style={{marginTop:6}}><Badge status={rider.status}/></div>
          </div>
          <div style={{display:"flex",gap:20,marginTop:4}}>
            <div style={{textAlign:"center"}}>
              <div style={{fontFamily:mono,fontWeight:700,fontSize:20,color:C.text}}>{rider.rides}</div>
              <div style={{fontFamily:font,fontSize:11,color:C.textMuted}}>Rides</div>
            </div>
            <div style={{width:1,background:C.border}}/>
            <div style={{textAlign:"center"}}>
              <div style={{fontFamily:mono,fontWeight:700,fontSize:20,color:rider.rating?C.yellow:C.textMuted}}>{rider.rating??"—"}</div>
              <div style={{fontFamily:font,fontSize:11,color:C.textMuted}}>Rating</div>
            </div>
          </div>
        </div>

        <div style={{padding:18,flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:14}}>
          {[
            {icon:<Mail size={13}/>,    label:"Email",      val:rider.email},
            {icon:<Hash size={13}/>,    label:"UID",        val:rider.uid,  mono:true},
            {icon:<Calendar size={13}/>,label:"Joined",     val:fmt(rider.createdAt)},
            {icon:<Clock size={13}/>,   label:"Last Ride",  val:fmt(rider.lastRide)},
            {icon:<Shield size={13}/>,  label:"Email Sent", val:rider.welcomeEmailSent?"Yes":"No"},
            {icon:<MapPin size={13}/>,  label:"Market",     val:"Orlando, FL"},
          ].map(r=>(
            <div key={r.label} style={{display:"flex",gap:10,alignItems:"flex-start"}}>
              <div style={{color:C.textMuted,marginTop:1,flexShrink:0}}>{r.icon}</div>
              <div style={{minWidth:0}}>
                <div style={{fontFamily:font,fontSize:10.5,fontWeight:700,color:C.textMuted,textTransform:"uppercase",letterSpacing:"0.06em"}}>{r.label}</div>
                <div style={{fontFamily:r.mono?mono:font,fontSize:r.mono?10:12.5,color:C.textSub,marginTop:2,wordBreak:"break-all"}}>{r.val}</div>
              </div>
            </div>
          ))}
          {rider.adminNote&&(
            <div style={{background:C.yellowLight,border:`1px solid ${C.yellowMid}`,borderRadius:10,padding:"10px 12px"}}>
              <div style={{fontFamily:font,fontSize:10.5,fontWeight:700,color:C.yellow,marginBottom:4}}>ADMIN NOTE</div>
              <div style={{fontFamily:font,fontSize:12.5,color:C.textSub}}>{rider.adminNote}</div>
            </div>
          )}
        </div>

        <div style={{padding:14,borderTop:`1px solid ${C.border}`,display:"flex",gap:8}}>
          <button onClick={()=>onAction("note",rider)} style={{flex:1,padding:"10px 0",borderRadius:12,border:`1px solid ${C.border}`,background:C.bg,color:C.textSub,fontFamily:font,fontWeight:600,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
            <FileText size={13}/> Note
          </button>
          <button onClick={()=>{onClose();onAction("open-menu",rider);}} style={{flex:2,padding:"10px 0",borderRadius:12,border:"none",background:C.accent,color:"#fff",fontFamily:font,fontWeight:700,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
            <MoreHorizontal size={13}/> All Actions
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({icon,label,value,color,sub}){
  return (
    <div style={{flex:1,background:C.surface,borderRadius:14,border:`1px solid ${C.border}`,padding:"16px 18px",boxShadow:C.shadow}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
        <div style={{fontFamily:font,fontSize:11,fontWeight:700,color:C.textMuted,textTransform:"uppercase",letterSpacing:"0.06em"}}>{label}</div>
        <div style={{background:color+"18",borderRadius:8,padding:6,display:"flex",color}}>{icon}</div>
      </div>
      <div style={{fontFamily:mono,fontSize:26,fontWeight:700,color:C.text,lineHeight:1}}>{value}</div>
      {sub&&<div style={{fontFamily:font,fontSize:11.5,color:C.textMuted,marginTop:5}}>{sub}</div>}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export function RidersTab({useriders,onBack}){
  const rawRiders=(useriders?.riders)||MOCK;
  const [local,setLocal]     = useState({});
  const [search,setSearch]   = useState("");
  const [filter,setFilter]   = useState("all");
  const [fOpen,setFOpen]     = useState(false);
  const [drawer,setDrawer]   = useState(null);
  const [menu,setMenu]       = useState(null);
  const [confirm,setConfirm] = useState(null);
  const [noteText,setNote]   = useState("");

  const riders=rawRiders.map(r=>({...r,...(local[r.uid]||{}),status:local[r.uid]?.status||r.status||"active"}));
  const counts={all:riders.length,active:0,suspended:0,banned:0};
  riders.forEach(r=>{if(counts[r.status]!==undefined)counts[r.status]++;});

  const filtered=riders
    .filter(r=>!local[r.uid]?.deleted)
    .filter(r=>{
      if(filter!=="all"&&r.status!==filter) return false;
      const q=search.toLowerCase();
      return !q||[r.name,r.email,r.uid].some(v=>(v||"").toLowerCase().includes(q));
    });

  function handleAction(action,rider){
    if(action==="open-menu"){setDrawer(null);setMenu(rider);return;}
    if(action==="view"){setMenu(null);setDrawer(rider);return;}
    if(action==="history"){alert(`Ride history for ${rider.name} — wire to your rides collection`);return;}
    if(action==="email"){alert(`Email composer for ${rider.email}`);return;}
    if(action==="reset"){alert(`Password reset sent to ${rider.email}`);return;}
    if(action==="verify"){setLocal(p=>({...p,[rider.uid]:{...p[rider.uid],welcomeEmailSent:true}}));return;}
    if(action==="export"){alert(`Exporting data for ${rider.name}…`);return;}
    setNote(rider.adminNote||"");
    setConfirm({action,rider});
    setMenu(null);setDrawer(null);
  }

  function handleConfirm(){
    const{action,rider}=confirm;
    const patch={};
    if(action==="suspend")   patch.status="suspended";
    if(action==="ban")       patch.status="banned";
    if(action==="reinstate") patch.status="active";
    if(action==="flag")      patch.adminNote=noteText||"Flagged for review";
    if(action==="note")      patch.adminNote=noteText;
    if(action==="delete")    patch.deleted=true;
    setLocal(p=>({...p,[rider.uid]:{...p[rider.uid],...patch}}));
    setConfirm(null);
  }

  const fLabels={all:"All",active:"Active",suspended:"Suspended",banned:"Banned"};

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet"/>

      <div style={{background:C.bg,minHeight:"100vh",fontFamily:font}}>
        <div style={{maxWidth:560,margin:"0 auto",padding:"20px 16px 48px"}}>

          {onBack&&(
            <button onClick={onBack} style={{display:"flex",alignItems:"center",gap:7,background:"none",border:"none",cursor:"pointer",color:C.textMuted,fontSize:13.5,fontWeight:600,marginBottom:20,padding:0}}>
              <ArrowLeft size={15}/> Back
            </button>
          )}

          {/* Header */}
          <div style={{marginBottom:22}}>
            <div style={{fontSize:24,fontWeight:800,color:C.text,letterSpacing:"-0.025em"}}>Rider Management</div>
            <div style={{fontSize:13.5,color:C.textMuted,marginTop:3}}>Manage access, accounts, and rider activity</div>
          </div>

          {/* Stats grid */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
            <StatCard icon={<Users size={15}/>}         label="Total"     value={counts.all}       color={C.blue}   sub={`${counts.active} active`}/>
            <StatCard icon={<Activity size={15}/>}      label="Active"    value={counts.active}    color={C.accent} sub="Full access"/>
            <StatCard icon={<AlertTriangle size={15}/>} label="Suspended" value={counts.suspended} color={C.yellow} sub="Temp. blocked"/>
            <StatCard icon={<Ban size={15}/>}           label="Banned"    value={counts.banned}    color={C.red}    sub="Permanent"/>
          </div>

          {/* Search + filter */}
          <div style={{display:"flex",gap:8,marginBottom:16}}>
            <div style={{flex:1,display:"flex",alignItems:"center",gap:10,background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:"0 14px",boxShadow:C.shadow}}>
              <Search size={14} color={C.textMuted}/>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search riders…" style={{flex:1,background:"none",border:"none",outline:"none",color:C.text,fontFamily:font,fontSize:13.5,padding:"11px 0"}}/>
              {search&&<button onClick={()=>setSearch("")} style={{background:"none",border:"none",cursor:"pointer",color:C.textMuted,display:"flex"}}><X size={13}/></button>}
            </div>
            <div style={{position:"relative"}}>
              <button onClick={()=>setFOpen(p=>!p)} style={{display:"flex",alignItems:"center",gap:6,height:"100%",background:filter!=="all"?C.accentLight:C.surface,border:`1px solid ${filter!=="all"?C.accent+"55":C.border}`,borderRadius:12,padding:"0 14px",color:filter!=="all"?C.accent:C.textSub,fontFamily:font,fontSize:13.5,fontWeight:600,cursor:"pointer",boxShadow:C.shadow,whiteSpace:"nowrap"}}>
                {fLabels[filter]} <ChevronDown size={13}/>
              </button>
              {fOpen&&(
                <div style={{position:"absolute",top:"calc(100% + 6px)",right:0,background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden",zIndex:200,boxShadow:C.shadowMd,minWidth:160}}>
                  {Object.entries(fLabels).map(([k,l])=>(
                    <button key={k} onClick={()=>{setFilter(k);setFOpen(false);}} style={{display:"flex",justifyContent:"space-between",alignItems:"center",width:"100%",padding:"10px 14px",background:filter===k?C.accentLight:"none",border:"none",color:filter===k?C.accent:C.textSub,fontFamily:font,fontSize:13.5,fontWeight:filter===k?700:500,cursor:"pointer"}}>
                      {l}
                      <span style={{fontFamily:mono,fontSize:11,opacity:.6,marginLeft:16}}>{counts[k]}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Error / empty */}
          {useriders?.error&&<div style={{background:C.redLight,border:`1px solid ${C.redMid}`,borderRadius:12,padding:"12px 16px",color:C.red,fontSize:13,marginBottom:12}}>Error: {useriders.error.message}</div>}
          {!useriders?.loading&&filtered.length===0&&(
            <div style={{textAlign:"center",padding:56,color:C.textMuted}}>
              <Users size={36} style={{opacity:.2,marginBottom:12}}/>
              <div style={{fontFamily:font,fontSize:14}}>{search?"No riders match your search":"No riders found"}</div>
            </div>
          )}

          {/* Rider list */}
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {filtered.map((rider,i)=>(
              <div key={rider.uid} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:"14px 14px",display:"flex",alignItems:"center",gap:12,boxShadow:C.shadow,cursor:"pointer",animation:`fUp .2s ease ${i*.04}s both`,transition:"border-color .12s,box-shadow .12s"}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=C.borderHov;e.currentTarget.style.boxShadow=C.shadowMd;}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.boxShadow=C.shadow;}}
                onClick={()=>setDrawer(rider)}
              >
                <style>{`@keyframes fUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
                <Avatar name={rider.name} size={42}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:3,flexWrap:"wrap"}}>
                    <span style={{fontFamily:font,fontWeight:700,fontSize:14.5,color:C.text}}>{rider.name}</span>
                    <Badge status={rider.status}/>
                    {(local[rider.uid]?.adminNote||rider.adminNote)&&<Flag size={11} color={C.yellow}/>}
                  </div>
                  <div style={{fontSize:12.5,color:C.textMuted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{rider.email}</div>
                  <div style={{display:"flex",gap:12,marginTop:5,flexWrap:"wrap"}}>
                    <span style={{fontFamily:mono,fontSize:10.5,color:C.textMuted}}>{rider.rides} rides</span>
                    {rider.rating&&<span style={{fontFamily:mono,fontSize:10.5,color:C.yellow}}>★ {rider.rating}</span>}
                    <span style={{fontFamily:mono,fontSize:10.5,color:C.textMuted}}>{fmt(rider.createdAt)}</span>
                  </div>
                </div>
                <button onClick={e=>{e.stopPropagation();setMenu(rider);}} style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,padding:7,cursor:"pointer",color:C.textMuted,display:"flex",flexShrink:0}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=C.accent;e.currentTarget.style.color=C.accent;}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.textMuted;}}
                >
                  <MoreHorizontal size={16}/>
                </button>
              </div>
            ))}
          </div>

          {filtered.length>0&&(
            <div style={{textAlign:"center",fontFamily:font,fontSize:12,color:C.textMuted,marginTop:16}}>
              {filtered.length} of {riders.length} rider{riders.length!==1?"s":""}
            </div>
          )}
        </div>
      </div>

      {drawer  && <Drawer       rider={drawer}          onClose={()=>setDrawer(null)}  onAction={handleAction}/>}
      {menu    && <ActionsMenu  rider={menu}            onClose={()=>setMenu(null)}    onAction={handleAction}/>}
      {confirm && <ConfirmModal action={confirm.action} rider={confirm.rider} note={noteText} setNote={setNote} onConfirm={handleConfirm} onCancel={()=>setConfirm(null)}/>}
    </>
  );
}

export default RidersTab;
