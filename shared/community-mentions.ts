export function communityMentionHandle(name:string){return name.trim().replace(/\s+/g,'_').replace(/[^a-zA-Z0-9_]/g,'').slice(0,30)||'ArenaManager';}
export function extractCommunityMentions(text:string){const tags=new Map<string,string>();for(const match of text.matchAll(/(?:^|\s)@([a-z0-9_]{2,30})(?![a-z0-9_])/gi))tags.set(match[1].toLowerCase(),match[1]);return [...tags.values()].slice(0,12);}
export type MentionToken={start:number;end:number;query:string;explicit:boolean};
export function activeMentionToken(text:string,caret=text.length):MentionToken|null{
  const before=text.slice(0,Math.max(0,caret)),match=/(^|\s)(@?)([\p{L}\p{N}_'-]*)$/u.exec(before);
  if(!match||(!match[2]&&match[3].length<2))return null;
  const query=match[3];if(query.length>40)return null;
  const suffix=/^[\p{L}\p{N}_'-]*/u.exec(text.slice(caret))?.[0]||'';
  return {start:before.length-match[2].length-query.length,end:caret+suffix.length,query,explicit:match[2]==='@'};
}
export function insertCommunityMention(text:string,token:MentionToken,handle:string){
  if(!/^[a-zA-Z0-9_]{2,30}$/.test(handle))return null;
  const tag='@'+handle,tail=text.slice(token.end),space=/^\s/.test(tail)?'':' ';
  const value=text.slice(0,token.start)+tag+space+tail;
  return value.length>280?null:{value,caret:token.start+tag.length+1};
}
const positive=(v:unknown)=>Number.isSafeInteger(Number(v))&&Number(v)>0?Number(v):null;
export function communityMentionDestination(key:unknown,notificationId?:unknown,explicitMessageId?:unknown){
  const messageId=positive(explicitMessageId)||positive(String(key||'').match(/^community-mention:(\d+):/)?.[1]);
  const params=new URLSearchParams({community:'1'});if(messageId)params.set('communityMessage',String(messageId));
  const notification=positive(notificationId);if(notification)params.set('notification',String(notification));
  return '/dashboard?'+params.toString();
}
export function communityLinkIntent(value:string,origin='https://playfantasyarena.com'){
  try{const url=new URL(value,origin);if(url.origin!==new URL(origin).origin&&!['https://playfantasyarena.com','https://www.playfantasyarena.com'].includes(url.origin))return null;
    if(url.pathname!=='/community'&&url.searchParams.get('community')!=='1'&&!url.searchParams.has('communityMessage'))return null;
    return {messageId:positive(url.searchParams.get('communityMessage')),notificationId:positive(url.searchParams.get('notification'))};
  }catch{return null;}
}
