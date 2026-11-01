import {useEffect,useRef,useState} from 'react';
import {Button} from './ui/button';
import {Input} from './ui/input';
export default function AssistantActionPanel({admin,target}:{admin:boolean;target:string}){
  const [kind,setKind]=useState('notification_read'),[recordId,setRecordId]=useState(''),[status,setStatus]=useState('in_progress');
  const [preview,setPreview]=useState<{token:string;description:string;expiresAt:string}|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const generation=useRef(0);
  useEffect(()=>{generation.current++;setPreview(null);setMessage('');},[kind,recordId,status,target,admin]);
  async function act(confirm=false){
    const sequence=generation.current;setBusy(true);setMessage('');
    try{
      const response=await fetch(`/api/assistant/${admin?'admin':'member'}/actions/${confirm?'confirm':'preview'}`,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(confirm?{token:preview?.token,confirmed:true}:{kind,recordId:Number(recordId),status,userId:target||undefined})});
      const data=await response.json();if(sequence!==generation.current)return;if(!response.ok)throw new Error(data.message||'Unable to complete action.');
      if(confirm){setPreview(null);setMessage(data.message);}else setPreview(data);
    }catch(error){if(sequence!==generation.current)return;setPreview(null);setMessage(error instanceof Error?error.message:'Action unavailable.');}finally{setBusy(false);}
  }
  return <details className="shrink-0 border-t border-white/10 px-3 py-2 text-xs text-white/70"><summary className="cursor-pointer text-cyan-200">Preview an action</summary><div className="mt-2 space-y-2">
    <p>Account: {target||'your signed-in account'}. Use the task catalogue for team submission, team edits and administrator settlement. Payments and balance corrections use their normal pages.</p>
    <label className="block">Action<select disabled={busy} aria-label="Assistant action" value={kind} onChange={e=>setKind(e.target.value)} className="mt-1 w-full rounded bg-slate-900 p-2"><option value="notification_read">Mark inbox notification as read</option>{admin?<option value="support_status">Update support request status</option>:null}</select></label>
    <Input disabled={busy} aria-label="Action record number" placeholder={kind==='support_status'?'Support request number':'Notification number'} value={recordId} onChange={e=>setRecordId(e.target.value)} inputMode="numeric"/>
    {kind==='support_status'?<label>Status<select disabled={busy} aria-label="New support status" value={status} onChange={e=>setStatus(e.target.value)} className="ml-2 rounded bg-slate-900 p-2">{['new','in_progress','waiting','resolved'].map(s=><option key={s}>{s}</option>)}</select></label>:null}
    {!preview?<Button size="sm" disabled={busy||!/^\d+$/.test(recordId)} onClick={()=>void act()}>Show preview</Button>:<div className="space-y-2 rounded border border-amber-200/30 p-2"><p>{preview.description}</p><p>Preview expires in 10 minutes. Confirming applies this change.</p><Button size="sm" disabled={busy} onClick={()=>void act(true)}>Confirm change</Button><Button size="sm" variant="ghost" disabled={busy} onClick={()=>setPreview(null)}>Cancel</Button></div>}
    {message?<p role="status">{message}</p>:null}
  </div></details>;
}
