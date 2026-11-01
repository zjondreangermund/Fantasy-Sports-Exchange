import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

type Props={title:string;count?:number;logo?:string;defaultOpen?:boolean;forceOpen?:boolean;children:ReactNode};
/** Keeps team/history lists compact, with a real keyboard-accessible disclosure button. */
export default function FootballTeamGroups({title,count,logo,defaultOpen=false,forceOpen=false,children}:Props) {
  const [open,setOpen]=useState(defaultOpen);
  useEffect(()=>{setOpen(forceOpen||defaultOpen);},[forceOpen,defaultOpen]);
  return <section className="overflow-hidden rounded-xl border border-white/10 bg-black/20" data-football-disclosure>
    <h3><button type="button" aria-expanded={open} onClick={()=>setOpen(value=>!value)} className="flex w-full min-w-0 items-center gap-3 p-4 text-left hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">
      {logo?<img src={logo} alt="" className="h-7 w-7 shrink-0 object-contain"/>:null}
      <span className="min-w-0 flex-1 font-black">{title}</span>
      {count!=null?<span className="shrink-0 rounded-full border border-white/15 px-2 py-0.5 text-xs text-muted-foreground">{count}</span>:null}
      <ChevronDown aria-hidden="true" className={`h-4 w-4 shrink-0 transition-transform ${open?'rotate-180':''}`}/>
    </button></h3>
    {open?<div className="space-y-2 border-t border-white/10 p-3">{children}</div>:null}
  </section>;
}
