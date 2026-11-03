import {useEffect} from 'react';
import {useAuth} from '../hooks/use-auth';
// Semantic actions only: no typed text, form values, chat content or mouse paths.
export default function InteractionActivityTracker(){
  const {user}=useAuth();
  useEffect(()=>{
    if(!user?.id)return;
    let queue:Array<{kind:string;path:string;target:string}>=[];
    const flush=()=>{
      if(!queue.length)return;
      const events=queue.splice(0,20);
      let sessionId:string|null;try{sessionId=sessionStorage.getItem('arena_activity_session');}catch{return;}if(!sessionId)return;
      void fetch('/api/activity/events',{method:'POST',credentials:'include',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId,events})}).catch(()=>{});
    };
    let last='',lastAt=0;
    const add=(kind:string,target:string)=>{
      const path=window.location.pathname,key=kind+path+target,now=Date.now();
      if(key===last&&now-lastAt<500)return;last=key;lastAt=now;
      if(queue.length<20)queue.push({kind,path,target});
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
    const error=()=>add('error','App runtime error');
    const rejected=()=>add('error','Unhandled app operation');
    const hide=()=>{if(document.visibilityState==='hidden')flush();};
    document.addEventListener('click',click,true);window.addEventListener('error',error);window.addEventListener('unhandledrejection',rejected);document.addEventListener('visibilitychange',hide);
    const timer=window.setInterval(flush,5000);
    return ()=>{flush();clearInterval(timer);document.removeEventListener('click',click,true);window.removeEventListener('error',error);window.removeEventListener('unhandledrejection',rejected);document.removeEventListener('visibilitychange',hide);};
  },[user?.id]);
  return null;
}
