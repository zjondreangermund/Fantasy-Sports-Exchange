import {randomUUID} from 'node:crypto';
import {AssistantError,scopedAssistantUser} from './assistantPolicy.js';
import type {AssistantQuery} from './supportWalletSnapshot.js';
export const ASSISTANT_ACTION_SCHEMA=`CREATE TABLE IF NOT EXISTS app.assistant_action_previews (
 id uuid PRIMARY KEY,actor_id text NOT NULL,target_id text NOT NULL,kind text NOT NULL,
 record_id bigint NOT NULL,expected text NOT NULL,desired text NOT NULL,
 expires_at timestamptz NOT NULL DEFAULT now()+interval '10 minutes',completed_at timestamptz)`;
export async function previewAssistantAction(q:AssistantQuery,actor:string,admin:boolean,body:any){
  const target=scopedAssistantUser(actor,admin,body.userId);
  const kind=String(body.kind),id=Number(body.recordId);
  if(!Number.isSafeInteger(id)||id<1)throw new AssistantError('Provide a valid record number.');
  let expected='',desired='',description='';
  if(kind==='notification_read'){
    const n=(await q('SELECT read,title FROM app.notifications WHERE id=$1 AND user_id=$2',[id,target]))[0];
    if(!n)throw new AssistantError('Notification not found in the selected account.',404);
    expected=String(Boolean(n.read));desired='true';description=`Mark inbox notification #${id} “${n.title}” as read for account ${target}. This does not resend or delete it.`;
  }else if(kind==='support_status'){
    if(!admin)throw new AssistantError('Only administrators can update support requests.',403);
    desired=String(body.status);
    if(!['new','in_progress','waiting','resolved'].includes(desired))throw new AssistantError('Choose a valid support status.');
    const ticket=(await q('SELECT status,subject FROM app.support_requests WHERE id=$1',[id]))[0];
    if(!ticket)throw new AssistantError('Support request not found.',404);
    expected=String(ticket.status);description=`Change support request #${id} “${ticket.subject}” from ${expected} to ${desired}. This saves the status internally and sends no message.`;
  }else throw new AssistantError('This action is not connected. Use the normal page for payments, balances, entries and settlements.');
  const token=randomUUID();
  const row=(await q(`INSERT INTO app.assistant_action_previews(id,actor_id,target_id,kind,record_id,expected,desired) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING expires_at AS "expiresAt"`,[token,actor,target,kind,id,expected,desired]))[0];
  return {token,description,expiresAt:row.expiresAt};
}
// Caller must use one SQL transaction: row lock, state recheck, write, audit and consume are atomic.
export async function confirmAssistantAction(q:AssistantQuery,actor:string,admin:boolean,token:string){
  const preview=(await q(`SELECT *,expires_at>now() AS valid FROM app.assistant_action_previews WHERE id=$1 AND actor_id=$2 FOR UPDATE`,[token,actor]))[0];
  if(!preview)throw new AssistantError('Preview not found for this account.',404);
  if(preview.completed_at)return {ok:true,replayed:true,message:'This preview was already applied; no second change was made.'};
  if(!preview.valid)throw new AssistantError('This preview expired. Create a fresh preview.',409);
  scopedAssistantUser(actor,admin,preview.target_id);
  if(preview.kind==='notification_read'){
    const changed=await q(`UPDATE app.notifications SET read=true WHERE id=$1 AND user_id=$2 AND read=$3::boolean RETURNING id`,[preview.record_id,preview.target_id,preview.expected]);
    if(!changed.length)throw new AssistantError('The notification changed or was removed. Preview it again.',409);
  }else if(preview.kind==='support_status'){
    if(!admin)throw new AssistantError('Admin access is required.',403);
    const changed=await q(`UPDATE app.support_requests SET status=$1,updated_at=now(),resolved_at=CASE WHEN $1='resolved' THEN coalesce(resolved_at,now()) ELSE NULL END WHERE id=$2 AND status=$3 RETURNING id`,[preview.desired,preview.record_id,preview.expected]);
    if(!changed.length)throw new AssistantError('The ticket status changed. Preview it again.',409);
  }else throw new AssistantError('Unsupported action.');
  await q(`INSERT INTO app.audit_logs(user_id,action,meta) VALUES($1,'assistant.action',$2::jsonb)`,[actor,JSON.stringify({previewId:token,kind:preview.kind,recordId:preview.record_id,targetId:preview.target_id,from:preview.expected,to:preview.desired})]);
  await q('UPDATE app.assistant_action_previews SET completed_at=now() WHERE id=$1',[token]);
  return {ok:true,message:'Confirmed change saved.',replayed:false};
}
