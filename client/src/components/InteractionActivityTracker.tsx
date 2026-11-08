import {describeClientError, type ClientErrorDetails} from '../../../shared/client-error';
import {useEffect} from 'react';
import {useAuth} from '../hooks/use-auth';
// Semantic actions only: no typed text, form values, chat content or mouse paths.
export default function InteractionActivityTracker(){
  const {user}=useAuth();
  useEffect(()=>{
    if(!user?.id)return;
    let queue:Array<{kind:string;path:string;target:string;error?:ClientErrorDetails}>=[];
    const flush=()=>{
      if(!queue.length)return;
      const events=queue.splice(0,20);
      let sessionId:string|null;try{sessionId=sessionStorage.getItem('arena_activity_session');}catch{return;}if(!sessionId)return;
      void fetch('/api/activity/events',{method:'POST',credentials:'include',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId,events})}).catch(()=>{});
    };
    let last='',lastAt=0;
    const add=(kind:string,target:string,error?:ClientErrorDetails)=>{
      const path=window.location.pathname,key=kind+path+target+(error?.message||'')+(error?.file||''),now=Date.now();
      if(key===last&&now-lastAt<500)return;last=key;lastAt=now;
      if(queue.length<20)queue.push({kind,path,target,...(error?{error}:{})});
    };
    const click=(event:MouseEvent)=>{
      if(!(event.target instanceof Element))return;
      const el=event.target.closest('button,a,[role="tab"],[role="menuitem"],summary');if(!el)return;
      if(el.closest('[data-activity-private]'))return;
      const role=el.getAttribute('role');
      const safeLabel=el.getAttribute('data-activity-label') || (role==='tab'?el.textContent?.trim():'');
      const href=el.tagName==='A'?el.getAttribute('href')?.split(/[?#]/)[0]:'';
      add('interaction',(safeLabel|| (href?.startsWith('/')?`Open ${href}`:el.tagName==='SUMMARY'?'Expand details':'Button pressed')).slice(0,80));
    };
    const error=(event:Event)=>{
      if(event instanceof ErrorEvent){
        add('error','App runtime error',describeClientError('runtime',event.error || event.message,{file:event.filename,line:event.lineno,column:event.colno}));
      } else {
        const target=event.target;
        if(!(target instanceof HTMLScriptElement || target instanceof HTMLLinkElement))return;
        add('error','App resource failed',describeClientError('resource','Script or stylesheet failed to load',{file:target instanceof HTMLScriptElement?target.src:target.href}));
      }
      flush();
    };
    const rejected=(event:PromiseRejectionEvent)=>{
      add('error','Unhandled app operation',describeClientError('unhandledrejection',event.reason));
      flush();
    };
    const hide=()=>{if(document.visibilityState==='hidden')flush();};
    document.addEventListener('click',click,true);window.addEventListener('error',error,true);window.addEventListener('unhandledrejection',rejected);document.addEventListener('visibilitychange',hide);
    const timer=window.setInterval(flush,5000);
    return ()=>{flush();clearInterval(timer);document.removeEventListener('click',click,true);window.removeEventListener('error',error,true);window.removeEventListener('unhandledrejection',rejected);document.removeEventListener('visibilitychange',hide);};
  },[user?.id]);
  return null;
}

