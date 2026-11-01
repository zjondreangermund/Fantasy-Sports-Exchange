import type {Express} from 'express';
import {pool} from '../db.js';
import {AssistantError,safeUuid} from '../services/assistantPolicy.js';
import {ASSISTANT_SITE_TASK_SCHEMA,previewAssistantSiteTask,confirmAssistantSiteTask} from '../services/assistantSiteTasks.js';
import {dispatchAssistantSiteTask} from '../services/assistantSiteDispatcher.js';
import {securityOriginGuard,securityControlMiddleware} from '../services/securityControl.js';
import {strictReadOnlyGuard} from '../services/readOnlyGuard.js';
export function registerAssistantSiteTaskRoutes(app:Express,deps:{requireAuth:any;isAdminUser:(req:any)=>Promise<boolean>;sameOrigin:(req:any)=>boolean;withinLimit:(key:string,max:number)=>boolean}){
  let schema:Promise<any>|undefined;
  const ensure=()=>schema||=pool.query(ASSISTANT_SITE_TASK_SCHEMA).catch(error=>{schema=undefined;throw error;});
  const q=async(sql:string,params?:any[])=>(await pool.query(sql,params)).rows;
  app.get('/api/assistant/tasks/options',deps.requireAuth,async(req:any,res)=>{
    res.setHeader('Cache-Control','private, no-store');
    try{
      const actor=String(req.authUserId||'');if(!actor)throw new AssistantError('Sign in first.',401);
      if(!deps.withinLimit(`task-options:${actor}`,20))throw new AssistantError('Please wait before requesting more choices.',429);
      const [cards,competitions,entries]=await Promise.all([
        q(`SELECT pc.id,pc.rarity::text AS rarity,pc.for_sale AS "forSale",p.name,p.position::text AS position FROM app.player_cards pc JOIN app.players p ON p.id=pc.player_id WHERE pc.owner_id=$1 ORDER BY pc.id LIMIT 500`,[actor]),
        q(`SELECT c.id,c.name,c.game_week AS gameweek,c.entry_fee::float AS "entryFee" FROM app.competitions c WHERE c.status='open' AND (coalesce(c.visibility,'public')='public' OR c.created_by_user_id=$1 OR EXISTS(SELECT 1 FROM app.competition_entries e WHERE e.competition_id=c.id AND e.user_id=$1)) ORDER BY c.start_date DESC,c.id DESC LIMIT 100`,[actor]),
        q(`SELECT e.id,c.name,e.lineup_card_ids AS "cardIds",e.captain_id AS "captainId",c.game_week AS gameweek FROM app.competition_entries e JOIN app.competitions c ON c.id=e.competition_id WHERE e.user_id=$1 ORDER BY e.joined_at DESC LIMIT 100`,[actor]),
      ]);
      return res.json({cards,competitions,entries,note:'Choices belong to your signed-in account. Up to 500 cards and 100 tournaments/entries; opening a preview does not establish eligibility.'});
    }catch(error:any){return res.status(error instanceof AssistantError?error.status:503).json({message:error instanceof AssistantError?error.message:'Task choices are unavailable.'});}
  });
  for(const operation of ['preview','confirm'] as const){
    app.post(`/api/assistant/tasks/${operation}`,deps.requireAuth,async(req:any,res)=>{
      res.setHeader('Cache-Control','private, no-store');
      try{
        if(!deps.sameOrigin(req))throw new AssistantError('Invalid request origin.',403);
        const actor=String(req.authUserId||'');if(!actor)throw new AssistantError('Sign in first.',401);
        if(req.body?.userId&&req.body.userId!==actor)throw new AssistantError('Site tasks run only for your signed-in account.',403);
        if(!deps.withinLimit(`task:${actor}`,10))throw new AssistantError('Please wait before preparing another task.',429);
        const admin=await deps.isAdminUser(req);await ensure();
        if(operation==='preview')return res.json(await previewAssistantSiteTask(q,actor,admin,req.body?.draft));
        const token=String(req.body?.token||'');if(!safeUuid(token)||req.body?.confirmed!==true)throw new AssistantError('Review and explicitly confirm a valid preview.');
        req.assistantTaskToken=token;
        return res.json(await confirmAssistantSiteTask(q,actor,admin,token,plan=>dispatchAssistantSiteTask(app,req,plan,[securityOriginGuard,securityControlMiddleware,strictReadOnlyGuard])));
      }catch(error:any){
        if(error instanceof AssistantError)return res.status(error.status).json({message:error.message});
        console.error('Assistant site task failed',error);return res.status(503).json({message:'The outcome could not be confirmed. Check the relevant site page before trying again.'});
      }
    });
  }
}
