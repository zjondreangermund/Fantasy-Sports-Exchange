import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, Bell, BellOff, CheckCheck, Download, RefreshCw, Search, Send, Smartphone, AlertTriangle, Clock3, ShieldCheck, Users } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";

type AuditSummary = {
  hours:number; inboxCreated:number; inboxRead:number; inboxUnread:number;
  sentJobs:number; pendingJobs:number; failedJobs:number; notificationsPushed:number;
  accounts:number; usersWithPush:number; androidDevices:number; webDevices:number; note:string;
};
type AuditEvent = {
  id:number; userId:string; manager:string; email:string|null; title:string; message:string;
  dedupeKey:string|null; inboxRead:boolean; createdAt:string|null;
  deliveryStatus:"sent"|"failed"|"pending"|"inbox-only";
  androidSent:number; webSent:number; pending:number; failed:number;
  androidSubscriptions:number; webSubscriptions:number; lastProviderSentAt:string|null;
};
type AuditEvents = {events:AuditEvent[];total:number;page:number;pages:number;hours:number;status:string};
type Coverage = {userId:string;manager:string;email:string|null;androidDevices:number;webDevices:number;
  disabledAndroid:number;disabledWeb:number;mintPref:string|null;
  lastProviderSentAt:string|null;inboxLast7Days:number;};
type CoverageResult={users:Coverage[];total:number;page:number;pages:number;note:string};
const safeNumber=(value:unknown)=>Number.isFinite(Number(value))?Number(value):0;
const fmtTime=(date:string|null|undefined)=>{
  if(!date)return "—";
  const d=new Date(date);
  return Number.isFinite(d.getTime())?d.toLocaleString("en-NA",{timeZone:"Africa/Windhoek",dateStyle:"medium",timeStyle:"short"}):"—";
};
const styleFor=(status:string)=>{
  switch(status) {
    case "sent": return "border-emerald-300/25 bg-emerald-300/10 text-emerald-200";
    case "failed":return "border-red-300/25 bg-red-400/10 text-red-200";
    case "pending":return "border-amber-300/25 bg-amber-400/10 text-amber-200";
    default:return "border-slate-300/15 bg-white/5 text-slate-300";
  }
};
function exportCurrentPage(items:AuditEvent[]){
  const columns=["createdAt","manager","email","userId","title","message","deliveryStatus","androidSent","webSent","pending","failed","inboxRead","dedupeKey"] as const;
  const quote=(value:unknown)=>`"${String(value??"").replace(/"/g,'""')}"`;
  const content=[columns.join(","),...items.map(row=>columns.map(field=>quote(field==="createdAt"?fmtTime(row.createdAt):row[field])).join(","))].join("\r\n");
  const blob=new Blob(["\uFEFF",content],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const link=document.createElement("a");
  link.href=url;link.download=`fantasy-arena-notifications-page-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);
}
function Metric({label,value,icon:Icon,description}:{label:string;value:number;icon:any;description?:string}){
  return <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
    <div className="flex items-center gap-2 text-xs font-bold text-white/50"><Icon className="h-4 w-4 text-cyan-200"/>{label}</div>
    <div className="mt-2 text-2xl font-black text-white">{safeNumber(value).toLocaleString("en-NA")}</div>
    {description?<p className="mt-1 text-[11px] text-white/40">{description}</p>:null}
  </div>;
}
function Pager({page,pages,onChange}:{page:number;pages:number;onChange:(value:number)=>void}){
  return <div className="mt-3 flex items-center justify-between gap-3 text-xs text-white/55">
    <Button type="button" size="sm" variant="outline" disabled={page<=1} onClick={()=>onChange(page-1)} className="border-white/20 text-white">Previous</Button>
    <span>Page {page} / {Math.max(1,pages)}</span>
    <Button type="button" size="sm" variant="outline" disabled={page>=pages} onClick={()=>onChange(page+1)} className="border-white/20 text-white">Next</Button>
  </div>;
}
export default function AdminNotificationAuditPanel({onOpenUser}:{onOpenUser?:(id:string)=>void}){
  const [hours,setHours]=useState(168);
  const [eventInput,setEventInput]=useState("");
  const [eventSearch,setEventSearch]=useState("");
  const [eventStatus,setEventStatus]=useState("all");
  const [eventPage,setEventPage]=useState(1);
  const [userInput,setUserInput]=useState("");
  const [userSearch,setUserSearch]=useState("");
  const [coverage,setCoverage]=useState("all");
  const [userPage,setUserPage]=useState(1);
  const summaryUrl=`/api/admin/notification-audit/summary?hours=${hours}`;
  const eventsUrl=`/api/admin/notification-audit/events?hours=${hours}&page=${eventPage}&limit=40&status=${encodeURIComponent(eventStatus)}&q=${encodeURIComponent(eventSearch)}`;
  const usersUrl=`/api/admin/notification-audit/users?page=${userPage}&limit=40&coverage=${encodeURIComponent(coverage)}&q=${encodeURIComponent(userSearch)}`;
  const summary=useQuery<AuditSummary>({queryKey:[summaryUrl],refetchInterval:60_000});
  const events=useQuery<AuditEvents>({queryKey:[eventsUrl],refetchInterval:60_000});
  const users=useQuery<CoverageResult>({queryKey:[usersUrl],refetchInterval:60_000});
  const selected=(items:any[]|undefined)=>Array.isArray(items)?items:[];
  const inspect=(row:Coverage)=>{
    setEventInput(row.email||row.userId);
    setEventSearch(row.userId);
    setEventPage(1);
    document.getElementById("admin-notification-history")?.scrollIntoView({behavior:"smooth",block:"start"});
  };
  return <div className="space-y-5 text-white">
    <div className="rounded-2xl border border-cyan-400/20 bg-gradient-to-r from-cyan-900/25 via-slate-900/75 to-fuchsia-900/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h3 className="flex items-center gap-2 text-lg font-black"><Bell className="h-5 w-5 text-cyan-200"/>Notification Delivery Centre</h3>
          <p className="mt-1 max-w-3xl text-sm text-white/60">Search every player's Inbox event, phone push attempts, read status, and registered notification devices. Read-only — never turn a player's notifications back on without consent.</p>
        </div>
        <div className="flex items-center gap-2">
          <select aria-label="Reporting period" className="rounded-xl border border-white/15 bg-[#10172a] px-3 py-2 text-sm text-white" value={hours} onChange={e=>{setHours(Number(e.target.value));setEventPage(1);}}>
            <option value={24}>Last 24 hours</option><option value={168}>Last 7 days</option><option value={720}>Last 30 days</option>
          </select>
          <Button type="button" variant="outline" onClick={()=>{void summary.refetch();void events.refetch();void users.refetch();}} className="border-white/15 text-white"><RefreshCw className="mr-2 h-4 w-4"/>Refresh</Button>
        </div>
      </div>
      <p className="mt-3 rounded-xl border border-amber-300/20 bg-amber-300/[.06] p-3 text-xs text-amber-100"><ShieldCheck className="mr-1 inline h-4 w-4"/>“Sent” means the provider accepted the message, not that it appeared on the phone. “Read” means opened/marked read in the Fantasy Arena Inbox. Android notification permission cannot be verified from registered tokens alone.</p>
    </div>
    {summary.isError?<div className="rounded-xl border border-red-400/25 bg-red-500/10 p-3 text-sm text-red-200">Notification reporting failed to load. Refresh or check the server logs.</div>:null}
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Metric label="Inbox events" icon={Bell} value={summary.data?.inboxCreated||0} description="Records created in this period"/>
      <Metric label="Provider accepted" icon={Send} value={summary.data?.sentJobs||0} description="Android and web device deliveries"/>
      <Metric label="Pending device jobs" icon={Clock3} value={summary.data?.pendingJobs||0} description="Queued or processing"/>
      <Metric label="Failed device jobs" icon={AlertTriangle} value={summary.data?.failedJobs||0} description="Check affected managers below"/>
      <Metric label="Inbox read" icon={CheckCheck} value={summary.data?.inboxRead||0} description="Marked read inside Fantasy Arena"/>
      <Metric label="Managers with push" icon={Users} value={summary.data?.usersWithPush||0} description={`Of ${safeNumber(summary.data?.accounts)} registered accounts`}/>
      <Metric label="Android connections" icon={Smartphone} value={summary.data?.androidDevices||0} description="Registered Android push tokens"/>
      <Metric label="Web connections" icon={Activity} value={summary.data?.webDevices||0} description="Registered browser subscriptions"/>
    </div>

    <section id="admin-notification-history" className="rounded-2xl border border-white/10 bg-white/[.04] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h4 className="text-base font-black">Notification history</h4><p className="text-xs text-white/45">Includes push-accepted, pending, failed and Inbox-only messages.</p></div>
        <Button variant="outline" type="button" disabled={!events.data?.events?.length} onClick={()=>exportCurrentPage(events.data?.events||[])} className="border-white/20 text-white"><Download className="mr-2 h-4 w-4"/>Export displayed page</Button>
      </div>
      <form onSubmit={event=>{event.preventDefault();setEventSearch(eventInput.trim());setEventPage(1);}} className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_160px_auto]">
        <Input aria-label="Find user or notification" placeholder="Manager, email, ID, event, title…" value={eventInput} onChange={e=>setEventInput(e.target.value)} className="border-white/10 bg-black/35"/>
        <select aria-label="Delivery status filter" value={eventStatus} onChange={e=>{setEventStatus(e.target.value);setEventPage(1);}} className="rounded-xl border border-white/15 bg-[#10172a] px-2 text-sm text-white">
          <option value="all">All statuses</option><option value="sent">Provider accepted</option><option value="pending">Queued / processing</option><option value="failed">Failed</option><option value="inbox-only">Inbox only</option>
        </select>
        <Button type="submit"><Search className="mr-2 h-4 w-4"/>Search</Button>
      </form>
      {events.isError?<p className="mt-4 text-sm text-red-200">Could not fetch notification history. Try Refresh.</p>:null}
      <div className="mt-4 max-h-[45dvh] space-y-2 overflow-y-auto overscroll-contain pr-1">
        {events.isFetching&&!events.data?<p className="p-6 text-center text-white/50">Loading delivery history…</p>:null}
        {selected(events.data?.events).map((row:AuditEvent)=><div key={row.id} className="rounded-xl border border-white/10 bg-black/30 p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0"><div className="font-bold">{row.title}</div><button type="button" className="mt-1 text-left text-xs text-cyan-200 hover:underline" onClick={()=>onOpenUser?.(row.userId)}>{row.manager} · {row.email||row.userId}</button></div>
            <Badge variant="outline" className={styleFor(row.deliveryStatus)}>{row.deliveryStatus==="sent"?"Provider accepted":row.deliveryStatus==="inbox-only"?"Inbox only":row.deliveryStatus==="pending"?"Queued / processing":"Failed"}</Badge>
          </div>
          <p className="mt-2 break-words text-xs text-white/70">{row.message}</p>
          <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-white/50">
            <span>{fmtTime(row.createdAt)} Namibia</span>
            <span>Android sent {row.androidSent}</span><span>Web sent {row.webSent}</span>
            {row.pending>0?<span>Pending {row.pending}</span>:null}{row.failed>0?<span className="text-red-200">Failed {row.failed}</span>:null}
            <span>Inbox {row.inboxRead?"read":"unread"}</span>
            {row.deliveryStatus==="inbox-only"?<span className="text-amber-100/70">No device job recorded; possibly no subscription, user preference or rate limit</span>:null}
          </div>
          {row.dedupeKey?<p className="mt-2 break-all font-mono text-[10px] text-white/30">{row.dedupeKey}</p>:null}
        </div>)}
        {!events.isFetching&&!events.data?.events?.length?<p className="rounded-xl border border-dashed border-white/10 p-5 text-center text-sm text-white/50">No matching notifications in this period.</p>:null}
      </div>
      <div className="mt-3 text-xs text-white/40">{safeNumber(events.data?.total)} matching notification records</div>
      <Pager page={eventPage} pages={events.data?.pages||1} onChange={setEventPage}/>
    </section>

    <section className="rounded-2xl border border-white/10 bg-white/[.04] p-4">
      <h4 className="flex items-center gap-2 text-base font-black"><BellOff className="h-4 w-4 text-amber-200"/>User notification connections</h4>
      <p className="mt-1 text-xs text-white/50">See who has a registered push connection, who has no active token and who muted optional mint reminders. These are server registration signals, not proof of phone permissions.</p>
      <form className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_170px_auto]" onSubmit={e=>{e.preventDefault();setUserSearch(userInput.trim());setUserPage(1);}}>
        <Input value={userInput} onChange={e=>setUserInput(e.target.value)} aria-label="Search manager connections" placeholder="Manager, email or account ID" className="border-white/10 bg-black/35"/>
        <select aria-label="Connection filter" value={coverage} onChange={e=>{setCoverage(e.target.value);setUserPage(1);}} className="rounded-xl border border-white/15 bg-[#10172a] px-2 text-sm text-white">
          <option value="all">All managers</option><option value="connected">Push connected</option><option value="no-push">No push connection</option><option value="mint-muted">Mint pushes muted</option>
        </select>
        <Button type="submit"><Search className="mr-2 h-4 w-4"/>Find</Button>
      </form>
      {users.isError?<p className="mt-4 text-sm text-red-200">Couldn't load user connections.</p>:null}
      <div className="mt-3 max-h-[38dvh] space-y-2 overflow-y-auto">
        {users.isFetching&&!users.data?<p className="p-5 text-center text-white/45">Loading connection status…</p>:null}
        {selected(users.data?.users).map((row:Coverage)=><div key={row.userId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/25 p-3">
          <div className="min-w-0"><div className="truncate text-sm font-bold">{row.manager}</div><div className="truncate text-xs text-white/40">{row.email||row.userId}</div><div className="mt-1 text-[11px] text-white/45">Inbox events (7 days): {row.inboxLast7Days} · Last provider send: {fmtTime(row.lastProviderSentAt)}</div></div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="outline" className={row.androidDevices+row.webDevices>0?styleFor("sent"):styleFor("failed")}>{row.androidDevices+row.webDevices>0?`Push registered · ${row.androidDevices} Android / ${row.webDevices} Web`:"No push token"}</Badge>
            {row.mintPref==="false"?<Badge variant="outline" className={styleFor("pending")}>Mint push muted</Badge>:null}
            <Button size="sm" variant="outline" type="button" className="border-white/20 text-white" onClick={()=>inspect(row)}>View sent alerts</Button>
          </div>
        </div>)}
        {!users.isFetching&&!users.data?.users?.length?<p className="p-5 text-center text-sm text-white/40">No managers found.</p>:null}
      </div>
      <div className="mt-2 text-xs text-white/40">{safeNumber(users.data?.total)} matching managers</div>
      <Pager page={userPage} pages={users.data?.pages||1} onChange={setUserPage}/>
      <p className="mt-3 text-[11px] leading-5 text-white/40">Players control OS permissions and optional in-app alert categories. To encourage opt-in, explain how notifications help with entry deadlines, red cards, prize claims and withdrawal updates — never silently reactivate an opted-out device.</p>
    </section>
  </div>;
}
