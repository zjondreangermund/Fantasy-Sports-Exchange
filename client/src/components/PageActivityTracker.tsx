import {useEffect} from 'react';
import {useLocation} from 'wouter';
import {useAuth} from '../hooks/use-auth';
export default function PageActivityTracker(){
  const [location]=useLocation();const {user,isLoading}=useAuth();
  useEffect(()=>{
    if(isLoading)return;
    let sessionId:string;
    try{sessionId=sessionStorage.getItem('arena_activity_session')||crypto.randomUUID();sessionStorage.setItem('arena_activity_session',sessionId);}catch{return;}
    const send=(event:'page_view'|'heartbeat')=>{
      if(document.visibilityState==='hidden')return;
      void fetch('/api/activity/page',{method:'POST',credentials:'include',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({path:location.split(/[?#]/)[0],sessionId,event})}).catch(()=>{});
    };
    send('page_view');const timer=window.setInterval(()=>send('heartbeat'),60000);
    return ()=>window.clearInterval(timer);
  },[location,user?.id,isLoading]);
  return null;
}
