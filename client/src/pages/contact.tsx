import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { CheckCircle2, Mail, MessageSquareText, ShieldCheck, ArrowLeft, Trophy, Send, Globe2, MapPin } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";

type ContactInfo={brand:string;website:string;region:string;email:string|null;partnersEmail?:string|null;onlineSupport:boolean;note:string};
const categories=[
  ["general","General enquiry"],["account","Account or sign-in"],["cards","Cards and minting"],
  ["tournament","Gameweeks and tournaments"],["prizes","Prize claims and Trophy Cabinet"],
  ["payments","Deposits or withdrawals"],["marketplace","Marketplace"],
  ["partnerships","Partnerships and media"],["privacy","Privacy or data request"],
] as const;
const selectClass="min-h-11 w-full rounded-xl border border-white/15 bg-[#0c1225] px-3 text-sm text-white outline-none focus:border-cyan-300/50";
export default function ContactPage(){
  const [name,setName]=useState("");
  const [email,setEmail]=useState("");
  const [category,setCategory]=useState("general");
  const [subject,setSubject]=useState("");
  const [message,setMessage]=useState("");
  const [trap,setTrap]=useState("");
  const [reference,setReference]=useState("");
  const {data}=useQuery<ContactInfo>({
    queryKey:["/api/public/contact-info"],staleTime:60_000,
    queryFn:async()=>{const r=await fetch("/api/public/contact-info");if(!r.ok)throw new Error("Unable to fetch contact information");return r.json();}
  });
  const submit=useMutation({
    mutationFn:async()=>{
      const response=await fetch("/api/public/contact",{
        method:"POST",headers:{"Content-Type":"application/json"},
        credentials:"include",body:JSON.stringify({name,email,category,subject,message,website:trap})
      });
      const result=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(result?.message||"We couldn't submit your request.");
      return result as {reference:string};
    },
    onSuccess:(result)=>setReference(result.reference),
  });
  return <main className="min-h-screen bg-[radial-gradient(circle_at_50%_0%,rgba(59,130,246,.15),transparent_40%),#050814] px-4 py-6 text-white sm:py-10">
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/"><Button variant="ghost" className="text-white/65"><ArrowLeft className="mr-2 h-4 w-4"/>Fantasy Arena</Button></Link>
        <Link href="/help" className="rounded-xl border border-white/15 px-4 py-2 text-sm text-cyan-100 hover:bg-white/5">Help Centre</Link>
      </div>
      <div className="mt-6 rounded-[2rem] border border-cyan-300/20 bg-gradient-to-br from-[#111b38] to-[#090914] p-6 sm:p-9">
        <p className="text-xs font-black uppercase tracking-[.2em] text-cyan-300">We're here to help</p>
        <h1 className="mt-3 text-4xl font-black sm:text-5xl">Contact Fantasy Arena</h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-white/60">Questions about your cards, tournament prizes, payments or account? Send our team a secure request. You'll receive a reference number, and the message appears in the Fantasy Arena admin support inbox.</p>
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1.15fr]">
        <div className="space-y-4">
          <section className="rounded-[1.6rem] border border-white/10 bg-white/[.035] p-5">
            <h2 className="flex items-center gap-2 text-lg font-black"><MessageSquareText className="h-5 w-5 text-cyan-300"/>Support channels</h2>
            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-emerald-300/15 bg-emerald-300/[.06] p-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-200"/>
              <div><div className="font-bold">Website support form</div><p className="mt-1 text-xs leading-5 text-white/55">Available now. Support requests are securely recorded even while domain email setup is being completed.</p></div>
            </div>
            {data?.email?<a href={`mailto:${data.email}`} className="mt-3 flex min-w-0 items-start gap-3 rounded-2xl border border-cyan-300/15 bg-cyan-300/[.04] p-4 hover:bg-cyan-300/10"><Mail className="mt-0.5 h-5 w-5 shrink-0 text-cyan-200"/><div className="min-w-0"><div className="text-sm font-bold">Verified email support</div><div className="break-all text-sm text-cyan-200">{data.email}</div></div></a>
            :<div className="mt-3 flex items-start gap-3 rounded-2xl border border-white/10 p-4"><Mail className="h-5 w-5 shrink-0 text-white/40"/><p className="text-xs leading-5 text-white/55">Our custom-domain support mailbox is being configured. Please use the form rather than an unverified email address.</p></div>}
            {data?.partnersEmail?<a href={`mailto:${data.partnersEmail}`} className="mt-3 flex items-start gap-3 rounded-2xl border border-amber-300/15 bg-amber-300/[.04] p-4 hover:bg-amber-300/10"><Mail className="mt-0.5 h-5 w-5 shrink-0 text-amber-200"/><div className="min-w-0"><div className="text-sm font-bold">Sponsorships & partnerships</div><div className="break-all text-sm text-amber-100">{data.partnersEmail}</div></div></a>:null}
            <div className="mt-3 flex items-center gap-3 rounded-xl p-2 text-sm text-white/65"><Globe2 className="h-5 w-5 text-fuchsia-200"/><a className="break-all text-cyan-100 hover:underline" href="https://playfantasyarena.com">playfantasyarena.com</a></div>
            <div className="flex items-center gap-3 rounded-xl p-2 text-sm text-white/65"><MapPin className="h-5 w-5 text-fuchsia-200"/>Namibia · Online support</div>
          </section>
          <section className="rounded-[1.6rem] border border-amber-300/15 bg-amber-300/[.04] p-5">
            <h2 className="flex items-center gap-2 font-black"><ShieldCheck className="h-5 w-5 text-amber-200"/>Protect your account</h2>
            <p className="mt-3 text-sm leading-6 text-white/60">Never send passwords, login codes, bank-card numbers or full identity documents in a support message. For tournament or payment issues, include the entry or transaction reference.</p>
            <Link href="/legal/privacy" className="mt-3 inline-block text-xs font-bold text-cyan-200 hover:underline">Privacy Policy →</Link>
          </section>
        </div>
        <section className="rounded-[1.6rem] border border-white/10 bg-white/[.05] p-5 sm:p-7">
          {reference?<div className="flex h-full min-h-[370px] flex-col items-center justify-center text-center">
            <div className="grid h-20 w-20 place-items-center rounded-full border border-emerald-200/30 bg-emerald-300/15"><CheckCircle2 className="h-10 w-10 text-emerald-200"/></div>
            <h2 className="mt-4 text-3xl font-black">Message received!</h2>
            <p className="mt-3 max-w-md text-sm leading-6 text-white/60">Your request has been saved for the Fantasy Arena support team. Keep this reference for follow-up.</p>
            <div className="mt-4 rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-6 py-3 font-mono text-xl font-black text-cyan-100">{reference}</div>
            <Button type="button" variant="outline" className="mt-6 border-white/20 text-white" onClick={()=>{setReference("");setSubject("");setMessage("");}}>Send another request</Button>
          </div>:<form onSubmit={event=>{event.preventDefault();if(!submit.isPending)submit.mutate();}} className="space-y-4">
            <div><h2 className="text-2xl font-black">Send us a message</h2><p className="mt-1 text-xs text-white/45">* Required fields</p></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-bold text-white/70">Your name *<Input required minLength={2} maxLength={120} autoComplete="name" value={name} onChange={e=>setName(e.target.value)} className="mt-2 border-white/15 bg-black/35 text-white" placeholder="Your name"/></label>
              <label className="block text-xs font-bold text-white/70">Your email *<Input required type="email" maxLength={254} autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} className="mt-2 border-white/15 bg-black/35 text-white" placeholder="you@example.com"/></label>
            </div>
            <label className="block text-xs font-bold text-white/70">What can we help with? *<select required value={category} onChange={e=>setCategory(e.target.value)} className={`mt-2 ${selectClass}`}>{categories.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
            <label className="block text-xs font-bold text-white/70">Subject *<Input required minLength={4} maxLength={180} value={subject} onChange={e=>setSubject(e.target.value)} className="mt-2 border-white/15 bg-black/35 text-white" placeholder="Describe the issue briefly"/></label>
            <label className="block text-xs font-bold text-white/70">Message *<textarea required minLength={12} maxLength={5000} rows={7} value={message} onChange={e=>setMessage(e.target.value)} placeholder="Please describe what happened, including any relevant gameweek, tournament, entry or transaction ID." className={`mt-2 resize-y ${selectClass}`}/><span className="mt-1 block text-right font-normal text-white/40">{message.length}/5000 characters</span></label>
            <label className="absolute -left-[9999px]" aria-hidden="true" tabIndex={-1}>Leave this empty<input type="text" value={trap} tabIndex={-1} autoComplete="off" onChange={e=>setTrap(e.target.value)}/></label>
            {submit.isError?<p role="alert" className="rounded-xl border border-red-300/25 bg-red-300/10 p-3 text-sm text-red-200">{(submit.error as Error)?.message}</p>:null}
            <Button disabled={submit.isPending} type="submit" className="min-h-12 w-full bg-gradient-to-r from-fuchsia-500 to-cyan-400 font-black text-white"><Send className="mr-2 h-4 w-4"/>{submit.isPending?"Saving your request…":"Send support request"}</Button>
            <p className="text-center text-xs leading-5 text-white/40"><Trophy className="mr-1 inline h-3.5 w-3.5"/>Requests go directly to Fantasy Arena Support. Please save the reference shown after submitting.</p>
          </form>}
        </section>
      </div>
    </div>
  </main>;
}
