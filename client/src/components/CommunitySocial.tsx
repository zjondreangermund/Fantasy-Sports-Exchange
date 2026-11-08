import {useState} from 'react';
import {COMMUNITY_EMOJIS, COMMUNITY_REACTIONS, type CommunityReactionCount} from '../../../shared/community-social';

export function CommunityReactions({reactions=[],disabled,onChange}: {reactions?:CommunityReactionCount[];disabled:boolean;onChange:(emoji:string,active:boolean)=>void}) {
  const [open,setOpen]=useState(false);
  const [more,setMore]=useState(false);
  return <div className="mt-2 flex flex-wrap items-center gap-1.5">
    {reactions.filter(reaction=>reaction.count>0).map(reaction=><button key={reaction.emoji} type="button" disabled={disabled} aria-pressed={reaction.mine} aria-label={`${reaction.emoji}: ${reaction.count} reactions${reaction.mine?', including you':''}`} onClick={()=>onChange(reaction.emoji,!reaction.mine)} className={`min-h-9 rounded-full border px-2.5 text-xs ${reaction.mine?'border-cyan-300/50 bg-cyan-300/15':'border-white/10 bg-white/5'} disabled:opacity-50`}>{reaction.emoji} {reaction.count}</button>)}
    <button type="button" aria-expanded={open} aria-label="React to message" onClick={()=>{setOpen(!open);setMore(false);}} className="min-h-9 rounded-full bg-white/5 px-2.5 text-xs text-white/70">☺ React</button>
    {open?<div className="flex flex-wrap gap-1 rounded-xl border border-white/10 bg-slate-950 p-1" aria-label="Choose a reaction">{(more?COMMUNITY_EMOJIS:COMMUNITY_REACTIONS).map(emoji=><button key={emoji} type="button" disabled={disabled} aria-label={`React ${emoji}`} onClick={()=>{onChange(emoji,!reactions.find(item=>item.emoji===emoji)?.mine);setOpen(false);setMore(false);}} className="min-h-10 min-w-10 rounded-lg text-xl hover:bg-white/10">{emoji}</button>)}<button type="button" onClick={()=>setMore(!more)} aria-expanded={more} className="min-h-10 rounded-lg px-3 text-xs text-cyan-200">{more?"Quick reactions":"＋ More emojis"}</button></div>:null}
  </div>;
}

export function CommunitySocialComposer({onEmoji}: {onEmoji:(emoji:string)=>void}) {
  const [open,setOpen]=useState(false);
  return <div className="mb-2 space-y-2">
    <button type="button" aria-expanded={open} onClick={()=>setOpen(!open)} className="min-h-9 rounded-lg bg-white/5 px-3 text-xs">😀 Emojis</button>
    {open?<div className="flex max-h-32 flex-wrap gap-1 overflow-y-auto rounded-xl border border-white/10 bg-slate-950 p-2" aria-label="Emoji picker">{COMMUNITY_EMOJIS.map(emoji=><button type="button" key={emoji} aria-label={`Insert ${emoji}`} onClick={()=>onEmoji(emoji)} className="min-h-10 min-w-10 rounded-lg text-xl hover:bg-white/10">{emoji}</button>)}</div>:null}
  </div>;
}
