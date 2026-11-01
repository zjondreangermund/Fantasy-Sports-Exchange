import {useQueryClient} from '@tanstack/react-query';
import {Link} from 'wouter';
import {useEffect,useState} from 'react';
import {assistantTaskDefinitions,type AssistantTaskDraft} from '../../../shared/assistant-tasks';
import {Button} from './ui/button';
import {Input} from './ui/input';
export default function AssistantSiteTaskPanel({draft,audience}:{draft:AssistantTaskDraft;audience:'member'|'admin'}){
  const queryClient=useQueryClient();
  const [fields,setFields]=useState<Record<string,any>>(draft.fields),[options,setOptions]=useState<any>({cards:[],competitions:[],entries:[]});
  const [preview,setPreview]=useState<any>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[uncertain,setUncertain]=useState(false);
  const def=assistantTaskDefinitions[draft.kind];
  const destination=draft.kind==='team_rename'?'/account':draft.kind==='inbox_read_all'||draft.kind==='alert_preference'?'/account?tab=inbox':draft.kind.startsWith('team_')?'/my-entries':draft.kind.startsWith('admin_')?'/admin':draft.kind.includes('listing')||draft.kind.includes('watch')?'/marketplace':draft.kind==='prize_claim'?'/trophy-cabinet':'/collection';
  useEffect(()=>{let active=true;fetch(`/api/assistant/${audience}/tasks/options`,{credentials:'include'}).then(async r=>{const data=await r.json();if(active){if(r.ok){setOptions(data);if(draft.kind==='team_edit')setFields(f=>{const entry=data.entries?.find((e:any)=>e.id===Number(f.entryId));return entry&&!f.cardIds?{...f,cardIds:entry.cardIds,captainId:f.captainId||entry.captainId}:f;});}else setMessage(data.message||'Choices are unavailable.');}}).catch(()=>{if(active)setMessage('Choices are unavailable. You can use record numbers.');});return()=>{active=false;};},[]);
  function update(key:string,value:any){setFields(old=>({...old,[key]:value}));setPreview(null);setMessage('');setUncertain(false);}
  async function send(confirm=false){
    setBusy(true);setMessage('');
    try{
      const r=await fetch(`/api/assistant/${audience}/tasks/${confirm?'confirm':'preview'}`,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(confirm?{token:preview.token,confirmed:true}:{draft:{kind:draft.kind,fields}})});
      const data=await r.json();if(!r.ok)throw new Error(data.message||'Unable to verify this task.');
      if(confirm){if(data.state==='succeeded')void queryClient.invalidateQueries();setMessage(`${data.state==='succeeded'?'Completed':data.state==='rejected'?'Rejected':'Outcome not confirmed'}: ${data.message}${data.entryId?` Entry #${data.entryId}.`: ''}`);setPreview(null);setUncertain(false);}else{setPreview(data);setUncertain(false);}
    }catch(error){setMessage(confirm?'The outcome is not confirmed. Use Check task outcome or inspect the relevant site page before starting another task.':error instanceof Error?error.message:'Unable to prepare this task.');if(confirm)setUncertain(true);}finally{setBusy(false);}
  }
  const selectClass='mt-1 w-full rounded border border-white/15 bg-slate-950 p-2 text-xs text-white';
  return <section className="space-y-3 rounded-xl border border-cyan-300/25 bg-cyan-950/10 p-3 text-xs text-white/80">
    <p className="font-bold text-cyan-100">{def.label} · Your signed-in account</p>
    {!preview?<>
      {def.fields.map(field=>{
        if(field==='cardIds')return <div key={field} className="space-y-2">{['GK','DEF','MID','FWD','Utility'].map((slot,i)=><label key={slot} className="block">{slot}<select disabled={busy} aria-label={`${slot} card`} className={selectClass} value={fields.cardIds?.[i]||''} onChange={e=>{const ids=[...(fields.cardIds||[])];ids[i]=Number(e.target.value);update('cardIds',ids);}}><option value="">Select a card</option>{options.cards.filter((c:any)=>i<4?c.position===slot:['DEF','MID','FWD'].includes(c.position)).map((c:any)=><option value={c.id} key={c.id}>{c.name} · #{c.id} · {c.rarity}{c.forSale?' · ON SALE':''}</option>)}</select></label>)}<Input aria-label="Five card IDs" placeholder="Or five card IDs: 1,2,3,4,5" value={(fields.cardIds||[]).join(',')} onChange={e=>update('cardIds',e.target.value.split(',').map(v=>Number(v.trim())))}/></div>;
        if(field==='captainId')return <label className="block" key={field}>Captain<select disabled={busy} className={selectClass} aria-label="Captain card" value={fields.captainId||''} onChange={e=>update(field,Number(e.target.value))}><option value="">Choose your captain</option>{(fields.cardIds||[]).filter((id:any,i:number,all:any[])=>id>0&&all.indexOf(id)===i).map((id:number)=><option key={id} value={id}>#{id} {options.cards.find((c:any)=>c.id===id)?.name||''}</option>)}</select></label>;
        if(field==='competitionId'||field==='entryId'){
          const list=field==='competitionId'?options.competitions:options.entries;
          return <label className="block" key={field}>{field==='competitionId'?'Tournament':'Entry'}<select disabled={busy} className={selectClass} aria-label={field==='competitionId'?'Task tournament':'Task entry'} value={fields[field]||''} onChange={e=>{const n=Number(e.target.value);if(field==='entryId'&&draft.kind==='team_edit'){const entry=list.find((c:any)=>c.id===n);setFields(f=>({...f,entryId:n,cardIds:entry?.cardIds||[],captainId:entry?.captainId||''}));setPreview(null);}else update(field,n);}}><option value="">Select…</option>{list.map((item:any)=><option key={item.id} value={item.id}>#{item.id} {item.name} · GW{item.gameweek}{field==='competitionId'?` · N$${Number(item.entryFee).toFixed(2)}`:''}</option>)}</select><Input disabled={busy} className="mt-1" aria-label={`${field} number`} placeholder="Or enter its number" inputMode="numeric" value={fields[field]||''} onChange={e=>update(field,Number(e.target.value))}/></label>;
        }
        if(['jobType','category','enabled'].includes(field)){
          const values=field==='jobType'?['fixtures','live','completed_stats','standings','teams','players']:field==='category'?['tournament','players','prizes','marketplace','community','mint','marketing']:['true','false'];
          return <label key={field} className="block">{field==='enabled'?'Alerts on/off':field==='jobType'?'Sync job':'Alert category'}<select disabled={busy} className={selectClass} aria-label={field} value={fields[field]==null?'':String(fields[field])} onChange={e=>update(field,field==='enabled'?e.target.value==='true':e.target.value)}><option value="">Select…</option>{values.map(v=><option key={v} value={v}>{v==='true'?'On':v==='false'?'Off':v}</option>)}</select></label>;
        }
        return <label key={field} className="block">{field==='teamName'?'New manager team name':field==='price'?'Asking price (N$)':'Card number'}<Input disabled={busy} aria-label={field} value={fields[field]??''} onChange={e=>update(field,e.target.value)} inputMode={field==='teamName'?'text':'decimal'}/></label>;
      })}
      <Button size="sm" disabled={busy} onClick={()=>void send()}>Review task preview</Button>
    </>:<div className="space-y-3">
      <p className="font-bold text-amber-100">Review before confirming</p>
      {preview.rows.map((row:any,i:number)=><dl key={i} className="space-y-1 rounded border border-white/10 p-2">{Object.entries(row).map(([key,value])=><div key={key}><dt className="inline text-white/45">{key.replace(/([A-Z])/g,' $1')}: </dt><dd className="inline break-words">{typeof value==='boolean'?(value?'Yes':'No'):key==='entryFee'||key==='newAskingPrice'?`N$${Number(value).toFixed(2)}`:String(value)}</dd></div>)}</dl>)}
      <p>{preview.note}</p><p className="text-white/50">Expires in 10 minutes. Team changes stop at the gameweek’s first kickoff.</p>
      <div className="flex flex-wrap gap-2"><Button disabled={busy} size="sm" onClick={()=>void send(true)}>{uncertain?'Check task outcome':'Confirm this task'}</Button><Button variant="outline" disabled={busy} size="sm" onClick={()=>{setPreview(null);setUncertain(false);}}>Cancel preview</Button></div>
    </div>}
    <Link href={destination} className="inline-block text-cyan-200 underline">Open the relevant site page</Link>
    {message?<p role="status" className="whitespace-pre-wrap text-amber-100">{message}</p>:null}
  </section>;
}
