import AssistantSiteTaskPanel from './AssistantSiteTaskPanel';
import {assistantTaskDefinitions,type AssistantTaskDraft,type AssistantTaskKind} from '../../../shared/assistant-tasks';
import AssistantActionPanel from './AssistantActionPanel';
import {useQueryClient} from '@tanstack/react-query';
import {useEffect,useRef,useState} from 'react';
import {Link} from 'wouter';
import {Button} from './ui/button';
import {Input} from './ui/input';
type Section={title:string;rows:Array<Record<string,unknown>>;note?:string;hasMore?:boolean};
type Reply={taskDraft?:AssistantTaskDraft;context?:Record<string,unknown>;followUps?:string[];answer:string;sections:Section[];notes?:string[];links?:Array<{label:string;href:string}>;account?:{id:string;name?:string;teamName?:string};candidates?:Array<{id:string;name?:string;teamName?:string;email?:string}>;topics?:string[];period?:{from:string;to:string};asOf?:string;offset?:number;nextOffset?:number|null;scope?:string;limits?:string};
type Message={question:string;reply?:Reply;error?:string};
const labels=(key:string)=>key.replace(/([A-Z])/g,' $1').replace(/_/g,' ');
const date=(value:string)=>new Date(value).toLocaleString('en-NA',{timeZone:'Africa/Windhoek',dateStyle:'medium',timeStyle:'short'});
function cell(value:unknown):string{if(value==null)return '—';if(typeof value==='boolean')return value?'Yes':'No';if(typeof value==='object')return JSON.stringify(value);if(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(value))return date(value);return String(value);}
function Evidence({section}:{section:Section}){
  const columns=[...new Set(section.rows.flatMap(row=>Object.keys(row)))];
  return <details className="rounded-xl border border-white/10 bg-black/20 p-2"><summary className="cursor-pointer text-xs font-bold text-cyan-200">{section.title} ({section.rows.length}{section.hasMore?'+':''})</summary>{section.note?<p className="mt-2 text-[10px] leading-4 text-white/50">{section.note}</p>:null}{section.rows.length?<div className="mt-2 max-h-72 overflow-auto"><table className="w-full text-left text-[11px]"><thead><tr>{columns.map(column=><th key={column} className="whitespace-nowrap border-b border-white/15 p-2 capitalize">{labels(column)}</th>)}</tr></thead><tbody>{section.rows.map((row,index)=><tr key={index}>{columns.map(column=><td key={column} className="max-w-[240px] break-words border-b border-white/5 p-2 align-top">{cell(row[column])}</td>)}</tr>)}</tbody></table></div>:<p className="mt-2 text-xs text-white/55">No recorded results.</p>}</details>;
}
export default function ArenaAssistantPanel({userId,admin}:{userId:string;admin:boolean}){
  const queryClient=useQueryClient();
  const [selectedTask,setSelectedTask]=useState<AssistantTaskDraft|null>(null);
  const [question,setQuestion]=useState(''),[search,setSearch]=useState(''),[target,setTarget]=useState('');
  const [messages,setMessages]=useState<Message[]>([]),[busy,setBusy]=useState(false);
  const [listening,setListening]=useState(false),[voiceError,setVoiceError]=useState('');
  const recognition=useRef<any>(null);
  useEffect(()=>()=>{recognition.current?.abort();},[]);
  function voice(){
    if(listening){recognition.current?.stop();return;}
    const Speech=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;
    if(!Speech){setVoiceError('Voice input is unavailable in this browser. Type your question below.');return;}
    const instance=new Speech();recognition.current=instance;instance.lang='en-ZA';instance.interimResults=false;instance.continuous=false;
    instance.onresult=(event:any)=>{setQuestion(String(event.results[0][0].transcript).slice(0,2000));};
    instance.onerror=()=>{setVoiceError('Could not capture speech. Check microphone permission or type your question.');};
    instance.onend=()=>setListening(false);setVoiceError('');setListening(true);try{instance.start();}catch{setListening(false);setVoiceError('Microphone unavailable. Type your question.');}
  }
  const request=useRef(0),bottom=useRef<HTMLDivElement>(null);
  const previous=[...messages].reverse().find(message=>message.reply?.asOf)?.reply;
  useEffect(()=>{request.current++;setMessages([]);setSelectedTask(null);setTarget('');setSearch('');setBusy(false);recognition.current?.abort();},[userId,admin]);
  useEffect(()=>{bottom.current?.scrollIntoView({block:'nearest'});},[messages,busy]);
  async function ask(text:string,selected?:string,offset=0,context=previous){
    if(!text.trim()||busy||listening)return;
    const sequence=++request.current;setBusy(true);setQuestion('');
    setMessages(items=>[...items.slice(-9),{question:text}]);
    try{
      const response=await fetch(`/api/assistant/${admin?'admin':'member'}/ask`,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:text,userSearch:selected?undefined:search||undefined,userId:selected||target||undefined,previousTopics:context?.topics,period:context?.period,context:context?.context,offset})});
      const payload=await response.json();
      if(sequence!==request.current)return;
      if(!response.ok){if(response.status===401||response.status===403){setMessages([{question:text,error:payload.message||'This request is unavailable in this channel.'}]);setSelectedTask(null);setTarget('');setSearch('');if(response.status===401)void queryClient.invalidateQueries({queryKey:['/api/auth/user']});void queryClient.invalidateQueries({queryKey:['/api/assistant/access',userId]});}throw new Error(payload.message||'Unable to verify an answer.');}
      if(payload.account?.id)setTarget(payload.account.id);
      if(selected)setSearch('');
      setMessages(items=>items.map((item,index)=>index===items.length-1?{...item,reply:payload}:item));
    }catch(error){if(sequence===request.current)setMessages(items=>items.map((item,index)=>index===items.length-1?{...item,error:error instanceof Error?error.message:'Unable to verify an answer.'}:item));}
    finally{if(sequence===request.current)setBusy(false);}
  }
  const suggestions=admin?['Site views for today','Platform overview','Wallet balance and locked funds','Account activity yesterday','Why is tournament #… not settled?','Team availability','Conversion funnel today','Investigate notification #…']:['Search the marketplace','My purchases','My sales','My loans','My squad availability','Open tournaments','My wallet and deposits','What can you do?'];
  return <div className="flex min-h-0 flex-1 flex-col">
    <div className="shrink-0 border-b border-white/10 px-3 py-2">
      <p className="text-xs text-white/60">{admin?'Private Admin Assistant':'Member Help · your information only'} · {previous?.account?.teamName||previous?.account?.name||'Your account'}</p>
      <details className="mt-1 text-xs text-cyan-100"><summary className="cursor-pointer">Account, dates &amp; privacy</summary><div className="mt-2 max-h-40 space-y-2 overflow-y-auto">      {admin?<div className="flex gap-2"><Input disabled={busy} value={search} onChange={event=>{setSearch(event.target.value);setTarget('');setMessages([]);}} placeholder="Account email, manager name or ID" aria-label="Account to investigate" className="min-w-0 border-white/10 bg-white/5 text-xs text-white"/><Button disabled={busy} size="sm" variant="outline" onClick={()=>{request.current++;setSearch('');setTarget('');setMessages([]);}}>My account</Button></div>:null}
      <p className="text-[10px] leading-4 text-cyan-100">{admin?'Private administrator channel. Conversations are separate from Member Help and Community.':'Only your account information is available here. Other users’ private records and administrator reports are unavailable.'}</p>
      <p className="text-[10px] leading-4 text-white/45">Use “today”, “yesterday”, “this month”, “last 30 days” or YYYY-MM-DD dates. Follow-ups keep the selected account and period.</p>
</div></details>
    </div>
    <div className="arena-chat-messages min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-3">
      <details><summary className="cursor-pointer text-xs text-cyan-100">Site tasks</summary><label className="mt-2 block text-xs text-cyan-100">Prepare a site task<select aria-label="Site task catalogue" className="mt-1 w-full rounded border border-white/15 bg-slate-950 p-2 text-xs text-white" value={selectedTask?.kind||''} onChange={e=>setSelectedTask(e.target.value?{kind:e.target.value as AssistantTaskKind,fields:{}}:null)}><option value="">Choose a task…</option>{Object.entries(assistantTaskDefinitions).filter(([,def])=>admin||!def.admin).map(([kind,def])=><option key={kind} value={kind}>{def.label}</option>)}</select></label></details>
      {selectedTask?<AssistantSiteTaskPanel audience={admin?'admin':'member'} key={selectedTask.kind} draft={selectedTask}/>:null}
      {!messages.length?<><p className="text-sm leading-6 text-white/75">Search players and offers, check your account records, or prepare a site task. Ask naturally—for example, whether a player is for sale, what you bought, or your squad’s availability. I’ll state when information is missing.</p><div className="grid grid-cols-2 gap-2">{suggestions.map(text=><Button key={text} size="sm" variant="outline" className="h-auto whitespace-normal border-white/10 bg-white/5 p-2 text-left text-[11px] text-white" onClick={()=>text==='Search the marketplace'?setQuestion('Search marketplace for '):text.includes('…')?setQuestion(text):void ask(text)}>{text}</Button>)}</div></>:null}
      {messages.map((message,index)=><article key={index} className="space-y-2"><p className="ml-6 rounded-xl bg-violet-400/15 p-3 text-sm text-violet-100">{message.question}</p>{message.error?<p role="alert" className="rounded-xl border border-amber-300/20 p-3 text-xs text-amber-100">{message.error}</p>:null}{message.reply?<div className="space-y-2 rounded-xl border border-white/10 bg-white/[.03] p-3"><p className="whitespace-pre-wrap text-sm leading-6 text-white/85">{message.reply.answer}</p>{message.reply.taskDraft?<AssistantSiteTaskPanel audience={admin?'admin':'member'} key={`${userId}:${index}:${message.reply.taskDraft.kind}`} draft={message.reply.taskDraft}/>:null}{message.reply.candidates?.map(candidate=><Button disabled={busy} key={candidate.id} variant="outline" className="h-auto w-full justify-start whitespace-normal border-cyan-300/20 text-left text-xs text-cyan-100" onClick={()=>void ask(message.question,candidate.id,0,message.reply)}>{candidate.teamName||candidate.name||candidate.id} · {candidate.email}</Button>)}{message.reply.period&&message.reply.asOf?<details className="text-[10px] leading-4 text-white/45"><summary className="cursor-pointer">Report details · checked {date(message.reply.asOf)}</summary><p>{message.reply.scope} · {date(message.reply.period.from)} – {date(message.reply.period.to)} (Namibia). Checked {date(message.reply.asOf)}.<br/>{message.reply.limits}</p></details>:null}{message.reply.notes?.map(note=><p key={note} className="text-xs text-amber-100">{note}</p>)}{message.reply.sections?.map(section=><Evidence key={section.title} section={section}/>)}{message.reply.followUps?.length?<div className="flex flex-wrap gap-2">{message.reply.followUps.map(text=><Button disabled={busy} key={text} size="sm" variant="outline" className="h-auto whitespace-normal text-xs" onClick={()=>setQuestion(text)}>{text}</Button>)}</div>:null}{message.reply.nextOffset!=null?<Button disabled={busy} size="sm" variant="outline" onClick={()=>void ask(message.question,message.reply?.account?.id,message.reply!.nextOffset!,message.reply)}>Next 100 records</Button>:null}<div className="flex flex-wrap gap-2">{message.reply.links?.map(link=><Link key={link.href} href={link.href} className="rounded-lg border border-cyan-300/25 px-2 py-1 text-xs text-cyan-200">{link.label}</Link>)}</div></div>:null}</article>)}
    {admin&&search&&!target?<p className="px-3 text-xs text-amber-100">Resolve the account search with a question before previewing an account action.</p>:<AssistantActionPanel key={`${userId}:${admin}`} admin={admin} target={target}/>}
    <p className="px-3 text-[10px] text-white/45">Mic uses your browser’s speech service. Review the transcript before asking.</p>
      <Link href="/contact-us" className="block text-xs text-cyan-200">Contact Support</Link>
      {busy?<p role="status" className="text-xs text-cyan-100">Checking site records…</p>:null}<div ref={bottom}/>
    </div>
    {voiceError?<p role="status" className="px-3 text-xs text-amber-100">{voiceError}</p>:null}
    {listening?<p role="status" className="px-3 text-xs text-cyan-100">Listening… Tap Stop when finished. Review the transcript before asking.</p>:null}
    <form className="flex shrink-0 gap-2 border-t border-white/10 p-3" onSubmit={event=>{event.preventDefault();void ask(question);}}><Input value={question} onChange={event=>setQuestion(event.target.value)} maxLength={2000} placeholder="Ask a question…" aria-label="Ask Arena support" className="min-w-0 border-white/10 bg-white/5 text-white"/><Button type="button" variant="outline" aria-label={listening?'Stop microphone':'Dictate question'} title="Optional browser speech recognition; audio may be processed by your browser’s speech provider. Review text before sending." disabled={busy} onClick={voice}>{listening?'Stop':'Mic'}</Button><Button type="submit" disabled={busy||listening||!question.trim()}>Ask</Button></form>
  </div>;
}
