export const assistantTaskDefinitions={
  team_submit:{label:'Submit a tournament team',fields:['competitionId','cardIds','captainId'],admin:false},
  team_edit:{label:'Edit a submitted team',fields:['entryId','cardIds','captainId'],admin:false},
  prize_claim:{label:'Claim a tournament prize',fields:['entryId'],admin:false},
  weekly_claim:{label:'Claim the weekly Common card',fields:[],admin:false},
  listing_create:{label:'List a card for sale',fields:['cardId','price'],admin:false},
  listing_cancel:{label:'Cancel a card listing',fields:['cardId'],admin:false},
  price_watch:{label:'Watch a card price',fields:['cardId'],admin:false},
  price_unwatch:{label:'Stop watching a card price',fields:['cardId'],admin:false},
  inbox_read_all:{label:'Mark all inbox notifications read',fields:[],admin:false},
  alert_preference:{label:'Change an alert preference',fields:['category','enabled'],admin:false},
  team_rename:{label:'Rename my manager team',fields:['teamName'],admin:false},
  admin_sync:{label:'Run an API-Football synchronization',fields:['jobType'],admin:true},
  admin_settle:{label:'Settle a tournament',fields:['competitionId'],admin:true},
} as const;
export type AssistantTaskKind=keyof typeof assistantTaskDefinitions;
export type AssistantTaskDraft={kind:AssistantTaskKind;fields:Record<string,any>};
export const assistantTaskKind=(v:unknown):v is AssistantTaskKind=>typeof v==='string'&&Object.hasOwn(assistantTaskDefinitions,v);
export function parseAssistantTask(text:string,previous?:unknown):AssistantTaskDraft|null {
  const q=text.toLowerCase().replace(/[’‘]/g,"'").trim();
  // Questions about rules, past failures or current records must remain read-only.
  if(/^(?:why|how|where|when|what|which|is|are|did|has|have)\b/.test(q))return null;
  if(/^(?:show|find|search|look up|check|tell)\b/.test(q))return null;
  let kind:AssistantTaskKind|undefined;
  if(/(?:rename|change|update|set).*(?:team name|manager name)|rename my team/.test(q))kind='team_rename';
  else if(/(?:submit|enter|join|register|put in).*(?:team|lineup|tournament|competition)|(?:pick|choose|build|make).*(?:team|lineup).*for me/.test(q))kind='team_submit';
  else if(/(?:edit|change|update|replace|save).*(?:team|lineup|captain|entry)/.test(q))kind='team_edit';
  else if(/claim|collect|mint/.test(q)&&/weekly|free common|login card/.test(q))kind='weekly_claim';
  else if(/claim|collect|mint/.test(q)&&/prize|reward.*entry/.test(q))kind='prize_claim';
  else if(/(?:unlist|cancel|remove).*(?:listing|sale)|unlist.*card/.test(q))kind='listing_cancel';
  else if(!/^(?:list|show|find) (?:all |the |available )?(?:cards|players|listings)\b/.test(q)&&/sell.*card|(?:list|put).*card.*(?:for|at|price|sale)/.test(q))kind='listing_create';
  else if(/(?:unwatch|stop watching|remove.*watch)/.test(q))kind='price_unwatch';
  else if(/watch.*(?:card|price)|alert.*price/.test(q))kind='price_watch';
  else if(/mark.*all.*(?:notifications?|inbox|messages?).*read/.test(q))kind='inbox_read_all';
  else if(/(?:enable|disable|turn on|turn off|switch on|switch off).*(?:alerts?|notifications?)/.test(q))kind='alert_preference';
  else if(/(?:run|start|refresh|sync).*(?:sync|api|fixtures|statistics|standings|players|teams)|^(?:sync|synchronise|synchronize)\b/.test(q))kind='admin_sync';
  else if(/(?:settle|finalize|finalise).*(?:tournament|competition)/.test(q))kind='admin_settle';
  const prior=previous as AssistantTaskDraft|undefined;
  const continuing=!kind&&assistantTaskKind(prior?.kind)&&/^(?:\d|tournament|competition|entry|cards?|captain|use |name |job |category |price )/i.test(text.trim());
  if(!kind&&!continuing)return null;
  const same=continuing||kind===prior?.kind;
  const fields:Record<string,any>=same?{...prior?.fields}:{};
  kind=kind||prior!.kind;
  for(const [key,pattern] of Object.entries({competitionId:/(?:tournament|competition)\s*#?\s*(\d+)/i,entryId:/entry\s*#?\s*(\d+)/i,cardId:/(?:card)\s*#?\s*(\d+)/i,captainId:/captain(?:\s+card)?\s*#?\s*(\d+)/i})){
    const match=text.match(pattern);if(match)fields[key]=Number(match[1]);
  }
  const cards=text.match(/(?:cards?|use)\s*[:#]?\s*((?:\d+\s*[,\s]\s*)+\d+)/i);if(cards)fields.cardIds=cards[1].split(/[,\s]+/).filter(Boolean).map(Number);
  const price=text.match(/(?:price|for|at)\s*N?\$?\s*(\d+(?:\.\d{1,2})?)/i);if(price)fields.price=Number(price[1]);
  const name=text.match(/(?:team name|rename my team|name)\s*(?:to|is|:)\s*["“]?([^"”]{2,50})/i);if(name)fields.teamName=name[1].trim();
  const job=q.match(/\b(fixtures|live|completed_stats|standings|teams|players)\b/);if(job)fields.jobType=job[1];
  if(/completed (?:stats|statistics)/.test(q))fields.jobType='completed_stats';
  const category=q.match(/\b(tournament|players|prizes|marketplace|community|mint|marketing)\b/);if(kind==='alert_preference'&&category)fields.category=category[1];
  if(kind==='alert_preference'){if(/disable|turn off|switch off/.test(q))fields.enabled=false;else if(/enable|turn on|switch on/.test(q))fields.enabled=true;}
  if(/^\d+$/.test(q)){
    const missing=assistantTaskDefinitions[kind].fields.filter(f=>fields[f]==null||fields[f]==='');if(missing.length===1&&/Id$/.test(missing[0]))fields[missing[0]]=Number(q);
  }
  return {kind,fields};
}
