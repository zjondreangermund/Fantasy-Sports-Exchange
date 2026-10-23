import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock3, Mail, MessageSquareText, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { queryClient } from "../../lib/queryClient";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";

type Ticket={
 id:number;name:string;email:string;category:string;subject:string;message:string;
 status:"new"|"in_progress"|"waiting"|"resolved";adminNote:string|null;
 createdAt:string;updatedAt:string;
};
type Listing={requests:Ticket[];total:number;page:number;pages:number};
const states:[Ticket["status"],string][]=[
 ["new","New"],["in_progress","In progress"],["waiting","Waiting on player"],["resolved","Resolved"]
];
const nz=(v:any)=>Number.isFinite(Number(v))?Number(v):0;
export default function AdminSupportInboxPanel(){
 const [status,setStatus]=useState("all");
 const [q,setQ]=useState("");
 const [search,setSearch]=useState("");
 const [page,setPage]=useState(1);
 const [selected,setSelected]=useState<number|null>(null);
 const [notes,setNotes]=useState<Record<number,string>>({});
 const [ticketStates,setTicketStates]=useState<Record<number,Ticket["status"]>>({});
 const endpoint=`/api/admin/contact-requests?status=${status}&q=${encodeURIComponent(search)}&page=${page}&limit=30`;
 const {data,isLoading,isError,refetch}=useQuery<Listing>({
   queryKey:[endpoint],staleTime:0,refetchInterval:45_000,
   queryFn:async()=>{const r=await fetch(endpoint,{credentials:"include"});if(!r.ok)throw new Error("Could not load support requests");return r.json();}
 });
 const save=useMutation({
   mutationFn:async(ticket:Ticket)=>{
     const r=await fetch(`/api/admin/contact-requests/${ticket.id}`,{
       method:"PATCH",credentials:"include",headers:{"Content-Type":"application/json"},
       body:JSON.stringify({status:ticketStates[ticket.id]||ticket.status,adminNote:notes[ticket.id]??ticket.adminNote??""})
     });
     if(!r.ok)throw new Error("Couldn't save your changes");
     return r.json();
   },
   onSuccess:()=>void queryClient.invalidateQueries({queryKey:[endpoint]})
 });
 const tickets=data?.requests||[];
 return <section className="space-y-4 text-white" data-admin-support-inbox>
   <div className="rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-900/20 to-fuchsia-900/10 p-5">
     <div className="flex flex-wrap items-center justify-between gap-3">
       <div><h2 className="flex items-center gap-2 text-xl font-black"><MessageSquareText className="h-6 w-6 text-cyan-200"/>Fantasy Arena Support Inbox</h2>
         <p className="mt-1 text-xs leading-5 text-white/55">Requests from the website Contact Us form. Stored securely in the Fantasy Arena database, independently of email-hosting setup.</p></div>
       <Button variant="outline" onClick={()=>void refetch()} className="border-white/15 text-white"><RefreshCw className="mr-2 h-4 w-4"/>Refresh</Button>
     </div>
     <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_185px_auto]">
       <Input aria-label="Find a support request" value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){setSearch(q.trim());setPage(1);}}} className="border-white/10 bg-black/35" placeholder="Name, email, subject or reference"/>
       <select aria-label="Support ticket status" className="min-h-10 rounded-xl border border-white/15 bg-[#10172a] px-3 text-sm text-white" value={status} onChange={e=>{setStatus(e.target.value);setPage(1);}}><option value="all">All statuses</option>{states.map(([v,t])=><option key={v} value={v}>{t}</option>)}</select>
       <Button onClick={()=>{setSearch(q.trim());setPage(1);}}><Search className="mr-2 h-4 w-4"/>Find</Button>
     </div>
     <div className="mt-3 flex flex-wrap gap-3 text-xs text-white/50"><span><Mail className="mr-1 inline h-3.5 w-3.5"/>Contact site: <a href="/contact-us" className="text-cyan-200 underline">Contact Us</a></span><span>{nz(data?.total)} matching requests</span></div>
   </div>
   {isError?<div className="rounded-xl border border-red-300/20 bg-red-400/10 p-4 text-sm text-red-100">Unable to load the support queue. Check the server logs and try Refresh.</div>:null}
   {isLoading?<div className="p-6 text-center text-white/45">Loading requests…</div>:!tickets.length?<div className="rounded-xl border border-dashed border-white/15 p-8 text-center text-sm text-white/45">No support requests match this filter.</div>:<div className="max-h-[65dvh] space-y-3 overflow-y-auto overscroll-contain pr-1">
   {tickets.map(ticket=>{
     const open=selected===ticket.id;
     const state=ticketStates[ticket.id]||ticket.status;
     return <article key={ticket.id} className="rounded-2xl border border-white/10 bg-black/30 p-4">
       <button type="button" onClick={()=>setSelected(open?null:ticket.id)} className="flex w-full items-start justify-between gap-3 text-left">
         <div className="min-w-0"><div className="text-[10px] font-bold uppercase tracking-[.12em] text-white/45">FA-{String(ticket.id).padStart(6,"0")} · {ticket.category}</div>
           <div className="mt-1 break-words text-sm font-black">{ticket.subject}</div>
           <p className="mt-1 text-xs text-white/50">{ticket.name} · {ticket.email}</p>
           <p className="mt-1 text-[11px] text-white/35">{new Date(ticket.createdAt).toLocaleString("en-NA",{timeZone:"Africa/Windhoek",dateStyle:"medium",timeStyle:"short"})} Namibia</p></div>
         <Badge className={ticket.status==="resolved"?"bg-emerald-400/15 text-emerald-100":ticket.status==="new"?"bg-cyan-400/15 text-cyan-100":"bg-amber-400/15 text-amber-100"}>{states.find(x=>x[0]===ticket.status)?.[1]||ticket.status}</Badge>
       </button>
       {open?<div className="mt-4 space-y-3 border-t border-white/10 pt-4">
         <div className="rounded-xl border border-white/10 bg-white/[.03] p-4 text-sm leading-6 text-white/80 whitespace-pre-wrap break-words">{ticket.message}</div>
         <div className="grid gap-3 sm:grid-cols-2">
           <label className="text-xs font-bold text-white/60">Status<select value={state} onChange={e=>setTicketStates(prev=>({...prev,[ticket.id]:e.target.value as Ticket["status"]}))} className="mt-2 w-full rounded-lg border border-white/15 bg-[#10172a] px-3 py-2 text-white">{states.map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label>
           <div className="flex items-end"><a className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-3 text-xs font-black text-cyan-100" href={`mailto:${encodeURIComponent(ticket.email)}?subject=${encodeURIComponent(`Re: [FA-${String(ticket.id).padStart(6,"0")}] ${ticket.subject}`)}`}><Mail className="mr-2 h-4 w-4"/>Reply using email app</a></div>
         </div>
         <label className="block text-xs font-bold text-white/60">Private admin notes<textarea value={notes[ticket.id]??ticket.adminNote??""} maxLength={3000} onChange={e=>setNotes(prev=>({...prev,[ticket.id]:e.target.value}))} rows={3} className="mt-2 min-h-20 w-full rounded-lg border border-white/15 bg-[#10172a] p-3 text-sm text-white" placeholder="Notes and next steps — only admins can see this."/></label>
         <Button disabled={save.isPending} onClick={()=>save.mutate(ticket)} className="w-full bg-cyan-300 font-black text-slate-950 hover:bg-cyan-200"><CheckCircle2 className="mr-2 h-4 w-4"/>{save.isPending?"Saving…":"Save status and notes"}</Button>
         {save.isError?<p className="text-sm text-red-200">Couldn't save your changes. Please try again.</p>:null}
         <p className="flex items-start gap-2 text-[11px] leading-5 text-white/40"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0"/>Replies open your configured email application. Sending a reply is not automatic, and the customer's message remains recorded here.</p>
       </div>:null}
     </article>;
   })}
   </div>}
   <div className="flex items-center justify-between gap-4 text-sm text-white/50">
     <Button variant="outline" disabled={page<=1} className="border-white/15 text-white" onClick={()=>setPage(p=>p-1)}>Previous</Button>
     <span>Page {page} of {data?.pages||1}</span>
     <Button variant="outline" disabled={page>=(data?.pages||1)} className="border-white/15 text-white" onClick={()=>setPage(p=>p+1)}>Next</Button>
   </div>
   <p className="text-xs leading-5 text-white/40"><Clock3 className="mr-1 inline h-3.5 w-3.5"/>You can use the new support inbox immediately; verified domain-based email and automatic replies can be activated once mail service/DNS is connected.</p>
 </section>;
}
