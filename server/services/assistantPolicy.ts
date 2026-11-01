export const ASSISTANT_TOPICS=['visitors','overview','wallet','activity','entries','cards','loans','notifications','support','football','settlement','gameweek','help'] as const;
export type AssistantTopic=typeof ASSISTANT_TOPICS[number];
export class AssistantError extends Error { constructor(message:string,public status=400){super(message);} }
export function scopedAssistantUser(actor:string,admin:boolean,target?:string) {
  if(!actor)throw new AssistantError('Sign in to use account support.',401);
  if(target&&!admin&&target!==actor)throw new AssistantError('Only administrators can inspect another account.',403);
  return admin&&target?target:actor;
}
export function assistantTopics(question:string,previous:unknown=[]):AssistantTopic[] {
  const q=question.toLowerCase();
  if(/game\s*week|\bgw\s*\d+\b|sync (?:log|history|status)|scoring log/.test(q)&&/log|latest|current|check|status|history|sync|report/.test(q))return ['gameweek'];
  if(/^(how (do i|to)|where (can|do)|what (is|are) the|explain).*?(captain|rarity|rule|score|scoring|fee|join|install|funding)/.test(q))return ['help'];
  const topics:AssistantTopic[]=[];
  if(/conversion|funnel|drop.off|abandon/.test(q))topics.push('visitors');
  if(/settlement|settle|missing scores|provisional scores/.test(q))topics.push('settlement');
  if(/injur|availability|starting|starter|line.?up|suspend|football|isak|izak|on the bench|will .{1,60} play|playing/.test(q))topics.push('football');
  if(/homepage|home page|visitor|traffic|signup|sign.up|new users|registered|who.*online|how many.*online/.test(q))topics.push('visitors');
  if(/platform overview|site overview|all users|total users|platform revenue|site revenue|total revenue/.test(q))topics.push('overview');
  if(/wallet|balance|deposit|withdraw|payment|transaction|refund|money|funds/.test(q))topics.push('wallet');
  if(/visited|activity|pages|did on|doing on|last seen|what did|online/.test(q)&&!topics.includes('visitors'))topics.push('activity');
  if(/entr(?:y|ies)|entered|tournament|competition|team|prize|settle/.test(q))topics.push('entries');
  if(/cards?|collection|player|marketplace|listed/.test(q))topics.push('cards');
  if(/loans?|borrow/.test(q))topics.push('loans');
  if(/notification|inbox|alerts?/.test(q))topics.push('notifications');
  if(/support ticket|support request|ticket #/.test(q))topics.push('support');
  if(/(?:cannot|can't|cant|unable|failed|trouble|why).*(?:enter|submit|join)/.test(q))topics.push('wallet','entries','cards');
  if(/account overview|everything about.*account|account summary/.test(q))topics.push('wallet','activity','entries','cards','loans','notifications');
  if(!topics.length&&/^(and\b|what about\b|how about\b|yesterday\b|today\b|last \d|why\b|show more\b)/i.test(question)&&Array.isArray(previous))return [...new Set(previous.filter((t:any)=>ASSISTANT_TOPICS.includes(t)&&t!=='help'))].slice(0,10) as AssistantTopic[];
  return topics.length?[...new Set(topics)].slice(0,10):['help'];
}
export function assistantWindow(question:string,context?:any,now=new Date()) {
  const instant=now.getTime(),day=86400000,offset=7200000,local=new Date(instant+offset);
  const midnight=Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),local.getUTCDate())-offset;
  let from=instant-7*day,to=instant,explicit=false;
  if(/\btoday\b/i.test(question)){from=midnight;explicit=true;}
  else if(/\byesterday\b/i.test(question)){from=midnight-day;to=midnight;explicit=true;}
  else if(/this month/i.test(question)){from=Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),1)-offset;explicit=true;}
  else if(/last month/i.test(question)){from=Date.UTC(local.getUTCFullYear(),local.getUTCMonth()-1,1)-offset;to=Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),1)-offset;explicit=true;}
  else if(/this week|last week/i.test(question)){from=midnight-((local.getUTCDay()+6)%7)*day;if(/last week/i.test(question)){to=from;from-=7*day;}explicit=true;}
  const days=question.match(/(?:last|past)\s+(\d+)\s+days?/i);
  if(days){from=instant-Math.max(1,Math.min(90,Number(days[1])))*day;to=instant;explicit=true;}
  if(/last 24 hours/i.test(question)){from=instant-day;to=instant;explicit=true;}
  const dates=[...question.matchAll(/\b(\d{4}-\d{2}-\d{2})\b/g)].map(m=>m[1]);
  if(dates.length){
    if(dates.some(date=>{const t=Date.parse(date+'T00:00:00Z');return !Number.isFinite(t)||new Date(t).toISOString().slice(0,10)!==date;}))throw new AssistantError('Use valid calendar dates in YYYY-MM-DD format.');
    from=Date.parse(dates[0]+'T00:00:00Z')-offset;to=Math.min(instant,Date.parse((dates[1]||dates[0])+'T00:00:00Z')-offset+day);explicit=true;
  }
  if(!explicit&&context){from=Date.parse(context.from);to=Math.min(instant,Date.parse(context.to));}
  if(!Number.isFinite(from)||!Number.isFinite(to)||from>=to||to-from>90*day)throw new AssistantError('Choose a date range of up to 90 days that has already begun.');
  return {from:new Date(from).toISOString(),to:new Date(to).toISOString()};
}
export function safeActivityPath(value:unknown){const p=String(value||'').split(/[?#]/)[0];if(!/^\/[a-zA-Z0-9/_-]{0,159}$/.test(p))return null;return p.replace(/^\/(join|auth|native-auth|reset-password|verify-email)\/.*$/,'/$1');}
export const safeUuid=(v:unknown)=>/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(String(v||''));

export function assistantUserSearch(question:string,explicit?:string){
  if(explicit)return String(explicit).trim().slice(0,120);
  const email=question.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  const quoted=question.match(/(?:user|manager|customer)\s+["“]([^"”]+)["”]/i)?.[1];
  const named=question.match(/(?:user|manager|customer)\s+([a-z0-9_.-]+)(?=\s+(?:did|has|was|is|wallet|account|activity|visited|online|balance)|[?!.,]|$)/i)?.[1]
    || question.match(/(?:what did|what has|show me what)\s+([a-z0-9_.-]+)\s+(?:do|visit|done|doing)/i)?.[1]
    || question.match(/\b([a-z0-9_.-]+)['’]s\s+(?:wallet|account|entries|activity|balance)/i)?.[1];
  return String(email||quoted||(named&&!['i','me','my','this','that','the','a','an','user','manager','their','his','her'].includes(named.toLowerCase())?named:'')).slice(0,120);
}
