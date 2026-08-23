import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const write = (file, content) => fs.writeFileSync(path.join(root, file), content);
const replaceOnce = (source, from, to, label) => {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`Patch anchor not found: ${label}`);
  return source.replace(from, to);
};

// Remove the oversized desktop-only logo while keeping the compact navigation/footer branding.
{
  const file = "client/src/pages/landing.tsx";
  let source = read(file);
  source = source.replace(/\n\s*<motion\.div[^>]*className="hidden justify-center lg:flex"[\s\S]*?<\/motion\.div>\n/, "\n");
  source = source.replace('lg:grid-cols-[1fr_430px]', 'lg:grid-cols-1');
  write(file, source);
}

// Restore a visible read-only launch banner and a short bottom-right reminder.
write("client/src/components/MarketplaceFloorNotice.tsx", `import { useEffect, useState } from "react";
import { Eye, X } from "lucide-react";
import { MARKETPLACE_FLOOR_BY_RARITY } from "../../../shared/card-economy";

const FLOORS = [
  { rarity: "Rare", value: MARKETPLACE_FLOOR_BY_RARITY.rare, className: "border-blue-300/25 bg-blue-400/10 text-blue-100" },
  { rarity: "Unique", value: MARKETPLACE_FLOOR_BY_RARITY.unique, className: "border-purple-300/25 bg-purple-400/10 text-purple-100" },
  { rarity: "Epic", value: MARKETPLACE_FLOOR_BY_RARITY.epic, className: "border-red-300/25 bg-red-400/10 text-red-100" },
  { rarity: "Legendary", value: MARKETPLACE_FLOOR_BY_RARITY.legendary, className: "border-amber-300/25 bg-amber-400/10 text-amber-100" },
] as const;
const money = (value: number) => \`N$\${Number(value || 0).toFixed(0)}\`;

export default function MarketplaceFloorNotice() {
  const [showReminder, setShowReminder] = useState(true);
  useEffect(() => {
    const timer = window.setTimeout(() => setShowReminder(false), 6500);
    return () => window.clearTimeout(timer);
  }, []);
  return <>
    <aside className="relative z-40 shrink-0 border-b border-amber-200/15 bg-[#09080f]/95 px-3 py-2 text-white shadow-[0_10px_30px_rgba(0,0,0,.28)] backdrop-blur-xl sm:px-5" aria-label="Marketplace read-only notice">
      <div className="mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto pb-0.5">
        <span data-help="The marketplace is visible for browsing and testing. Public buying, selling and auctions remain restricted until launch controls are removed." className="flex shrink-0 items-center gap-1.5 rounded-xl border border-amber-300/25 bg-amber-400/10 px-2.5 py-1 text-[11px] font-black text-amber-100"><Eye className="h-3.5 w-3.5" />Read-only preview</span>
        <span className="shrink-0 text-[10px] font-black uppercase tracking-[.18em] text-white/55">Marketplace floors</span>
        <span className="shrink-0 rounded-xl border border-slate-300/20 bg-slate-400/10 px-2.5 py-1 text-[11px] font-bold text-slate-200">Common: tournament only</span>
        {FLOORS.map((floor) => <span key={floor.rarity} data-help={\`The minimum permitted listing price for \${floor.rarity} cards. Sellers cannot list below this amount.\`} className={\`shrink-0 rounded-xl border px-2.5 py-1 text-[11px] font-black \${floor.className}\`}>{floor.rarity}: {money(floor.value)} minimum</span>)}
      </div>
    </aside>
    {showReminder ? <div className="fixed bottom-24 right-4 z-[95] w-[min(360px,calc(100vw-2rem))] rounded-2xl border border-amber-200/20 bg-slate-950/82 p-4 text-white shadow-2xl backdrop-blur-2xl sm:bottom-5">
      <button className="absolute right-2 top-2 rounded-lg p-1 text-white/45 hover:bg-white/10 hover:text-white" onClick={() => setShowReminder(false)} aria-label="Close read-only reminder"><X className="h-4 w-4" /></button>
      <div className="flex items-start gap-3"><div className="rounded-xl bg-amber-300/12 p-2 text-amber-200"><Eye className="h-5 w-5" /></div><div><p className="text-sm font-black">Marketplace preview</p><p className="mt-1 text-xs leading-5 text-white/55">This area is currently read-only while Fantasy Arena prepares the public launch.</p></div></div>
    </div> : null}
  </>;
}
`);

// Preserve the canonical notification-aware chat widget once it supersedes the legacy generator.
if (!read("client/src/components/FloatingSupportWidget.tsx").includes("COMMUNITY_MENTION_NOTIFICATION_V1")) write("client/src/components/FloatingSupportWidget.tsx", `import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Bot, Check, HelpCircle, Mail, MessageCircle, Pencil, Reply, Send, Trash2, Users, X } from "lucide-react";
import { Link } from "wouter";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { apiRequest, queryClient } from "../lib/queryClient";

type ChatMessage = { id:number; userId:string; teamName:string; avatarUrl?:string|null; message:string; createdAt:string; editedAt?:string|null; replyToId?:number|null; replyToTeamName?:string|null; replyToMessage?:string|null; isOwn?:boolean; canDelete?:boolean; };
type User = { id?:string; managerTeamName?:string|null; name?:string|null; isAdmin?:boolean };
type Listing = { id?:number; cardId?:number; price?:number; rarity?:string; player?:{ name?:string }; ownerName?:string; ownerUsername?:string };
const chatKey = ["/api/community-chat/messages-v2"] as const;
const seenListingsKey = "fantasy_arena_seen_listing_ids_v2";
const quickHelp = [
  ["2.0× funding", "A 2.0× funding multiplier means the entry revenue target is twice the advertised prize value, allowing the prize and platform costs to be funded before it unlocks."],
  ["Prize progress", "This shows how close the shared rarity and gameweek entry pool is to unlocking the next Prize Vault reward."],
  ["Card rarity", "Rarity controls supply, eligible tournament combinations, marketplace floors and the Prize Vault ladder you can enter."],
  ["Auction bid", "A bid temporarily locks funds in your wallet. When another user outbids you, the previous locked amount is returned automatically."],
  ["Marketplace floor", "A floor is the lowest price at which a rarity may be listed. It protects the minimum value of that card tier."],
];

function inferHelp(el: HTMLElement) {
  const explicit = el.dataset.help || el.getAttribute("aria-description") || el.getAttribute("title");
  if (explicit) return explicit;
  const text = (el.getAttribute("aria-label") || el.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 100);
  if (!text) return "This control is part of the Fantasy Arena workflow.";
  const lower = text.toLowerCase();
  if (lower.includes("2.0") || lower.includes("funding")) return quickHelp[0][1];
  if (lower.includes("progress")) return quickHelp[1][1];
  if (lower.includes("rarity") || ["common","rare","unique","epic","legendary"].some((x) => lower.includes(x))) return quickHelp[2][1];
  if (lower.includes("bid") || lower.includes("auction")) return quickHelp[3][1];
  if (lower.includes("floor") || lower.includes("minimum")) return quickHelp[4][1];
  if (el.tagName === "A") return \`Opens \${text}. Stay on it for three seconds whenever you need this explanation again.\`;
  if (el.tagName === "BUTTON") return \`Use this to \${text.toLowerCase()}.\`;
  if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") return \`Enter the information requested for \${text || "this field"}.\`;
  return \`\${text}: this section shows information used in the Fantasy Arena workflow.\`;
}

function GuidedHoverHelp() {
  const [tip, setTip] = useState<{ text:string; x:number; y:number }|null>(null);
  useEffect(() => {
    let timer = 0;
    let target: HTMLElement | null = null;
    const eligible = (node: EventTarget|null) => node instanceof HTMLElement ? node.closest<HTMLElement>("[data-help],button,a,input,textarea,select,[role='button'],[role='tab'],[role='menuitem'],label,.badge") : null;
    const enter = (event: PointerEvent) => {
      const next = eligible(event.target);
      if (!next || next === target) return;
      window.clearTimeout(timer); target = next;
      timer = window.setTimeout(() => {
        if (!target) return;
        const rect = target.getBoundingClientRect();
        setTip({ text: inferHelp(target), x: Math.min(window.innerWidth - 330, Math.max(12, rect.left + rect.width / 2 - 150)), y: Math.min(window.innerHeight - 150, rect.bottom + 10) });
      }, 3000);
    };
    const leave = (event: PointerEvent) => {
      const leaving = eligible(event.target);
      if (leaving && leaving === target && !(event.relatedTarget instanceof Node && leaving.contains(event.relatedTarget))) { window.clearTimeout(timer); target = null; setTip(null); }
    };
    document.addEventListener("pointerover", enter, true); document.addEventListener("pointerout", leave, true);
    return () => { window.clearTimeout(timer); document.removeEventListener("pointerover", enter, true); document.removeEventListener("pointerout", leave, true); };
  }, []);
  return tip ? <div style={{ left:tip.x, top:tip.y }} className="pointer-events-none fixed z-[120] w-[310px] rounded-2xl border border-cyan-200/20 bg-slate-950/88 p-3 text-xs leading-5 text-white/80 shadow-2xl backdrop-blur-2xl"><p className="mb-1 font-black text-cyan-200">What is this?</p>{tip.text}</div> : null;
}

function MarketplaceListingActivity() {
  const [notice, setNotice] = useState<Listing|null>(null);
  const { data=[] } = useQuery<Listing[]>({ queryKey:["/api/marketplace"], queryFn:async()=>{ const r=await fetch("/api/marketplace",{credentials:"include"}); if(!r.ok) return []; const p=await r.json(); return Array.isArray(p)?p:(p.listings||p.cards||[]); }, refetchInterval:12000, staleTime:0 });
  useEffect(() => {
    if (!data.length) return;
    let seen:number[]=[]; try { seen=JSON.parse(localStorage.getItem(seenListingsKey)||"[]"); } catch {}
    const ids=data.map((x)=>Number(x.id??x.cardId??0)).filter(Boolean);
    if (!seen.length) { localStorage.setItem(seenListingsKey,JSON.stringify(ids.slice(0,250))); return; }
    const fresh=data.find((x)=>!seen.includes(Number(x.id??x.cardId??0)));
    localStorage.setItem(seenListingsKey,JSON.stringify(Array.from(new Set([...ids,...seen])).slice(0,250)));
    if (fresh) { setNotice(fresh); const t=window.setTimeout(()=>setNotice(null),6500); return()=>window.clearTimeout(t); }
  }, [data]);
  if (!notice) return null;
  return <div className="fixed bottom-24 right-4 z-[96] w-[min(355px,calc(100vw-2rem))] rounded-2xl border border-emerald-200/20 bg-slate-950/84 p-4 text-white shadow-2xl backdrop-blur-2xl sm:bottom-5"><button onClick={()=>setNotice(null)} className="absolute right-2 top-2 p-1 text-white/45"><X className="h-4 w-4" /></button><p className="text-[10px] font-black uppercase tracking-[.18em] text-emerald-300">New card listed</p><p className="mt-1 font-black">{notice.player?.name || "Player card"}</p><p className="mt-1 text-xs text-white/55">{String(notice.rarity||"card").toUpperCase()} • N${Number(notice.price||0).toFixed(2)}</p></div>;
}

function highlightMentions(text:string) {
  return text.split(/(@[A-Za-z0-9_.-]+)/g).map((part,i)=>part.startsWith("@")?<span key={i} className="font-black text-cyan-200">{part}</span>:part);
}

export default function FloatingSupportWidget() {
  const [open,setOpen]=useState(false); const [mode,setMode]=useState<"community"|"help">("community");
  const [input,setInput]=useState(""); const [replyTo,setReplyTo]=useState<ChatMessage|null>(null); const [editing,setEditing]=useState<ChatMessage|null>(null); const [error,setError]=useState("");
  const scrollRef=useRef<HTMLDivElement|null>(null);
  const { data:user }=useQuery<User>({queryKey:["/api/user"]});
  const { data:admin }=useQuery<{isAdmin:boolean}>({queryKey:["/api/admin/check"],retry:false});
  const { data:messages=[],isLoading }=useQuery<ChatMessage[]>({queryKey:chatKey,queryFn:async()=>{const r=await fetch("/api/community-chat/messages-v2",{credentials:"include"});if(!r.ok)throw new Error("Failed to load chat");const p=await r.json();return p.messages||p||[];},refetchInterval:12000,staleTime:0});
  useEffect(()=>{if(open&&mode==="community")window.setTimeout(()=>scrollRef.current?.scrollTo({top:scrollRef.current.scrollHeight,behavior:"smooth"}),40);},[open,mode,messages.length]);
  const mutation=useMutation({mutationFn:async()=>{const text=input.trim();if(editing)return (await apiRequest("PATCH",\`/api/community-chat/messages-v2/\${editing.id}\`,{message:text})).json();if(replyTo)return (await apiRequest("POST",\`/api/community-chat/messages-v2/\${replyTo.id}/reply\`,{message:text})).json();return (await apiRequest("POST","/api/community-chat/messages-v2",{message:text})).json();},onSuccess:()=>{setInput("");setReplyTo(null);setEditing(null);setError("");queryClient.invalidateQueries({queryKey:chatKey});},onError:(e:any)=>setError(String(e?.message||"Message failed").replace(/^\\d+:\\s*/,""))});
  const remove=async(message:ChatMessage)=>{if(!window.confirm("Delete this message?"))return;try{await apiRequest("DELETE",\`/api/community-chat/messages-v2/\${message.id}\`);queryClient.invalidateQueries({queryKey:chatKey});}catch(e:any){setError(e.message)}};
  const submit=()=>{if(input.trim()&&!mutation.isPending)mutation.mutate();};
  const canDelete=(m:ChatMessage)=>Boolean(m.isOwn||m.userId===user?.id||admin?.isAdmin||m.canDelete);
  return <>
    <GuidedHoverHelp/><MarketplaceListingActivity/>
    <div className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] right-3 z-[90] sm:bottom-4 sm:right-4">
      {open?<Card className="mb-2 flex max-h-[min(74dvh,620px)] w-[min(calc(100vw-1.5rem),410px)] flex-col overflow-hidden border-white/15 bg-slate-950/80 text-white shadow-2xl backdrop-blur-2xl">
        <div className="flex items-center justify-between border-b border-white/10 p-3"><div><p className="font-black">{mode==="community"?"Community Live":"Arena Help"}</p><p className="text-[11px] text-white/45">{mode==="community"?"Reply, mention and manage messages":"Hover on any labelled item for 3 seconds"}</p></div><Button size="icon" variant="ghost" onClick={()=>setOpen(false)}><X className="h-4 w-4"/></Button></div>
        <div className="grid grid-cols-2 border-b border-white/10 p-1.5"><button onClick={()=>setMode("community")} className={\`rounded-lg p-2 text-xs font-black \${mode==="community"?"bg-cyan-300/15 text-cyan-200":"text-white/45"}\`}>Community</button><button onClick={()=>setMode("help")} className={\`rounded-lg p-2 text-xs font-black \${mode==="help"?"bg-violet-300/15 text-violet-200":"text-white/45"}\`}>Help</button></div>
        {mode==="community"?<><div ref={scrollRef} className="min-h-[280px] flex-1 space-y-2 overflow-y-auto p-3">{isLoading?<p className="py-10 text-center text-white/40">Connecting…</p>:null}{messages.map((m)=>{const own=m.isOwn||m.userId===user?.id;return <div key={m.id} className={\`flex \${own?"justify-end":"justify-start"}\`}><div className={\`max-w-[88%] rounded-2xl border px-3 py-2 \${own?"border-cyan-200/20 bg-cyan-300/10":"border-white/10 bg-white/[.05]"}\`}>{m.replyToId?<div className="mb-2 rounded-lg border-l-2 border-cyan-300/40 bg-black/25 px-2 py-1 text-[10px] text-white/45"><b className="text-cyan-200">Reply to {m.replyToTeamName||"manager"}</b><div className="truncate">{m.replyToMessage}</div></div>:null}<div className="flex items-center gap-2 text-[10px]"><b className={own?"text-cyan-200":"text-white/65"}>{own?"You":m.teamName}</b><span className="text-white/30">{new Date(m.createdAt).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}{m.editedAt?" • edited":""}</span></div><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-5">{highlightMentions(m.message)}</p><div className="mt-1 flex justify-end gap-1"><button onClick={()=>{setReplyTo(m);setEditing(null);setInput(\`@\${m.teamName.replace(/\\s+/g,"")} \`);}} className="rounded p-1 text-white/35 hover:text-cyan-200" title="Reply"><Reply className="h-3.5 w-3.5"/></button>{own?<button onClick={()=>{setEditing(m);setReplyTo(null);setInput(m.message);}} className="rounded p-1 text-white/35 hover:text-white" title="Edit"><Pencil className="h-3.5 w-3.5"/></button>:null}{canDelete(m)?<button onClick={()=>remove(m)} className="rounded p-1 text-white/35 hover:text-rose-300" title={admin?.isAdmin&&!own?"Admin delete":"Delete"}><Trash2 className="h-3.5 w-3.5"/></button>:null}</div></div></div>})}</div><div className="border-t border-white/10 p-2.5">{replyTo||editing?<div className="mb-2 flex items-center justify-between rounded-lg bg-white/[.05] px-2 py-1 text-xs text-white/55"><span>{editing?\`Editing your message\`:\`Replying to \${replyTo?.teamName}\`}</span><button onClick={()=>{setReplyTo(null);setEditing(null);setInput("")}}><X className="h-3.5 w-3.5"/></button></div>:null}<div className="flex gap-2"><textarea value={input} onChange={(e)=>setInput(e.target.value.slice(0,280))} onKeyDown={(e)=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();submit()}}} rows={2} maxLength={280} placeholder="Message the community… Use @TeamName to mention" className="flex-1 resize-none rounded-xl border border-white/10 bg-white/[.05] px-3 py-2 text-sm outline-none"/><Button size="icon" onClick={submit} disabled={!input.trim()||mutation.isPending}>{editing?<Check className="h-4 w-4"/>:<Send className="h-4 w-4"/>}</Button></div>{error?<p className="mt-1 text-[10px] text-rose-200">{error}</p>:null}</div></>:<div className="space-y-3 overflow-auto p-3"><div className="rounded-xl border border-white/10 bg-white/[.04] p-3 text-sm leading-6 text-white/75"><b className="text-violet-200">Guided help is active.</b><p className="mt-1">Keep your mouse still over a tab, button, number, badge or field for three seconds. A small explanation will appear without opening another page.</p></div>{quickHelp.map(([label,text])=><div key={label} className="rounded-xl border border-white/10 bg-white/[.035] p-3"><p className="text-xs font-black text-cyan-200">{label}</p><p className="mt-1 text-xs leading-5 text-white/55">{text}</p></div>)}<Link href="/contact-us"><Button variant="outline" className="w-full"><Mail className="mr-2 h-4 w-4"/>Contact Support</Button></Link></div>}
      </Card>:null}
      {!open?<button onClick={()=>setOpen(true)} className="flex max-w-[285px] items-center gap-3 rounded-2xl border border-cyan-200/20 bg-slate-950/68 px-3 py-2 text-left text-white shadow-2xl backdrop-blur-xl"><span className="relative rounded-xl bg-cyan-300/12 p-2 text-cyan-200"><MessageCircle className="h-5 w-5"/><span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400"/></span><span className="hidden min-w-0 sm:block"><span className="block text-xs font-black">Community Live</span><span className="block truncate text-[10px] text-white/40">Chat or open guided help</span></span></button>:null}
    </div>
  </>;
}
`);

// Add v2 chat schema, server-side profanity enforcement and CRUD/reply endpoints while preserving v1 compatibility.
{
  const file = "server/routes/onboarding.routes.ts";
  let source = read(file);
  source = replaceOnce(source,
`          message text NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now()
        )`,
`          message text NOT NULL,
          reply_to_id bigint REFERENCES app.community_chat_messages(id) ON DELETE SET NULL,
          edited_at timestamptz,
          created_at timestamptz NOT NULL DEFAULT now()
        )`, "chat table columns");
  source = replaceOnce(source,
`      await db.execute(sql\`
        CREATE INDEX IF NOT EXISTS community_chat_messages_created_at_idx`,
`      await db.execute(sql\`ALTER TABLE app.community_chat_messages ADD COLUMN IF NOT EXISTS reply_to_id bigint REFERENCES app.community_chat_messages(id) ON DELETE SET NULL\`);
      await db.execute(sql\`ALTER TABLE app.community_chat_messages ADD COLUMN IF NOT EXISTS edited_at timestamptz\`);
      await db.execute(sql\`
        CREATE OR REPLACE FUNCTION app.reject_community_chat_profanity() RETURNS trigger AS $$$$
        BEGIN
          IF lower(NEW.message) ~ '(fuck|f\\W*u\\W*c\\W*k|shit|bitch|cunt|nigg|fagg|asshole|motherfucker|poes|kont|naai)' THEN
            RAISE EXCEPTION 'Community chat language is not allowed';
          END IF;
          RETURN NEW;
        END;
        $$$$ LANGUAGE plpgsql
      \`);
      await db.execute(sql\`DROP TRIGGER IF EXISTS community_chat_profanity_guard ON app.community_chat_messages\`);
      await db.execute(sql\`CREATE TRIGGER community_chat_profanity_guard BEFORE INSERT OR UPDATE OF message ON app.community_chat_messages FOR EACH ROW EXECUTE FUNCTION app.reject_community_chat_profanity()\`);
      await db.execute(sql\`
        CREATE INDEX IF NOT EXISTS community_chat_messages_created_at_idx`, "chat moderation schema");

  const insert = `

  const isCommunityAdmin = async (userId: string) => {
    const ids = String(process.env.ADMIN_USER_IDS || "").split(",").map((v) => v.trim()).filter(Boolean);
    if (ids.includes(userId)) return true;
    const emails = String(process.env.ADMIN_EMAILS || "lbcplaya@gmail.com").split(",").map((v) => v.trim().toLowerCase()).filter(Boolean);
    const row = rowsOf(await db.execute(sql\`SELECT lower(coalesce(email,'')) AS email FROM app.users WHERE id = \${userId} LIMIT 1\`))[0];
    return Boolean(row?.email && emails.includes(String(row.email).toLowerCase()));
  };
  const chatV2Select = async (userId: string, limit = 60) => rowsOf(await db.execute(sql\`
    SELECT m.id, m.user_id AS "userId", m.message, m.created_at AS "createdAt", m.edited_at AS "editedAt", m.deleted_at AS "deletedAt", m.reply_to_id AS "replyToId",
      COALESCE(NULLIF(btrim(u.manager_team_name), ''), NULLIF(btrim(u.name), ''), split_part(COALESCE(u.email, ''), '@', 1), 'Arena Manager') AS "teamName",
      u.avatar_url AS "avatarUrl",
      COALESCE(NULLIF(btrim(pu.manager_team_name), ''), NULLIF(btrim(pu.name), ''), 'Arena Manager') AS "replyToTeamName",
      parent.message AS "replyToMessage"
    FROM app.community_chat_messages m JOIN app.users u ON u.id=m.user_id
    LEFT JOIN app.community_chat_messages parent ON parent.id=m.reply_to_id
    LEFT JOIN app.users pu ON pu.id=parent.user_id
    ORDER BY m.id DESC LIMIT \${limit}
  \`)).reverse().map((row:any)=>({ ...row, id:Number(row.id), replyToId:row.replyToId?Number(row.replyToId):null, isOwn:String(row.userId)===userId }));
  const validateV2Message = (raw: unknown) => {
    const message = sanitizeCommunityMessage(raw).slice(0, 280);
    if (!message) { const error:any=new Error("Message is required"); error.status=400; throw error; }
    if (/(fuck|f\\W*u\\W*c\\W*k|shit|bitch|cunt|nigg|fagg|asshole|motherfucker|poes|kont|naai)/i.test(message)) { const error:any=new Error("That language is not allowed in Community Live"); error.status=400; throw error; }
    return message;
  };
  app.get("/api/community-chat/messages-v2", requireAuth, async (req:any,res)=>{ try { await ensureCommunityChatSchema(); const userId=String(req.authUserId||""); return res.json({messages:await chatV2Select(userId,Math.max(10,Math.min(80,Number(req.query?.limit||60))))}); } catch(error:any){ return res.status(500).json({message:error.message||"Failed to load chat"}); } });
  app.post("/api/community-chat/messages-v2", requireAuth, async (req:any,res)=>{ try { await ensureCommunityChatSchema(); const userId=String(req.authUserId||""); const message=validateV2Message(req.body?.message); const row=rowsOf(await db.execute(sql\`INSERT INTO app.community_chat_messages(user_id,message) VALUES (\${userId},\${message}) RETURNING id\`))[0]; return res.json({success:true,id:Number(row.id)}); } catch(error:any){ return res.status(error.status||400).json({message:error.message||"Message rejected"}); } });
  app.post("/api/community-chat/messages-v2/:id/reply", requireAuth, async (req:any,res)=>{ try { await ensureCommunityChatSchema(); const userId=String(req.authUserId||""); const parentId=Number(req.params.id); const message=validateV2Message(req.body?.message); const parent=rowsOf(await db.execute(sql\`SELECT id FROM app.community_chat_messages WHERE id=\${parentId}\`))[0]; if(!parent)return res.status(404).json({message:"Message not found"}); const row=rowsOf(await db.execute(sql\`INSERT INTO app.community_chat_messages(user_id,message,reply_to_id) VALUES (\${userId},\${message},\${parentId}) RETURNING id\`))[0]; return res.json({success:true,id:Number(row.id)}); } catch(error:any){ return res.status(error.status||400).json({message:error.message||"Reply rejected"}); } });
  app.patch("/api/community-chat/messages-v2/:id", requireAuth, async (req:any,res)=>{ try { await ensureCommunityChatSchema(); const userId=String(req.authUserId||""); const id=Number(req.params.id); const message=validateV2Message(req.body?.message); const row=rowsOf(await db.execute(sql\`UPDATE app.community_chat_messages SET message=\${message},edited_at=now() WHERE id=\${id} AND user_id=\${userId} RETURNING id\`))[0]; if(!row)return res.status(403).json({message:"You can edit only your own message"}); return res.json({success:true}); } catch(error:any){ return res.status(error.status||400).json({message:error.message||"Edit rejected"}); } });
  app.delete("/api/community-chat/messages-v2/:id", requireAuth, async (req:any,res)=>{ try { await ensureCommunityChatSchema(); const userId=String(req.authUserId||""); const id=Number(req.params.id); const admin=await isCommunityAdmin(userId); const row=rowsOf(await db.execute(admin?sql\`UPDATE app.community_chat_messages SET message='Message deleted by moderator',deleted_at=now(),deleted_by=\${userId} WHERE id=\${id} AND deleted_at IS NULL RETURNING id\`:sql\`UPDATE app.community_chat_messages SET message='Message deleted',deleted_at=now(),deleted_by=\${userId} WHERE id=\${id} AND user_id=\${userId} AND deleted_at IS NULL RETURNING id\`))[0]; if(!row)return res.status(403).json({message:"You cannot delete this message"}); return res.json({success:true,messageId:Number(row.id),deleted:true}); } catch(error:any){ return res.status(400).json({message:error.message||"Delete failed"}); } });
`;
  const last = source.lastIndexOf("\n}");
  if (!source.includes('/api/community-chat/messages-v2')) source = source.slice(0,last) + insert + source.slice(last);
  write(file, source);
}

// Repair auction bid wallets and make generated idempotency keys unique per click.
{
  const file = "server/services/auctionEscrow.ts";
  let source = read(file);
  source = replaceOnce(source,
`  const bucket = Math.floor(Date.now() / (5 * 60 * 1000));
  return \`\${userId}:auction:\${auctionId}:\${operation}:\${toMoney(amount || 0)}:\${bucket}\`;`,
`  return \`\${userId}:auction:\${auctionId}:\${operation}:\${toMoney(amount || 0)}:\${Date.now()}:\${Math.random().toString(36).slice(2, 9)}\`;`, "auction idempotency");
  source = replaceOnce(source,
`async function createHeldBid(tx: any, auction: any, bidderId: string, amount: number) {
  const wallet = rowsOf(await tx.execute(sql\``,
`async function createHeldBid(tx: any, auction: any, bidderId: string, amount: number) {
  await tx.execute(sql\`INSERT INTO app.wallets (user_id, balance, locked_balance) VALUES (\${bidderId}, 0, 0) ON CONFLICT (user_id) DO NOTHING\`);
  const wallet = rowsOf(await tx.execute(sql\``, "auction wallet ensure");
  write(file, source);
}

// Add an explicit points table directly below the scoring-rule sections.
{
  const file = "client/src/pages/legal-centre.tsx";
  let source = read(file);
  const anchor = `</section>)}</div><div className="mt-5 rounded-2xl border border-amber-300/20`;
  const table = `</section>)}</div>{canonicalLocation === "/legal/scoring" && <section className="mt-5 overflow-hidden rounded-2xl border border-cyan-300/20 bg-white/[.035]"><div className="border-b border-white/10 p-5"><h2 className="text-xl font-black">Fantasy Arena scoring table</h2><p className="mt-1 text-sm text-white/50">The published football events and the points awarded to a player card.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-cyan-300/10 text-cyan-100"><tr><th className="px-4 py-3">Event</th><th className="px-4 py-3">GK</th><th className="px-4 py-3">DEF</th><th className="px-4 py-3">MID</th><th className="px-4 py-3">FWD</th></tr></thead><tbody className="divide-y divide-white/10 text-white/65">{[["Played under 60 minutes","1","1","1","1"],["Played 60+ minutes","2","2","2","2"],["Goal scored","6","6","5","4"],["Assist","3","3","3","3"],["Clean sheet","4","4","1","0"],["Every 3 saves","1","0","0","0"],["Penalty saved","5","0","0","0"],["Penalty missed","-2","-2","-2","-2"],["Yellow card","-1","-1","-1","-1"],["Red card","-3","-3","-3","-3"],["Own goal","-2","-2","-2","-2"],["Every 2 goals conceded","-1","-1","0","0"],["Bonus points","1–3","1–3","1–3","1–3"]].map((row)=><tr key={row[0]}>{row.map((cell,index)=><td key={index} className={\`px-4 py-3 \${index===0?"font-semibold text-white":""}\`}>{cell}</td>)}</tr>)}</tbody></table></div><div className="border-t border-white/10 p-4 text-xs leading-5 text-white/45">Captain bonus: the submitted captain contributes an additional 10% of that card's score to the lineup total. Live points remain provisional until official data is final.</div></section>}<div className="mt-5 rounded-2xl border border-amber-300/20`;
  source = replaceOnce(source, anchor, table, "scoring table");
  write(file, source);
}

console.log("Applied guided help, community chat v2, marketplace notices, scoring table and auction bid repairs.");
