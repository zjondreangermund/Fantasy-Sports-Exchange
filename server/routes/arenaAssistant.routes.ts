import {assistantAccess} from '../services/assistantAccess.js';
import {registerAssistantSiteTaskRoutes} from './assistantSiteTasks.routes.js';
import {ASSISTANT_ACTION_SCHEMA,previewAssistantAction,confirmAssistantAction} from '../services/assistantActions.js';
import {fplApi} from '../services/fplApi.js';
import {loadPremierAvailability} from './footballData.routes.js';
import type {Express} from 'express';
import {randomUUID} from 'node:crypto';
import {pool} from '../db.js';
import {createArenaAssistant} from '../services/arenaAssistant.js';
import {AssistantError,safeActivityPath,safeUuid} from '../services/assistantPolicy.js';
import {ensurePageActivitySchema} from '../services/pageActivitySchema.js';
export {ensurePageActivitySchema} from '../services/pageActivitySchema.js';
import {cleanActivityText} from '../services/activityPolicy.js';
const buckets=new Map<string,{count:number;until:number}>();
function withinLimit(key:string,max:number){const now=Date.now(),bucket=buckets.get(key);if(!bucket||bucket.until<=now){buckets.set(key,{count:1,until:now+60000});return true;}return ++bucket.count<=max;}
function sameOrigin(req:any){
  const origin=String(req.headers?.origin||'');if(!origin)return true;
  const allowed=new Set([`${req.protocol}://${req.get('host')}`,'capacitor://localhost','http://localhost','https://localhost',...(process.env.CORS_ORIGINS||'').split(',').map(s=>s.trim())]);
  for(const raw of [process.env.APP_URL,process.env.PUBLIC_URL]){try{if(raw)allowed.add(new URL(raw).origin);}catch{}}
  return allowed.has(origin);
}
export function registerArenaAssistantRoutes(app:Express,deps:{requireAuth:any;isAdminUser:(req:any)=>Promise<boolean>}){
  registerAssistantSiteTaskRoutes(app,{...deps,sameOrigin,withinLimit});
  const answer=createArenaAssistant(async(query,params)=>(await pool.query(query,params)).rows,{fixtures:()=>fplApi.fixturesLive(),availability:loadPremierAvailability});
  const purge=async()=>{await ensurePageActivitySchema();await pool.query("DELETE FROM app.page_activity WHERE created_at < now()-interval '90 days'");
    if((await pool.query("SELECT to_regclass('app.assistant_action_previews') AS present")).rows[0]?.present)await pool.query("DELETE FROM app.assistant_action_previews WHERE expires_at<now()-interval '1 day'");};
  void purge().catch(error=>console.warn('Page activity setup failed',error));
  const retention=setInterval(()=>{void purge().catch(error=>console.warn('Page activity cleanup failed',error));},3600000);retention.unref();
  const cleanBuckets=setInterval(()=>{for(const [key,bucket] of buckets)if(bucket.until<Date.now())buckets.delete(key);},60000);cleanBuckets.unref();
  app.post('/api/activity/page',async(req:any,res)=>{
    res.setHeader('Cache-Control','no-store');
    try{
      if(!sameOrigin(req))return res.status(403).json({message:'Invalid request origin.'});
      // Ignore clearly automated browser-agent traffic. Human attribution
      // remains an estimate: scripts can imitate browsers, and old records
      // cannot be retroactively proven human.
      const agent=String(req.headers['user-agent']||'').toLowerCase();
      if(/(?:googlebot|bingbot|duckduckbot|crawler|spider|headless|lighthouse|curl\/|wget\/|python-requests|uptimerobot|facebookexternalhit|previewbot)/i.test(agent)){
        return res.status(202).json({ok:true,ignored:'automated-agent'});
      }
      if(!withinLimit(`page:${req.ip}`,90))return res.status(429).json({message:'Activity event limit reached.'});
      const path=safeActivityPath(req.body?.path),sessionId=String(req.body?.sessionId||'');
      if(!path||!safeUuid(sessionId))return res.status(400).json({message:'Invalid route or session.'});
      let visitorId=String(req.cookies?.arena_visitor||'');
      if(!safeUuid(visitorId)){visitorId=randomUUID();res.cookie('arena_visitor',visitorId,{httpOnly:true,sameSite:'lax',secure:req.secure||process.env.NODE_ENV==='production',maxAge:90*86400000});}
      const userId=String(req.user?.claims?.sub||req.user?.id||'')||null;
      await ensurePageActivitySchema();
      const event=req.body?.event==='heartbeat'?'heartbeat':'page_view';
      // PAGE_VIEW_REMOUNT_DEDUP_V1: a SPA remount/reload within 15s isn't
      // another page visit. Preserve a login transition (anonymous -> user)
      // as a separate authenticated page observation when it occurs.
      await pool.query(`INSERT INTO app.page_activity(visitor_id,session_id,user_id,path,event)
        SELECT $1::uuid,$2::uuid,$3::varchar,$4::text,$5::text
        WHERE $5::text <> 'page_view' OR NOT EXISTS(
          SELECT 1 FROM app.page_activity
          WHERE visitor_id=$1::uuid AND session_id=$2::uuid
            AND user_id IS NOT DISTINCT FROM $3::varchar
            AND path=$4::text AND event='page_view'
            AND created_at>now()-interval '15 seconds'
        )`,[visitorId,sessionId,userId,path,event]);
      return res.status(202).json({ok:true});
    }catch(error){console.warn('Page activity event failed',error);return res.status(503).json({message:'Activity tracking is unavailable.'});}
  });
  app.post('/api/activity/events',deps.requireAuth,async(req:any,res)=>{
    res.setHeader('Cache-Control','private, no-store');
    try {
      if(!sameOrigin(req))return res.status(403).json({message:'Invalid request origin.'});
      const actor=String(req.authUserId||req.user?.claims?.sub||req.user?.id||'');
      if(!actor)return res.status(401).json({message:'Sign in required.'});
      if(!withinLimit(`interaction:${actor}`,30))return res.status(429).json({message:'Activity event limit reached.'});
      const sessionId=String(req.body?.sessionId||'');
      if(!safeUuid(sessionId)||!Array.isArray(req.body?.events)||req.body.events.length>20)return res.status(400).json({message:'Invalid activity batch.'});
      const events=req.body.events.map((event:any)=>({kind:event.kind,path:safeActivityPath(event.path),target:cleanActivityText(event.target,80)}));
      if(events.some((e:any)=>!e.path||!['interaction','error'].includes(e.kind)))return res.status(400).json({message:'Invalid activity event.'});
      if(events.length)await pool.query(`INSERT INTO app.audit_logs(user_id,action,meta)
        SELECT $1,'client.'||kind,jsonb_build_object('path',path,'target',target,'sessionId',$2::text,'reportedBy','browser')
        FROM jsonb_to_recordset($3::jsonb) AS e(kind text,path text,target text)`,[actor,sessionId,JSON.stringify(events)]);
      return res.status(202).json({ok:true});
    }catch{return res.status(503).json({message:'Activity tracking is unavailable.'});}
  });
  app.get('/api/assistant/access',deps.requireAuth,async(req:any,res)=>{
    res.setHeader('Cache-Control','private, no-store');
    try{return res.json({userId:String(req.authUserId||''),isAdmin:await deps.isAdminUser(req)});}catch{return res.status(503).json({message:'Support access could not be verified.'});}
  });
  let actionSchema:Promise<any>|undefined;
  const prepareActions=()=>actionSchema||=(pool.query(ASSISTANT_ACTION_SCHEMA).catch(error=>{actionSchema=undefined;throw error;}));
  for(const operation of ['preview','confirm'] as const){
    app.post([`/api/assistant/actions/${operation}`,`/api/assistant/:audience/actions/${operation}`],deps.requireAuth,async(req:any,res)=>{
      res.setHeader('Cache-Control','private, no-store');
      let client:any;
      try{
        if(!sameOrigin(req))return res.status(403).json({message:'Invalid request origin.'});
        const actor=String(req.authUserId||'');
        if(!withinLimit(`action:${actor}`,12))return res.status(429).json({message:'Please wait before trying another action.'});
        const {admin,audience}=assistantAccess(req.params?.audience,await deps.isAdminUser(req));
        await prepareActions();
        if(operation==='preview')return res.json(await previewAssistantAction(async(sql,params)=>(await pool.query(sql,params)).rows,actor,admin,req.body||{},audience));
        const token=String(req.body?.token||'');
        if(!safeUuid(token)||req.body?.confirmed!==true)throw new AssistantError('Confirm a valid preview before applying it.');
        client=await pool.connect();await client.query('BEGIN');
        const result=await confirmAssistantAction(async(sql,params)=>(await client.query(sql,params)).rows,actor,admin,token,audience);
        await client.query('COMMIT');return res.json(result);
      }catch(error:any){
        if(client)await client.query('ROLLBACK');
        if(error instanceof AssistantError)return res.status(error.status).json({message:error.message});
        console.error('Assistant action failed',error);return res.status(503).json({message:'Could not complete the action. Check its current status before retrying.'});
      }finally{client?.release();}
    });
  }
  app.post(['/api/assistant/ask','/api/assistant/:audience/ask'],deps.requireAuth,async(req:any,res)=>{
    res.setHeader('Cache-Control','private, no-store');
    try{
      if(!sameOrigin(req))return res.status(403).json({message:'Invalid request origin.'});
      const actorId=String(req.authUserId||'');
      if(!withinLimit(`ask:${actorId}`,20))return res.status(429).json({message:'Please wait a moment before asking again.'});
      const {admin,audience}=assistantAccess(req.params?.audience,await deps.isAdminUser(req));
      await ensurePageActivitySchema();
      return res.json({...await answer({actorId,admin,question:req.body?.question,userId:req.body?.userId,userSearch:req.body?.userSearch,previousTopics:req.body?.previousTopics,period:req.body?.period,offset:req.body?.offset,context:req.body?.context}),audience});
    }catch(error:any){
      if(error instanceof AssistantError)return res.status(error.status).json({message:error.message});
      console.error('Assistant lookup failed',error);
      return res.status(503).json({message:'I could not verify the requested records. Please try again. No account changes were made.'});
    }
  });
}
