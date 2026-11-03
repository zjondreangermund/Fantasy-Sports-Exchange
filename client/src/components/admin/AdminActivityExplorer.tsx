import {useEffect,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Activity,AlertTriangle,ArrowLeft,ArrowRight,RefreshCw,Search} from 'lucide-react';
import {Button} from '../ui/button';
import {Input} from '../ui/input';
import {Card} from '../ui/card';
export type ActivityFocus={userId?:string;outcome?:string;version:number};
const at=(value:string)=>new Date(value).toLocaleString('en-GB',{timeZone:'Africa/Windhoek',dateStyle:'medium',timeStyle:'medium'});
const pageName=(path:string)=>({'/':'Home','/marketplace':'Marketplace','/collection':'My cards','/competitions':'Enter Arena','/my-entries':'My teams','/wallet':'Wallet','/premier-league':'Premier League','/admin':'Admin'}[path]||path||'Site');
function title(item:any){
  if(item.category==='page')return `Opened ${pageName(item.path)}`;
  if(item.type==='client.interaction')return item.meta?.target||'Used a control';
  if(item.type==='client.error')return item.meta?.target||'App reported an error';
  if(item.category==='request')return `${item.outcome==='error'?'Failed':'Completed'} ${item.meta?.method||''} ${item.path||'request'}`;
  return String(item.label||item.type||'Activity').replace(/[._]/g,' ');
}
export default function AdminActivityExplorer({focus,onOpenUser}:{focus:ActivityFocus;onOpenUser:(id:string)=>void}){
  const [userId,setUserId]=useState(''),[user,setUser]=useState(''),[search,setSearch]=useState(''),[q,setQ]=useState(''),[userQuery,setUserQuery]=useState('');
  const [hours,setHours]=useState('24'),[category,setCategory]=useState('all'),[outcome,setOutcome]=useState('all'),[session,setSession]=useState(''),[page,setPage]=useState(1),[live,setLive]=useState(true);
  useEffect(()=>{setUserId(focus.userId||'');setOutcome(focus.outcome||'all');setHours('24');setCategory('all');setSession('');setPage(1);setSearch('');setQ('');setUser('');setUserQuery('');},[focus.version]);
  useEffect(()=>{const timer=setTimeout(()=>{setQ(search);setUserQuery(user);setPage(1);},350);return()=>clearTimeout(timer);},[search,user]);
  const params=new URLSearchParams({userId,user:userQuery,q,hours,category,outcome,session,page:String(page),limit:'40'});
  const {data,isFetching,error,refetch,dataUpdatedAt}=useQuery<any>({queryKey:[`/api/admin/activity?${params}`],refetchInterval:live&&page===1?20000:false});
  const follow=(id:string)=>{setUserId(id);setUser('');setUserQuery('');setSession('');setOutcome('all');setCategory('all');setPage(1);};
  const filter=(setter:(s:string)=>void,value:string)=>{setter(value);setPage(1);};
  const selectClass='min-h-11 w-full rounded-xl border border-white/15 bg-slate-950 px-3 text-sm text-white';
  const events:any[]=data?.activity||[];
  return <Card id="admin-activity-explorer" className="scroll-mt-4 overflow-hidden border-white/10 bg-slate-950/90 text-white">
    <div className="border-b border-white/10 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 text-xl font-black"><Activity className="h-5 w-5 text-cyan-200"/>User journeys & errors</h2><p className="mt-1 text-sm text-slate-300">Page visits, controls used, request outcomes and account transactions in one timeline.</p></div><div className="flex gap-2"><Button variant="outline" onClick={()=>setLive(!live)}>{live?'Auto refresh on':'Auto refresh off'}</Button><Button aria-label="Refresh activity" onClick={()=>refetch()}><RefreshCw className={isFetching?'h-4 w-4 animate-spin':'h-4 w-4'}/></Button></div></div>
      <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">{[['Events',data?.summary?.events],['Page visits',data?.summary?.visits],['Users',data?.summary?.users],['Errors / rejected',data?.summary?.errors]].map(([label,value])=><button key={String(label)} className="rounded-xl border border-white/10 bg-black/25 p-3 text-left hover:border-cyan-300/40" onClick={()=>{filter(setOutcome,label==='Errors / rejected'?'error':'all');if(label==='Page visits')setCategory('page');else setCategory('all');}}><div className="text-xs text-slate-400">{label}</div><div className="mt-1 text-2xl font-black">{value??'—'}</div></button>)}</div>
    </div>
    <div className="space-y-4 p-4 sm:p-6">
      {(data?.recentUsers||[]).length>0&&<section><div className="mb-2 text-xs font-bold uppercase tracking-wide text-cyan-200">Recently active · last 10 minutes</div><div className="flex gap-2 overflow-x-auto pb-2">{data.recentUsers.map((u:any)=><button key={u.userId} onClick={()=>follow(u.userId)} className="min-w-44 shrink-0 rounded-xl border border-cyan-300/20 bg-cyan-400/5 p-3 text-left"><div className="max-w-56 truncate font-bold">{u.userName}</div><div className="mt-1 text-xs text-slate-400">{pageName(u.path)}</div><div className="mt-1 text-[11px] text-slate-500">Last seen {at(u.lastSeen)}</div></button>)}</div></section>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1 text-xs text-slate-400">Find a user<Input value={user} onChange={e=>{setUser(e.target.value);setUserId('');setSession('');}} placeholder="Team name, email or user ID" className="min-h-11 bg-black/30 text-white"/></label>
        <label className="space-y-1 text-xs text-slate-400">Search events<Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Page, action or request reference" className="min-h-11 bg-black/30 text-white"/></label>
        <label className="space-y-1 text-xs text-slate-400">Period<select className={selectClass} value={hours} onChange={e=>filter(setHours,e.target.value)}><option value="1">Last hour</option><option value="24">Last 24 hours</option><option value="168">Last 7 days</option><option value="720">Last 30 days</option><option value="2160">Last 90 days</option></select></label>
        <label className="space-y-1 text-xs text-slate-400">Event type<select className={selectClass} value={category} onChange={e=>filter(setCategory,e.target.value)}>{[['all','All activity'],['page','Page visits'],['interaction','Controls & tabs'],['request','Requests & tasks'],['transaction','Transactions'],['account','Account events'],['security','Security']].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
      </div>
      <div className="flex flex-wrap items-center gap-2">{[['all','All outcomes'],['error','Errors & rejected attempts'],['pending','Pending transactions']].map(([v,l])=><Button key={v} size="sm" variant={outcome===v?'default':'outline'} onClick={()=>filter(setOutcome,v)}>{l}</Button>)}{(userId||session)&&<Button size="sm" variant="outline" onClick={()=>{setUserId('');setSession('');setPage(1);}}>Clear selected user / session</Button>}</div>
      {userId&&<div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/5 p-3 text-sm"><span>Following {events.find(e=>e.userId===userId)?.userName||userId}{session?' · selected session':''}</span><Button size="sm" variant="outline" onClick={()=>onOpenUser(userId)}>Open account</Button></div>}
      <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-400"><span>Namibia time · {data?.from?at(data.from):'Loading…'} – {data?.to?at(data.to):''}</span><span>{dataUpdatedAt?`Updated ${at(new Date(dataUpdatedAt).toISOString())}`:''}</span></div>
      {error&&<div role="alert" className="rounded-xl border border-red-300/30 bg-red-500/10 p-4 text-red-100">Activity could not be loaded. <button className="underline" onClick={()=>refetch()}>Try again</button></div>}
      {!error&&!events.length&&<div className="rounded-xl border border-dashed border-white/15 p-10 text-center text-slate-400">{isFetching?'Loading activity…':'No recorded activity matches these filters.'}</div>}
      <div className="space-y-3">{events.map((item:any,i:number)=>{
        const problem=item.outcome==='error',meta=item.meta||{},day=at(item.createdAt).split(',')[0],previous=i?at(events[i-1].createdAt).split(',')[0]:'';
        return <div key={item.id}>{day!==previous&&<div className="mb-3 mt-4 text-xs font-black uppercase tracking-wide text-slate-400">{day}</div>}<article className={`rounded-2xl border p-4 ${problem?'border-red-400/30 bg-red-500/[0.06]':'border-white/10 bg-white/[0.03]'}`}>
          <div className="flex flex-wrap justify-between gap-2"><div className="flex items-center gap-2"><span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${problem?'bg-red-500/20 text-red-200':'bg-cyan-500/10 text-cyan-200'}`}>{problem?'Error / rejected':item.category}</span><span className="text-xs text-slate-400">{at(item.createdAt)}</span></div><span className="text-[10px] text-slate-500">{item.id}</span></div>
          <h3 className="mt-3 break-words text-base font-bold">{title(item)}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm"><button className="font-bold text-cyan-200 hover:underline" disabled={!item.userId} onClick={()=>follow(item.userId)}>{item.userName||'System'}</button>{item.path&&<span className="break-all text-slate-400">{item.path}</span>}{item.amount!=null&&<strong>N${Number(item.amount).toFixed(2)}</strong>}</div>
          {meta.message&&<p className="mt-3 break-words rounded-lg bg-black/20 p-3 text-sm text-slate-200">{String(meta.message)}</p>}
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-400">{meta.status&&<span>Status {meta.status}</span>}{meta.durationMs!=null&&<span>{meta.durationMs} ms</span>}{meta.reportedBy==='browser'&&<span>App reported · does not confirm task completion</span>}{meta.requestId&&<span className="break-all">Reference {meta.requestId}</span>}</div>
          <details className="mt-3 border-t border-white/10 pt-3"><summary className="cursor-pointer text-xs font-bold text-slate-400">Record details</summary><div className="mt-3 flex flex-wrap gap-2">{item.userId&&<Button size="sm" variant="outline" onClick={()=>onOpenUser(item.userId)}>Open account</Button>}{item.session&&<Button size="sm" variant="outline" onClick={()=>{setSession(item.session);setOutcome('all');setCategory('all');if(item.userId)setUserId(item.userId);setPage(1);}}>Follow this session</Button>}</div><pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs text-slate-400">{JSON.stringify({action:item.type,userId:item.userId,...meta},null,2)}</pre></details>
        </article></div>;
      })}</div>
      <div className="flex items-center justify-between gap-2"><span className="text-xs text-slate-400">{data?.total||0} matching events · page {page} of {data?.pages||1}</span><div className="flex gap-2"><Button aria-label="Previous activity page" variant="outline" disabled={page<=1} onClick={()=>setPage(page-1)}><ArrowLeft className="h-4 w-4"/></Button><Button aria-label="Next activity page" variant="outline" disabled={page>=(data?.pages||1)} onClick={()=>setPage(page+1)}><ArrowRight className="h-4 w-4"/></Button></div></div>
      <p className="border-t border-white/10 pt-4 text-xs leading-relaxed text-slate-500">Recorded activity helps investigate what happened; it does not reconstruct unrecorded history. Page visits are retained for 90 days. New control and request tracking starts with this update. Typed text, passwords, payment details and private messages are excluded. Recent activity does not prove someone is still looking at the screen.</p>
    </div>
  </Card>;
}
