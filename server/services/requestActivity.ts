import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { db } from '../db.js';
import { safeUuid } from './assistantPolicy.js';
import { cleanActivityText } from './activityPolicy.js';
// Observe outcomes, never request bodies, query strings, cookies or credentials.
export function createRequestActivity(executor:any=db) {
  return (req:any,res:any,next:any)=>{
    if(!req.path.startsWith('/api/') || /^\/api\/(activity|audit\/client-event|marketing)\b/.test(req.path))return next();
    const requestId=randomUUID(),start=Date.now();let message='';
    res.setHeader('X-Arena-Request-Id',requestId);
    const json=res.json;
    res.json=function(body:any){if(res.statusCode>=400 && res.statusCode<500 && typeof body?.message==='string')message=cleanActivityText(body.message);return json.call(this,body);};
    res.once('finish',()=>{
      const userId=String(req.authUserId||req.user?.claims?.sub||req.user?.id||'')||null;
      if(!userId && res.statusCode<500)return;
      if(['GET','HEAD','OPTIONS'].includes(req.method) && res.statusCode<400)return;
      const path=String(req.path).replace(/\/(auth|native-auth|reset-password|verify-email)\/.*$/,'/$1').slice(0,180);
      const action=res.statusCode>=500?'request.error':res.statusCode>=400?'request.rejected':'request.completed';
      if(res.statusCode>=500)console.warn('[request.error]',requestId,req.method,path,res.statusCode);
      const sessionId=safeUuid(req.headers?.['x-arena-session'])?String(req.headers['x-arena-session']):undefined;
      const meta={requestId,sessionId,method:req.method,path,status:res.statusCode,durationMs:Date.now()-start,message:message||(res.statusCode>=500?'Server request failed. Quote the request reference when investigating.':undefined)};
      void executor.execute(sql`insert into app.audit_logs(user_id,action,meta) values(${userId},${action},${JSON.stringify(meta)}::jsonb)`).catch(()=>console.warn('[activity] Request outcome could not be saved'));
    });
    next();
  };
}
