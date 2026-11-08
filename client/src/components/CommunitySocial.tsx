import {useState} from 'react';
import {COMMUNITY_EMOJIS, COMMUNITY_GIFS, COMMUNITY_REACTIONS, communityGif, type CommunityReactionCount} from '../../../shared/community-social';

export function CommunityGif({id}: {id:string}) {
  const [playing,setPlaying]=useState(false);
  const gif=communityGif(id);
  if(!gif)return null;
  return <button type="button" onClick={()=>setPlaying(value=>!value)} className="mt-2 block max-w-full overflow-hidden rounded-xl border border-white/10 text-left" aria-label={`${playing?'Pause':'Play'} GIF: ${gif.label}`}>
    <img src={`/community-gifs/${gif.id}.${playing?'gif':'png'}`} alt={gif.label} width={280} height={158} loading="lazy" decoding="async" className="h-auto max-w-full" />
    <span className="block bg-black/30 px-2 py-1 text-[10px] text-white/60">{playing?'Pause GIF':'▶ Play GIF'}</span>
  </button>;
}

export function CommunityReactions({reactions=[],disabled,onChange}: {reactions?:CommunityReactionCount[];disabled:boolean;onChange:(emoji:string,active:boolean)=>void}) {
  const [open,setOpen]=useState(false);
  return <div className="mt-2 flex flex-wrap items-center gap-1.5">
    {reactions.filter(reaction=>reaction.count>0).map(reaction=><button key={reaction.emoji} type="button" disabled={disabled} aria-pressed={reaction.mine} aria-label={`${reaction.emoji}: ${reaction.count} reactions${reaction.mine?', including you':''}`} onClick={()=>onChange(reaction.emoji,!reaction.mine)} className={`min-h-9 rounded-full border px-2.5 text-xs ${reaction.mine?'border-cyan-300/50 bg-cyan-300/15':'border-white/10 bg-white/5'} disabled:opacity-50`}>{reaction.emoji} {reaction.count}</button>)}
    <button type="button" aria-expanded={open} aria-label="React to message" onClick={()=>setOpen(!open)} className="min-h-9 rounded-full bg-white/5 px-2.5 text-xs text-white/70">☺ React</button>
    {open?<div className="flex flex-wrap gap-1 rounded-xl border border-white/10 bg-slate-950 p-1" aria-label="Choose a reaction">{COMMUNITY_REACTIONS.map(emoji=><button key={emoji} type="button" disabled={disabled} aria-label={`React ${emoji}`} onClick={()=>{onChange(emoji,!reactions.find(item=>item.emoji===emoji)?.mine);setOpen(false);}} className="min-h-10 min-w-10 rounded-lg text-xl hover:bg-white/10">{emoji}</button>)}</div>:null}
  </div>;
}

export function CommunitySocialComposer({gifId,onGif,onEmoji}: {gifId:string|null;onGif:(id:string|null)=>void;onEmoji:(emoji:string)=>void}) {
  const [picker,setPicker]=useState<'emoji'|'gif'|null>(null);
  return <div className="mb-2 space-y-2">
    {gifId?<div className="flex items-center justify-between rounded-lg bg-cyan-300/10 px-3 py-2 text-xs"><span>GIF: {communityGif(gifId)?.label}</span><button type="button" onClick={()=>onGif(null)} aria-label="Remove selected GIF" className="min-h-8 px-2">✕</button></div>:null}
    <div className="flex gap-2"><button type="button" aria-expanded={picker==='emoji'} onClick={()=>setPicker(picker==='emoji'?null:'emoji')} className="min-h-9 rounded-lg bg-white/5 px-3 text-xs">😀 Emojis</button><button type="button" aria-expanded={picker==='gif'} onClick={()=>setPicker(picker==='gif'?null:'gif')} className="min-h-9 rounded-lg bg-white/5 px-3 text-xs">GIFs</button></div>
    {picker==='emoji'?<div className="flex max-h-32 flex-wrap gap-1 overflow-y-auto rounded-xl border border-white/10 bg-slate-950 p-2" aria-label="Emoji picker">{COMMUNITY_EMOJIS.map(emoji=><button type="button" key={emoji} aria-label={`Insert ${emoji}`} onClick={()=>onEmoji(emoji)} className="min-h-10 min-w-10 rounded-lg text-xl hover:bg-white/10">{emoji}</button>)}</div>:null}
    {picker==='gif'?<div className="grid max-h-48 grid-cols-2 gap-2 overflow-y-auto rounded-xl border border-white/10 bg-slate-950 p-2" aria-label="GIF picker">{COMMUNITY_GIFS.map(gif=><button type="button" key={gif.id} aria-label={`Choose GIF: ${gif.label}`} onClick={()=>{onGif(gif.id);setPicker(null);}} className="overflow-hidden rounded-lg border border-white/10 text-left"><img src={`/community-gifs/${gif.id}.png`} alt="" width={280} height={158} loading="lazy" className="h-auto w-full"/><span className="block px-2 py-1 text-[10px]">{gif.label}</span></button>)}</div>:null}
  </div>;
}
