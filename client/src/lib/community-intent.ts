import {communityLinkIntent} from '../../../shared/community-mentions';
const key='fantasy_arena_pending_community_link_v1';
type Intent={messageId:number|null;notificationId:number|null};
export function rememberCommunityIntent(intent:Intent){try{sessionStorage.setItem(key,JSON.stringify({...intent,at:Date.now()}));}catch{}}
export function captureCommunityLink(){const intent=communityLinkIntent(window.location.href,window.location.origin);if(intent)rememberCommunityIntent(intent);return intent;}
export function takeCommunityIntent(){
  const direct=communityLinkIntent(window.location.href,window.location.origin);let saved:any;
  try{saved=JSON.parse(sessionStorage.getItem(key)||'null');sessionStorage.removeItem(key);}catch{}
  if(direct){const url=new URL(window.location.href);for(const name of ['community','communityMessage','notification'])url.searchParams.delete(name);history.replaceState(history.state,'',url.pathname+url.search+url.hash);return direct;}
  if(saved&&Number.isFinite(saved.at)&&Date.now()-saved.at<86400000&&saved.at<=Date.now())return {messageId:Number.isSafeInteger(saved.messageId)&&saved.messageId>0?saved.messageId:null,notificationId:Number.isSafeInteger(saved.notificationId)&&saved.notificationId>0?saved.notificationId:null};
  return null;
}
export function clearCommunityIntent(){try{sessionStorage.removeItem(key);}catch{}}
