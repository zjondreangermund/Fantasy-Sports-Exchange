import { useQuery, useMutation } from "@tanstack/react-query";
import { Bell, ShieldCheck } from "lucide-react";
import { queryClient } from "../../lib/queryClient";
import { useToast } from "../../hooks/use-toast";

const groups = [
  {key:"tournament",name:"Gameweeks & tournament deadlines",detail:"Opening/closing windows, lineups, fixture changes."},
  {key:"players",name:"Your selected footballers",detail:"Injuries, suspensions, availability and card replacements."},
  {key:"prizes",name:"Prize Vault & claims",detail:"Real funded-prize increases and prizes needing action."},
  {key:"marketplace",name:"Marketplace, card loans & price watches",detail:"Watched price changes and expiring loans."},
  {key:"community",name:"Community mentions",detail:"When other managers mention your team."},
  {key:"mint",name:"Card mint reminders",detail:"Only one combined phone reminder when your weekly reward or multiple replacements are waiting. Pending actions always stay in Inbox."},
  {key:"marketing",name:"Promotional announcements",detail:"Optional general promotions; off by default."},
] as const;
type Group = typeof groups[number]["key"];
type Prefs = Record<Group, boolean>;
const defaults:Prefs={tournament:true,players:true,prizes:true,marketplace:true,community:true,mint:true,marketing:false};
export default function ArenaNotificationPreferences(){
  const {toast}=useToast();
  const {data:pref=defaults,isLoading}=useQuery<Prefs>({
    queryKey:["/api/notification-preferences"],
    queryFn:async()=>{
      const r=await fetch("/api/notification-preferences",{credentials:"include"});
      if(!r.ok)throw new Error("Could not retrieve your alert settings");
      const data=await r.json();
      return {...defaults,...(data?.preferences||{})};
    },
  });
  const save=useMutation({
    mutationFn:async(next:Prefs)=>{
      const r=await fetch("/api/notification-preferences",{
        method:"PUT",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({preferences:next}),
      });
      if(!r.ok)throw new Error((await r.json().catch(()=>({})))?.message||"Could not save alert settings");
      return (await r.json()).preferences as Prefs;
    },
    onSuccess:(v)=>{queryClient.setQueryData(["/api/notification-preferences"],v);toast({title:"Notification settings saved"});},
    onError:(error:any)=>toast({title:"Could not save preferences",description:error?.message,variant:"destructive"}),
  });
  return <section className="mb-4 rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-[#111d30] to-[#090b1a] p-4 text-white">
    <h3 className="flex items-center gap-2 text-base font-black"><Bell className="h-4 w-4 text-cyan-300"/>Notification preferences</h3>
    <p className="mt-1 text-xs text-slate-400">Choose optional alerts. Account security, legal and payment status messages remain in your Inbox even if other categories are off.</p>
    <div className="mt-3 space-y-2">{groups.map(group=><label key={group.key} className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-white/[.06] bg-white/[.035] p-3">
      <span className="min-w-0"><span className="block text-sm font-semibold">{group.name}</span><span className="block text-[11px] text-slate-400">{group.detail}</span></span>
      <input type="checkbox" aria-label={group.name} checked={pref[group.key]} disabled={isLoading||save.isPending}
        onChange={e=>save.mutate({...pref,[group.key]:e.target.checked})} className="h-5 w-5 shrink-0 accent-cyan-400"/>
    </label>)}</div>
    <p className="mt-3 flex items-start gap-2 text-[11px] text-cyan-100/70"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0"/>Urgent account and financial confirmations cannot be disabled here. Phone delivery also requires notifications enabled on your device.</p>
  </section>;
}
