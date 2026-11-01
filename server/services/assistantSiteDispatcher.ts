import {EventEmitter} from 'node:events';
import type {Express,RequestHandler} from 'express';
export type SiteTaskPlan={method:'post'|'patch'|'put'|'delete';route:string;path:string;params:Record<string,string>;body:Record<string,any>};
/** Only server-built plans are accepted. Reuse the site's registered middleware and handler. */
export async function dispatchAssistantSiteTask(app:Express,original:any,plan:SiteTaskPlan,guards:RequestHandler[]){
  const route=((app as any).router||(app as any)._router)?.stack?.find((layer:any)=>layer.route?.path===plan.route&&layer.route.methods?.[plan.method])?.route;
  if(!route)throw new Error('The site action is not registered.');
  const req=Object.create(original);
  Object.assign(req,{method:plan.method.toUpperCase(),url:plan.path,originalUrl:plan.path,baseUrl:'',params:{...plan.params},body:{...plan.body},headers:{...original.headers,'x-idempotency-key':original.assistantTaskToken},route});
  return await new Promise<{status:number;message:string;entryId?:number}>(resolve=>{
    const res:any=new EventEmitter();res.statusCode=200;res.locals={};res.headersSent=false;
    const timer=setTimeout(()=>finish({status:504,message:'The action outcome is not confirmed. Check the relevant site page before trying a new action.'}),45000);
    const finish=(result:any)=>{if(res.headersSent)return;res.headersSent=true;clearTimeout(timer);res.emit('finish');resolve(result);};
    res.status=(code:number)=>{res.statusCode=code;return res;};
    res.setHeader=res.set=res.header=()=>res;res.getHeader=()=>undefined;
    res.json=(data:any)=>{if(res.statusCode<400&&(data?.success===false||data?.status==='failed'))res.statusCode=409;const outcomeMessage=data?.alreadyClaimed?'This reward was already claimed. No new card was minted.':data?.claimed===false?(data?.capReached?'The Common card cap was reached. No card was minted.':'You are not eligible for a new weekly card yet. No card was minted.'):data?.claimed===true?'The site confirmed the weekly card claim.':data?.pendingChoice?'The request needs a collection choice. Open your collection to complete it.':undefined;finish({status:res.statusCode,message:res.statusCode>=500?'The site could not confirm completion. Check the relevant page before retrying.':String(data?.message||outcomeMessage|| (res.statusCode<400?'The site confirmed the action.':'The site rejected this action.')).slice(0,700),...(Number(data?.entry?.id||data?.entryId)>0?{entryId:Number(data.entry?.id||data.entryId)}:{})});return res;};
    res.send=(data:any)=>res.json(typeof data==='object'?data:{message:'The site returned an unexpected response.'});
    res.end=()=>res.json({});res.redirect=()=>res.status(401).json({message:'Please sign in again.'});
    const stack=[...guards,(rq:any,rs:any,next:any)=>route.dispatch(rq,rs,next)];
    let index=0;
    const next=(error?:any)=>{if(res.headersSent)return;if(error)return res.status(500).json({});const handler=stack[index++];if(!handler)return res.status(503).json({});try{Promise.resolve(handler(req,res,next)).catch(next);}catch(e){next(e);}};
    next();
  });
}
