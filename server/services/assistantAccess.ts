import {AssistantError} from './assistantPolicy.js';
export type AssistantAudience='member'|'admin';
/** Legacy endpoints default to member scope. No body field can grant privileges. */
export function assistantAccess(requested:unknown,verifiedAdmin:boolean){
  const audience=requested==null?'member':String(requested);
  if(audience!=='member'&&audience!=='admin')throw new AssistantError('Unknown support channel.',404);
  if(audience==='admin'&&!verifiedAdmin)throw new AssistantError('Administrator support requires administrator access.',403);
  return {audience:audience as AssistantAudience,admin:audience==='admin'&&verifiedAdmin};
}
