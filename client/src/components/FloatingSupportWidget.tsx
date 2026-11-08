import {usePageVisible} from "../hooks/use-page-visible";
import {communityRequestPolicy,coalesceCommunityRefresh} from "../lib/community-request-policy";
import {notificationQueryOptions} from "../lib/notification-query";
import {CommunityReactions, CommunitySocialComposer} from "./CommunitySocial";
import {isTopPopup} from "../lib/popup-stack";
import {PopupPortal} from "./ui/popup-portal";
import "./chat-workspace.css";
import CommunityMentionComposer from "./CommunityMentionComposer";
import {communityMentionHandle} from "../../../shared/community-mentions";
import {takeCommunityIntent,clearCommunityIntent} from "../lib/community-intent";
import {useAuth} from '../hooks/use-auth';
import ArenaAssistantPanel from "./ArenaAssistantPanel";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  AtSign,
  Bot,
  HelpCircle,
  ShieldCheck,
  Mail,
  MessageCircle,
  Pencil,
  Reply,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { apiRequest, queryClient } from "../lib/queryClient";
import {
  mergeCommunityMessages,
  communityMessagesWithTarget,
  readCommunityMessageHistory,
  saveCommunityMessageHistory,
  type CommunityChatMessage as ChatMessage,
} from "../lib/community-chat";
import {
  communityMentionOpenEvent,
  openCommunityMention,
  type NotificationCache,
} from "../lib/notifications";
import { matchesSearch } from "../lib/search";


type WidgetMode = "community" | "help" | "admin-help";
type CurrentUser = {
  id?: string;
  managerTeamName?: string | null;
  name?: string | null;
  email?: string | null;
};
type AdminCheck = { isAdmin: boolean; userId?: string };
type MarketplaceListing = {
  id?: number;
  cardId?: number;
  price?: number;
  rarity?: string;
  player?: { name?: string };
  ownerName?: string;
  ownerUsername?: string;
};

// COMMUNITY_MENTION_NOTIFICATION_V1: retain the canonical SSE-backed chat widget during production builds.
const lastSeenStorageKey = "fantasy_arena_community_chat_last_seen_v2";
const seenListingsStorageKey = "fantasy_arena_seen_listing_ids_v2";


function formatMessageTime(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "now";
}

function mergeMessage(messages: ChatMessage[] | undefined, incoming: ChatMessage) {
  return mergeCommunityMessages(messages, [incoming]);
}

function mentionHandle(teamName:string){return communityMentionHandle(teamName); }

function errorMessage(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error || "");
  if (/COMMUNITY_LANGUAGE_BLOCKED|profanity|slurs/i.test(raw)) return "Please keep Community Live respectful. Profanity and slurs are blocked.";
  if (/429/.test(raw)) return "Please wait a moment before trying again.";
  return raw.replace(/^\d+:\s*/, "") || "The community action could not be completed.";
}

function MarketplaceListingActivity() {
  const [notice, setNotice] = useState<MarketplaceListing | null>(null);
  const { data = [] } = useQuery<MarketplaceListing[]>({
    queryKey: ["/api/marketplace"],
    queryFn: async () => {
      const response = await fetch("/api/marketplace", { credentials: "include" });
      if (!response.ok) return [];
      const payload = await response.json();
      return Array.isArray(payload) ? payload : payload.listings || payload.cards || [];
    },
    refetchInterval: () => document.visibilityState === "hidden" ? false : 60_000,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!data.length) return;
    let seen: number[] = [];
    try {
      seen = JSON.parse(window.localStorage.getItem(seenListingsStorageKey) || "[]");
    } catch {
      seen = [];
    }
    const ids = data.map((listing) => Number(listing.id ?? listing.cardId ?? 0)).filter(Boolean);
    if (!seen.length) {
      window.localStorage.setItem(seenListingsStorageKey, JSON.stringify(ids.slice(0, 250)));
      return;
    }
    const fresh = data.find((listing) => !seen.includes(Number(listing.id ?? listing.cardId ?? 0)));
    window.localStorage.setItem(
      seenListingsStorageKey,
      JSON.stringify(Array.from(new Set([...ids, ...seen])).slice(0, 250)),
    );
    if (!fresh) return;
    setNotice(fresh);
    const timer = window.setTimeout(() => setNotice(null), 6500);
    return () => window.clearTimeout(timer);
  }, [data]);

  if (!notice) return null;
  return (
    <div className="fixed bottom-24 right-4 z-[96] w-[min(355px,calc(100vw-2rem))] rounded-2xl border border-emerald-200/20 bg-slate-950/84 p-4 text-white shadow-2xl backdrop-blur-2xl sm:bottom-5">
      <button onClick={() => setNotice(null)} className="absolute right-2 top-2 p-1 text-white/45" aria-label="Close listing alert">
        <X className="h-4 w-4" />
      </button>
      <p className="text-[10px] font-black uppercase tracking-[.18em] text-emerald-300">New card listed</p>
      <p className="mt-1 font-bold">{notice.player?.name || "Player card"}</p>
      <p className="mt-1 text-xs text-white/55">
        {notice.ownerName || notice.ownerUsername || "Arena manager"} • N${Number(notice.price || 0).toFixed(2)}
      </p>
    </div>
  );
}

export default function FloatingSupportWidget() {
  const [open, setOpen] = useState(false);
  const pageVisible=usePageVisible();
  const panelRef=useRef<HTMLDivElement>(null);
  const [chatViewport,setChatViewport]=useState(()=>({height:window.visualViewport?.height||window.innerHeight,top:window.visualViewport?.offsetTop||0}));
  useEffect(()=>{
    if(!open)return;
    const viewport=window.visualViewport;let frame=0;
    const resize=()=>{if(frame)return;frame=requestAnimationFrame(()=>{
      frame=0;const height=viewport?.height||window.innerHeight,top=viewport?.offsetTop||0;
      setChatViewport(current=>current.height===height&&current.top===top?current:{height,top});
    });};
    resize();window.addEventListener('resize',resize);viewport?.addEventListener('resize',resize);viewport?.addEventListener('scroll',resize);
    return()=>{cancelAnimationFrame(frame);window.removeEventListener('resize',resize);viewport?.removeEventListener('resize',resize);viewport?.removeEventListener('scroll',resize);};
  },[open]);
  useEffect(()=>{if(!open)return;const previousFocus=document.activeElement as HTMLElement|null;const previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';const frame=requestAnimationFrame(()=>panelRef.current?.querySelector<HTMLButtonElement>('[aria-label="Close floating panel"]')?.focus());
    const keydown=(event:KeyboardEvent)=>{if(event.defaultPrevented||!isTopPopup(panelRef.current))return;if(event.key==='Escape'){event.preventDefault();setOpen(false);return;}if(event.key==='Tab'){const controls=[...panelRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),a[href],summary,[tabindex="0"]')||[]].filter(element=>element.getClientRects().length);const first=controls[0],last=controls[controls.length-1];if(event.shiftKey&&(document.activeElement===first||!panelRef.current?.contains(document.activeElement))){event.preventDefault();last?.focus();}else if(!event.shiftKey&&(document.activeElement===last||!panelRef.current?.contains(document.activeElement))){event.preventDefault();first?.focus();}}};
    document.addEventListener('keydown',keydown);return()=>{cancelAnimationFrame(frame);document.removeEventListener('keydown',keydown);document.body.style.overflow=previousOverflow;if(previousFocus?.isConnected)previousFocus.focus();};
  },[open]);
  const [mode, setMode] = useState<WidgetMode>("community");
  const [chatInput, setChatInput] = useState("");
  const [chatSearch, setChatSearch] = useState("");
  const [chatError, setChatError] = useState("");
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");
  const [lastSeenId, setLastSeenId] = useState(() => Number(window.localStorage.getItem(lastSeenStorageKey) || 0) || 0);
  const [targetMessage,setTargetMessage]=useState<ChatMessage|null>(null);
  const targetMessageRef=useRef(targetMessage);
  targetMessageRef.current=targetMessage;
  const [highlightedMessageId, setHighlightedMessageId] = useState<number | null>(null);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [streamConnected, setStreamConnected] = useState(false);
  const communityRequests=communityRequestPolicy(open,mode,pageVisible,streamConnected);
  const [followingLatest, setFollowingLatest] = useState(true);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const preserveScrollHeightRef = useRef<number | null>(null);

  const {user:sessionUser}=useAuth();
  const currentUserId=String(sessionUser?.id||'');
  const {data:ownProfile}=useQuery<CurrentUser>({queryKey:['support-profile',currentUserId],enabled:Boolean(currentUserId)&&open&&pageVisible,queryFn:async()=>{const response=await fetch('/api/user',{credentials:'include',cache:'no-store'});if(!response.ok)return {id:currentUserId};const data=await response.json();return data.id===currentUserId?data:{id:currentUserId};}});
  const user:CurrentUser|undefined=sessionUser?{...sessionUser,...ownProfile,id:currentUserId}:undefined;
  const chatQueryKey = useMemo(
    () => ["/community-live/messages", currentUserId || "anonymous"] as const,
    [currentUserId],
  );
  const { data: accessCheck, isError: accessError } = useQuery<AdminCheck>({
    queryKey: ["/api/assistant/access",currentUserId],enabled:Boolean(currentUserId)&&open&&pageVisible,retry:false,staleTime:30_000,refetchOnWindowFocus:true,refetchInterval:open&&pageVisible?60_000:false,
    queryFn:async()=>{try{const response=await fetch('/api/assistant/access',{credentials:'include',cache:'no-store'});if(!response.ok)return {isAdmin:false};const data=await response.json();return {userId:data.userId,isAdmin:data.userId===currentUserId&&data.isAdmin===true};}catch{return {isAdmin:false};}},
  });
  const adminCheck={isAdmin:Boolean(!accessError&&currentUserId&&accessCheck?.userId===currentUserId&&accessCheck?.isAdmin===true)};
  const adminChat=mode==='admin-help'&&adminCheck?.isAdmin===true;
  useEffect(()=>{setOpen(false);setMode('community');setTargetMessage(null);},[currentUserId]);
  useEffect(()=>{if(mode==='admin-help'&&!adminCheck?.isAdmin)setMode('help');},[adminCheck?.isAdmin,mode]);
  const { data: notificationInbox } = useQuery<NotificationCache>(notificationQueryOptions(currentUserId));
  const {
    data: storedMessages = [],
    isLoading,
    isError: chatLoadFailed,
    refetch: refreshMessages,
  } = useQuery<ChatMessage[]>({
    queryKey: chatQueryKey,
    queryFn: async () => {
      const response = await fetch("/community-live/messages?limit=80", {
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Failed to load Community Live");
      const payload = await response.json();
      const incoming = Array.isArray(payload) ? payload : payload.messages || [];
      if (!Array.isArray(incoming)) throw new Error("Community Live returned an invalid conversation.");
      setHasOlderMessages(Boolean(payload?.hasMore));
      const current = queryClient.getQueryData<ChatMessage[]>(chatQueryKey);
      const merged = mergeCommunityMessages(current, incoming);
      return merged;
    },
    enabled: Boolean(currentUserId)&&pageVisible,
    staleTime: 15_000,
    refetchInterval: communityRequests.pollMs,
    refetchOnWindowFocus: true,
    retry: 2,
  });

  const messages=useMemo(()=>communityMessagesWithTarget(storedMessages,targetMessage),[storedMessages,targetMessage]);
  useEffect(()=>{if(!targetMessage)return;const remaining=Date.parse(targetMessage.createdAt)+86400000-Date.now();const timer=window.setTimeout(()=>{setTargetMessage(null);queryClient.setQueryData<ChatMessage[]>(chatQueryKey,current=>mergeCommunityMessages(current));setChatError('This message has expired. Community messages are kept for 24 hours.');},Math.max(0,remaining));return()=>window.clearTimeout(timer);},[targetMessage?.id,targetMessage?.createdAt]);

  useEffect(()=>{
    if(!currentUserId)return;
    const timer=window.setInterval(()=>{
      queryClient.setQueryData<ChatMessage[]>(chatQueryKey,current=>{
        return mergeCommunityMessages(current);
      });
    },30000);
    return ()=>window.clearInterval(timer);
  },[currentUserId,chatQueryKey]);

  useEffect(() => {
    if (!currentUserId) return;
    const saved = readCommunityMessageHistory(currentUserId);
    if (saved.length) {
      queryClient.setQueryData<ChatMessage[]>(chatQueryKey, (current) =>
        mergeCommunityMessages(saved, current));
    }
    const userSeenId = Number(window.localStorage.getItem(
      `${lastSeenStorageKey}:${currentUserId}`,
    ) || 0) || 0;
    setLastSeenId(userSeenId);
  }, [chatQueryKey, currentUserId]);

  useEffect(() => {
    if(!currentUserId||!messages.length)return;
    const timer=window.setTimeout(()=>saveCommunityMessageHistory(currentUserId,messages),250);
    return ()=>window.clearTimeout(timer);
  }, [currentUserId, messages]);

  useEffect(() => {
    if (!currentUserId || !communityRequests.stream || typeof EventSource === "undefined") return;
    const stream = new EventSource("/community-live/stream");
    let ready=false;
    const onReady = () => {
      if(ready)return;ready=true;
      setStreamConnected(true);
      void queryClient.invalidateQueries({ queryKey: chatQueryKey });
    };
    const onError = () => {ready=false;setStreamConnected(false);};
    const onMessage = (event: Event) => {
      try {
        const raw = JSON.parse((event as MessageEvent).data) as ChatMessage;
        const incoming = {
          ...raw,
          isOwn: Boolean(user?.id && raw.userId === user.id),
          canEdit: Boolean(user?.id && raw.userId === user.id && !raw.deletedAt),
          canDelete: Boolean((adminCheck?.isAdmin || (user?.id && raw.userId === user.id)) && !raw.deletedAt),
        };
        setTargetMessage(current=>current?.id===incoming.id?incoming:current);
        queryClient.setQueryData<ChatMessage[]>(chatQueryKey, (current) => {
          const merged = mergeMessage(current, incoming);
          return merged;
        });
        const currentHandle = mentionHandle(
          user?.managerTeamName || user?.name || user?.email?.split("@")[0] || "",
        ).toLocaleLowerCase("en");
        if (incoming.userId !== user?.id && incoming.mentions?.some(
          (handle) => String(handle).toLocaleLowerCase("en") === currentHandle,
        )) {
          void queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
        }
      } catch { /* ignore malformed stream events */ }
    };
    const refreshBurst=coalesceCommunityRefresh(()=>{
      void queryClient.invalidateQueries({queryKey:chatQueryKey},{cancelRefetch:false});
      const pinned=targetMessageRef.current;
      if(pinned)void fetch(`/community-live/messages/${pinned.id}`,{credentials:'include',cache:'no-store'}).then(async response=>{
        if(response.ok){const payload=await response.json();setTargetMessage(latest=>latest?.id===payload.message?.id?payload.message:latest);}
      }).catch(()=>{});
    });
    const onReaction=()=>refreshBurst.schedule();
    stream.addEventListener("open", onReady);
    stream.addEventListener("ready", onReady);
    stream.addEventListener("error", onError);
    stream.addEventListener("community-message", onMessage);
    stream.addEventListener("community-reaction", onReaction);
    return () => {
      stream.removeEventListener("open", onReady);
      stream.removeEventListener("ready", onReady);
      stream.removeEventListener("error", onError);
      stream.removeEventListener("community-message", onMessage);
      stream.removeEventListener("community-reaction", onReaction);
      refreshBurst.cancel();
      stream.close();
      setStreamConnected(false);
    };
  }, [communityRequests.stream, adminCheck?.isAdmin, chatQueryKey, currentUserId, user?.email, user?.managerTeamName, user?.name]);

  const latestId = messages[messages.length - 1]?.id || 0;
  const unreadCount = useMemo(
    () => messages.filter((message) => message.id > lastSeenId && message.userId !== user?.id).length,
    [lastSeenId, messages, user?.id],
  );
  const unreadMentions = useMemo(
    () => (Array.isArray(notificationInbox?.notifications) ? notificationInbox.notifications : [])
      .filter((notification) => !notification.read
        && notification.notificationKind === "community_mention"
        && Number(notification.communityMessageId || 0) > 0),
    [notificationInbox?.notifications],
  );
  const latestMention = unreadMentions[0];
  const visibleMessages = useMemo(
    () => messages.filter((message) => matchesSearch(
      chatSearch,
      message.message,
      message.teamName,
      message.mentions,
      message.replyTo?.message,
      message.replyTo?.teamName,
    )),
    [chatSearch, messages],
  );

  useEffect(() => {
    const openMention = async (event: Event) => {
      const messageId = Number((event as CustomEvent<{ messageId?: number }>).detail?.messageId || 0);
      if (!Number.isInteger(messageId) || messageId <= 0) return;

      clearCommunityIntent();
      setTargetMessage(null);
      setFollowingLatest(false);
      setMode("community");
      setChatSearch("");
      setHighlightedMessageId(messageId);
      setOpen(true);

      const existing = queryClient.getQueryData<ChatMessage[]>(chatQueryKey);
      if (Array.isArray(existing)){const cached=existing.find(message=>message.id===messageId&&Date.parse(message.createdAt)>Date.now()-86400000);if(cached){setTargetMessage(cached);return;}}

      try {
        const response = await fetch(`/community-live/messages/${messageId}`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!response.ok) throw new Error("This message has expired or was removed. Community messages are kept for 24 hours.");
        const payload = await response.json();
        if (payload?.message) {
          setTargetMessage(payload.message);
          queryClient.setQueryData<ChatMessage[]>(chatQueryKey, (current) => {
            const merged = mergeMessage(current, payload.message);
              return merged;
          });
        }
      } catch (error) {
        setChatError(error instanceof Error ? error.message : "Unable to load your mention.");
      }
    };

    window.addEventListener(communityMentionOpenEvent, openMention);
    return () => window.removeEventListener(communityMentionOpenEvent, openMention);
  }, [chatQueryKey, currentUserId]);

  useEffect(()=>{
    if(!currentUserId)return;
    const consume=async()=>{const intent=takeCommunityIntent();if(!intent)return;setMode('community');setOpen(true);setChatSearch('');
      if(intent.messageId){void openCommunityMention({communityMessageId:intent.messageId,id:intent.notificationId||undefined});return;}
      if(intent.notificationId){try{const response=await fetch('/api/notifications',{credentials:'include',cache:'no-store'});if(!response.ok)throw new Error();const payload=await response.json();const notification=payload.notifications?.find((n:any)=>Number(n.id)===intent.notificationId);if(notification?.communityMessageId){void openCommunityMention(notification);return;}setChatError('This mention has expired or is no longer available.');}catch{setChatError('Unable to load the mentioned message. Your Community tab is open.');}}
    };
    void consume();window.addEventListener('popstate',consume);window.addEventListener('pushState',consume);return()=>{window.removeEventListener('popstate',consume);window.removeEventListener('pushState',consume);};
  },[currentUserId]);

  useEffect(() => {
    if (!open || mode !== "community" || latestId <= 0 || !followingLatest || !currentUserId) return;
    setLastSeenId(latestId);
    window.localStorage.setItem(`${lastSeenStorageKey}:${currentUserId}`, String(latestId));
  }, [currentUserId, followingLatest, latestId, mode, open]);

  useEffect(() => {
    if (!open || mode !== "community") return;
    const timer = window.setTimeout(() => {
      if (preserveScrollHeightRef.current !== null && scrollRef.current) {
        const previousHeight = preserveScrollHeightRef.current;
        preserveScrollHeightRef.current = null;
        scrollRef.current.scrollTop = Math.max(0, scrollRef.current.scrollHeight - previousHeight);
        return;
      }
      if (highlightedMessageId) {
        const target = scrollRef.current?.querySelector<HTMLElement>(
          `[data-community-message-id="${highlightedMessageId}"]`,
        );
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "center" });
          return;
        }
      }
      if (followingLatest) {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
      }
    }, 80);
    return () => window.clearTimeout(timer);
  }, [followingLatest, highlightedMessageId, messages, mode, open]);

  useEffect(() => {
    if (!highlightedMessageId) return;
    const timer = window.setTimeout(() => setHighlightedMessageId(null), 8000);
    return () => window.clearTimeout(timer);
  }, [highlightedMessageId]);

  const sendMutation = useMutation({
    mutationFn: async ({ message, replyToId }: { message: string; replyToId?: number | null }) =>
      (await apiRequest("POST", "/community-live/messages", { message, replyToId })).json(),
    onSuccess: (payload: any) => {
      const message = payload.message as ChatMessage;
      queryClient.setQueryData<ChatMessage[]>(chatQueryKey, (current) => {
        const merged = mergeMessage(current, { ...message, isOwn: true, canEdit: true, canDelete: true });
        return merged;
      });
      setFollowingLatest(true);
      setChatInput(""); setReplyingTo(null); setChatError("");
    },
    onError: (error) => setChatError(errorMessage(error)),
  });

  const reactionMutation=useMutation({
    mutationFn:async({id,emoji,active}:{id:number;emoji:string;active:boolean})=>(await apiRequest('PUT',`/community-live/messages/${id}/reactions`,{emoji,active})).json(),
    onSuccess:(payload:any)=>{
      if(payload.message){
        queryClient.setQueryData<ChatMessage[]>(chatQueryKey,current=>mergeMessage(current,payload.message));
        setTargetMessage(current=>current?.id===payload.message.id?payload.message:current);
      }
      setChatError('');
    },
    onError:(error)=>setChatError(errorMessage(error)),
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, message }: { id: number; message: string }) =>
      (await apiRequest("PATCH", `/community-live/messages/${id}`, { message })).json(),
    onSuccess: (payload: any) => {
      queryClient.setQueryData<ChatMessage[]>(chatQueryKey, (current) => {
        const merged = mergeMessage(current, { ...payload.message, isOwn: true, canEdit: true, canDelete: true });
        return merged;
      });
      setEditingId(null); setEditingText(""); setChatError("");
    },
    onError: (error) => setChatError(errorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: async (message: ChatMessage) => {
      const path = adminCheck?.isAdmin && message.userId !== user?.id
        ? `/community-live/admin/messages/${message.id}`
        : `/community-live/messages/${message.id}`;
      return (await apiRequest("DELETE", path, {})).json();
    },
    onSuccess: (payload: any) => {
      queryClient.setQueryData<ChatMessage[]>(chatQueryKey, (current) => {
        const merged = mergeMessage(current, payload.message);
        return merged;
      });
      setChatError("");
    },
    onError: (error) => setChatError(errorMessage(error)),
  });

  const submitChat = () => {
    const message = chatInput.trim();
    if (!message || sendMutation.isPending) return;
    setChatError("");
    sendMutation.mutate({ message, replyToId: replyingTo?.id || null });
  };

  const loadOlderMessages = async () => {
    const oldestId = Number(messages[0]?.id || 0);
    if (!oldestId || loadingOlderMessages) return;
    setLoadingOlderMessages(true);
    preserveScrollHeightRef.current = scrollRef.current?.scrollHeight || null;
    try {
      const response = await fetch(`/community-live/messages?before=${oldestId}&limit=50`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Unable to load older messages.");
      const payload = await response.json();
      const older = Array.isArray(payload?.messages) ? payload.messages : [];
      setHasOlderMessages(Boolean(payload?.hasMore));
      queryClient.setQueryData<ChatMessage[]>(chatQueryKey, (current) => {
        const merged = mergeCommunityMessages(older, current);
        return merged;
      });
    } catch (error) {
      preserveScrollHeightRef.current = null;
      setChatError(error instanceof Error ? error.message : "Unable to load older messages.");
    } finally {
      setLoadingOlderMessages(false);
    }
  };

  const handleChatScroll = () => {
    const container = scrollRef.current;
    if (!container) return;
    const remaining = container.scrollHeight - container.scrollTop - container.clientHeight;
    setFollowingLatest(remaining < 80);
  };

  const addMention = (message: ChatMessage) => {
    const token = `@${mentionHandle(message.teamName)} `;
    setChatInput((current) => current.includes(token.trim()) ? current : `${current}${current && !current.endsWith(" ") ? " " : ""}${token}`.slice(0, 280));
    setMode("community"); setOpen(true);
  };



  return (
    <>
      <MarketplaceListingActivity />
      {open ? <PopupPortal>{<div className="arena-chat-overlay" style={{height:chatViewport.height,top:chatViewport.top}} onMouseDown={event=>{if(event.target===event.currentTarget)setOpen(false);}}>
        <Card ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="arena-chat-title" className={`arena-chat-panel ${mode==='community'?'arena-chat-panel--community':''} flex min-h-0 flex-col overflow-hidden border-white/15 bg-slate-950 text-white shadow-2xl`}>
          <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-white/[.035] px-3 py-2">
            <div className="min-w-0"><div className="flex items-center gap-2"><span className="relative flex h-2.5 w-2.5"><span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-55 ${streamConnected ? "bg-emerald-300" : "bg-amber-300"}`} /><span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${streamConnected ? "bg-emerald-400" : "bg-amber-400"}`} /></span><p id="arena-chat-title" className="truncate text-sm font-black">{mode === "community" ? "Community Live" : adminChat ? "Admin Assistant" : "Member Help"}</p>{adminCheck?.isAdmin && mode === "community" ? <span className="rounded-full bg-violet-300/15 px-2 py-0.5 text-[9px] font-black text-violet-200">ADMIN</span> : null}</div><p className="mt-0.5 truncate text-[11px] text-white/45">{mode === "community" ? streamConnected ? "Live · messages expire after 24 hours" : "Reconnecting · 24-hour history" : adminChat ? "Private administrator investigations" : "Private support for your own account"}</p></div>
            <Button size="icon" variant="ghost" className="h-11 w-11 shrink-0 text-white/65 hover:bg-white/10 hover:text-white" onClick={() => setOpen(false)} aria-label="Close floating panel"><X className="h-4 w-4" /></Button>
          </div>

          <div className={`grid ${adminCheck?.isAdmin?"grid-cols-3":"grid-cols-2"} shrink-0 border-b border-white/10 bg-black/20 p-1.5`}>
            <button onClick={() => setMode("community")} className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-black transition ${mode === "community" ? "bg-cyan-300/15 text-cyan-200" : "text-white/45 hover:bg-white/5"}`}><Users className="h-3.5 w-3.5" />Community</button>
            <button onClick={() => setMode("help")} className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-black transition ${mode === "help" ? "bg-violet-300/15 text-violet-200" : "text-white/45 hover:bg-white/5"}`}><HelpCircle className="h-3.5 w-3.5" />Member Help</button>
            {adminCheck?.isAdmin?<button onClick={()=>setMode("admin-help")} className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-black ${adminChat?"bg-violet-300/15 text-violet-200":"text-white/45"}`}><ShieldCheck className="h-3.5 w-3.5"/>Admin Assistant</button>:null}
          </div>

          {mode === "community" ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="shrink-0 border-b border-white/10 bg-black/15 px-3 py-2">
                <div className="relative"><Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-cyan-200/65" /><Input value={chatSearch} onChange={(event) => setChatSearch(event.target.value)} placeholder="Search messages, managers or @mentions" aria-label="Search Community Live messages" className="h-9 rounded-xl border-white/10 bg-white/[.045] pl-8 pr-9 text-xs text-white placeholder:text-white/40" />{chatSearch ? <button type="button" onClick={() => setChatSearch("")} aria-label="Clear chat search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-white/60 hover:bg-white/10 hover:text-white"><X className="h-3.5 w-3.5" /></button> : null}</div>
                {chatSearch.trim() ? <p className="mt-1 text-[10px] font-semibold text-white/55">{visibleMessages.length} matching message{visibleMessages.length === 1 ? "" : "s"}</p> : null}
              </div>
              <div ref={scrollRef} onScroll={handleChatScroll} className="arena-chat-messages min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-3 py-3">
                {isLoading ? <p className="py-10 text-center text-sm text-white/40">Connecting to the community…</p> : null}
                {chatLoadFailed ? <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-100"><span>{messages.length ? "Showing saved messages while the connection recovers." : "Could not load Community Live."}</span><button type="button" onClick={() => { void refreshMessages(); }} className="inline-flex shrink-0 items-center gap-1 font-black"><RefreshCw className="h-3.5 w-3.5" />Retry</button></div> : null}
                {hasOlderMessages && messages.length ? <button type="button" onClick={() => { void loadOlderMessages(); }} disabled={loadingOlderMessages} className="mx-auto flex items-center gap-2 rounded-full border border-white/10 bg-white/[.045] px-3 py-1.5 text-[11px] font-bold text-white/65 hover:bg-white/10 disabled:opacity-55"><RefreshCw className={`h-3.5 w-3.5 ${loadingOlderMessages ? "animate-spin" : ""}`} />{loadingOlderMessages ? "Loading earlier messages…" : "Load earlier messages"}</button> : null}
                {!isLoading && !messages.length ? <div className="py-10 text-center"><MessageCircle className="mx-auto h-8 w-8 text-cyan-200/45" /><p className="mt-2 text-sm font-semibold text-white/70">Start the conversation</p></div> : null}
                {!isLoading && messages.length > 0 && !visibleMessages.length ? <p className="py-10 text-center text-sm text-white/60">No messages match your search.</p> : null}
                {visibleMessages.map((message) => {
                  const own = Boolean(message.isOwn || message.userId === user?.id);
                  const canEdit = Boolean(!message.deletedAt && own);
                  const canDelete = Boolean(!message.deletedAt && (own || adminCheck?.isAdmin));
                  const editing = editingId === message.id;
                  return (
                    <div key={message.id} data-community-message-id={message.id} className={`group flex ${own ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[90%] rounded-2xl border px-3 py-2 ${highlightedMessageId === message.id ? "border-amber-200/80 bg-amber-300/15 ring-2 ring-amber-200/55" : own ? "border-cyan-200/20 bg-cyan-300/12" : "border-white/10 bg-white/[.055]"} ${message.deletedAt ? "opacity-55" : ""}`}>
                        {message.replyTo ? <button type="button" onClick={() => { void openCommunityMention({ communityMessageId: message.replyTo?.id }); }} className="mb-2 block w-full rounded-xl border-l-2 border-cyan-300/45 bg-black/25 px-2 py-1.5 text-left text-[10px] text-white/48 hover:bg-black/40"><span className="font-black text-cyan-200/70">{message.replyTo.teamName}</span><p className="mt-0.5 line-clamp-2">{message.replyTo.message}</p></button> : null}
                        <div className="mb-1 flex items-center gap-2 text-[10px]"><button type="button" onClick={() => addMention(message)} disabled={own || Boolean(message.deletedAt)} className={`max-w-[180px] truncate font-black ${own ? "text-cyan-200" : "text-white/65 hover:text-cyan-200"}`}>{own ? "You" : message.teamName || "Arena Manager"}</button><span className="text-white/30">{formatMessageTime(message.createdAt)}</span>{message.editedAt ? <span className="text-white/25">edited</span> : null}</div>
                        {editing ? <div className="space-y-2"><CommunityMentionComposer value={editingText} onChange={setEditingText} onError={setChatError} sendOnEnter={false} rows={3} placeholder="Edit your community message…" /><div className="flex justify-end gap-2"><button onClick={() => { setEditingId(null); setEditingText(""); }} className="text-[10px] font-bold text-white/45">Cancel</button><button onClick={() => editMutation.mutate({ id: message.id, message: editingText.trim() })} disabled={!editingText.trim() || editMutation.isPending} className="rounded-lg bg-cyan-300 px-2 py-1 text-[10px] font-black text-slate-950">Save</button></div></div> : <p className={`whitespace-pre-wrap break-words text-sm leading-5 ${message.deletedAt ? "italic text-white/45" : "text-white/90"}`}>{message.message}</p>}
                        {!message.deletedAt && !editing ? <CommunityReactions reactions={message.reactions} disabled={reactionMutation.isPending} onChange={(emoji,active)=>reactionMutation.mutate({id:message.id,emoji,active})} /> : null}
                        {!message.deletedAt && !editing ? <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-white/10 pt-2 text-[10px] font-black tracking-[.04em]"><button type="button" onClick={() => { setReplyingTo(message); setChatError(""); }} className="inline-flex min-h-8 touch-manipulation items-center gap-1 rounded-lg bg-white/[.07] px-2 text-white/75 hover:bg-cyan-300/15 hover:text-cyan-200"><Reply className="h-3.5 w-3.5" />Reply</button>{!own ? <button type="button" onClick={() => addMention(message)} className="inline-flex min-h-8 touch-manipulation items-center gap-1 rounded-lg bg-cyan-300/10 px-2 text-cyan-100 hover:bg-cyan-300/20"><AtSign className="h-3.5 w-3.5" />Mention</button> : null}{canEdit ? <button type="button" onClick={() => { setEditingId(message.id); setEditingText(message.message); }} className="inline-flex min-h-8 touch-manipulation items-center gap-1 rounded-lg bg-white/[.07] px-2 text-white/75 hover:text-amber-200"><Pencil className="h-3.5 w-3.5" />Edit</button> : null}{canDelete ? <button type="button" onClick={() => window.confirm(adminCheck?.isAdmin && !own ? "Delete this community message as administrator?" : "Delete your message?") && deleteMutation.mutate(message)} className="inline-flex min-h-8 touch-manipulation items-center gap-1 rounded-lg bg-white/[.07] px-2 text-white/75 hover:text-rose-200"><Trash2 className="h-3.5 w-3.5" />{adminCheck?.isAdmin && !own ? "Admin delete" : "Delete"}</button> : null}</div> : null}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="shrink-0 border-t border-white/10 bg-black/25 p-2.5">
                {!followingLatest && unreadCount ? <button type="button" onClick={() => { setFollowingLatest(true); scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }} className="mb-2 flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-300/10 px-3 py-1.5 text-xs font-bold text-cyan-100">{unreadCount} new message{unreadCount === 1 ? "" : "s"} · Jump to latest</button> : null}
                {replyingTo ? <div className="mb-2 flex items-start justify-between gap-2 rounded-xl border border-cyan-200/15 bg-cyan-300/[.06] px-3 py-2"><div className="min-w-0 text-[10px] text-white/48"><span className="font-black text-cyan-200">Replying to {replyingTo.teamName}</span><p className="mt-0.5 truncate">{replyingTo.message}</p></div><button onClick={() => setReplyingTo(null)} className="text-white/35 hover:text-white"><X className="h-3.5 w-3.5" /></button></div> : null}
                <CommunitySocialComposer onEmoji={emoji=>{if(chatInput.length+emoji.length<=280){setChatInput(text=>text+emoji);setChatError('');}else setChatError('Message must be 280 characters or fewer');}} />
                <div className="flex items-end gap-2"><CommunityMentionComposer value={chatInput} onChange={text=>{setChatInput(text);setChatError('');}} onError={setChatError} onSubmit={submitChat} placeholder={replyingTo?`Reply to ${replyingTo.teamName}…`:'Message the community… type @ or a team name to tag'} /><Button size="icon" className="h-10 w-10 shrink-0 rounded-xl bg-cyan-300 text-slate-950 hover:bg-cyan-200" onClick={submitChat} disabled={!chatInput.trim() || sendMutation.isPending} aria-label="Send community message"><Send className="h-4 w-4" /></Button></div>
                <div className="mt-1 flex items-center justify-between gap-2 px-1"><p className="truncate text-[10px] text-rose-200">{chatError || "Profanity and slurs are automatically blocked."}</p><p className="shrink-0 text-[10px] text-white/25">{chatInput.length}/280</p></div>
              </div>
            </div>
          ) : (
            <ArenaAssistantPanel key={`${currentUserId}:${adminChat?'admin':'member'}`} userId={currentUserId} admin={adminChat}/>
          )}
        </Card>
        </div>}</PopupPortal> : null}

      {!open?<div className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] right-3 z-[90] sm:bottom-4 sm:right-4" data-chat-launchers>
      <div className="flex justify-end gap-2"><Button size="icon" aria-label="Open Arena help" className="h-10 w-10 rounded-full border border-violet-200/20 bg-violet-500/75 shadow-xl backdrop-blur-xl hover:bg-violet-400 sm:h-11 sm:w-11" onClick={() => { setMode("help"); setOpen(true); }}><HelpCircle className="h-4 w-4" /></Button><Button size="icon" aria-label="Open Community Live" className="relative h-11 w-11 rounded-full border border-cyan-200/25 bg-cyan-400/80 text-slate-950 shadow-xl backdrop-blur-xl hover:bg-cyan-300 sm:h-12 sm:w-12" onClick={() => { if (latestMention && !open) { void openCommunityMention(latestMention); return; } setMode("community"); setOpen((value) => mode === "community" ? !value : true); }}>{open && mode === "community" ? <Bot className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}{(unreadMentions.length || unreadCount) && !(open && mode === "community") ? <span className={`absolute -right-1 -top-1 min-w-5 rounded-full px-1 text-[10px] font-black leading-5 text-white ${unreadMentions.length ? "bg-amber-500" : "bg-rose-500"}`}>{Math.min(99, unreadMentions.length || unreadCount)}</span> : null}</Button></div>
      </div>:null}
    </>
  );
}


