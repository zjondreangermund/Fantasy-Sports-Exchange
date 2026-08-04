import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Gauge,
  Lock,
  Power,
  RefreshCw,
  Save,
  Server,
  Shield,
  Users,
  XCircle,
} from "lucide-react";
import { apiRequest, queryClient } from "../../lib/queryClient";
import { setClientSecurityStatus } from "../../lib/security-mode";
import { useToast } from "../../hooks/use-toast";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Skeleton } from "../ui/skeleton";
import { Switch } from "../ui/switch";

type SecuritySettings = {
  emergency: {
    readOnly: boolean;
    authPaused: boolean;
    depositsPaused: boolean;
    withdrawalsPaused: boolean;
    marketplacePaused: boolean;
    auctionsPaused: boolean;
    message: string;
  };
  rateLimits: {
    apiPerMinute: number;
    authPer15Minutes: number;
    financialPerMinute: number;
    auctionPerMinute: number;
    adminPerMinute: number;
  };
  detection: {
    authAttemptsPer15Minutes: number;
    bidAttemptsPerMinute: number;
    financialActionsPerMinute: number;
    blockMinutes: number;
  };
  posture: {
    adminMfaRequired: boolean;
    cloudflareEnabled: boolean;
    githubSecurityEnabled: boolean;
    backupsVerified: boolean;
    penetrationTestDate: string;
    incidentContact: string;
  };
};

type EmergencyBooleanKey = Exclude<keyof SecuritySettings["emergency"], "message">;

type SecurityEvent = {
  id: number;
  userId?: string | null;
  ip?: string | null;
  category: string;
  action: string;
  route?: string | null;
  severity: string;
  details?: Record<string, unknown>;
  resolved?: boolean;
  createdAt?: string | null;
};

type SecurityResponse = {
  settings: SecuritySettings;
  updatedAt?: string | null;
  updatedBy?: string | null;
  overview?: {
    summary?: {
      eventsLastHour?: number;
      eventsLast24Hours?: number;
      blockedLast24Hours?: number;
      openEvents?: number;
      criticalOpenEvents?: number;
    };
    recentEvents?: SecurityEvent[];
  };
  runtime?: Record<string, string | number | boolean | null | undefined>;
};

const ADMIN_SECURITY_KEY = ["/api/admin/security"] as const;
const PUBLIC_SECURITY_KEY = ["/api/security/status"] as const;

function cloneSettings(settings: SecuritySettings): SecuritySettings {
  return typeof structuredClone === "function"
    ? structuredClone(settings)
    : JSON.parse(JSON.stringify(settings));
}

function numberValue(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateLabel(value?: string | null) {
  if (!value) return "Never";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : String(value);
}

function SwitchRow({
  title,
  description,
  checked,
  onCheckedChange,
  disabled = false,
  danger = false,
}: {
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between gap-4 rounded-2xl border p-4 ${checked && danger ? "border-red-400/30 bg-red-500/10" : "border-white/10 bg-black/25"}`}>
      <div className="min-w-0">
        <p className="font-black text-white">{title}</p>
        <p className="mt-1 text-xs text-slate-400">{description}</p>
      </div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function NumberField({ label, value, helper, onChange }: { label: string; value: number; helper: string; onChange: (value: number) => void }) {
  return (
    <div className="space-y-2 rounded-2xl border border-white/10 bg-black/25 p-4">
      <Label className="font-black text-white">{label}</Label>
      <Input type="number" min={1} value={value} onChange={(event) => onChange(numberValue(event.target.value))} className="border-white/10 bg-black/40 text-white" />
      <p className="text-xs text-slate-500">{helper}</p>
    </div>
  );
}

function RuntimeCheck({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/25 p-3">
      <div><p className="text-sm font-bold text-white">{label}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div>
      {ok ? <CheckCircle2 className="h-5 w-5 text-emerald-300" /> : <XCircle className="h-5 w-5 text-amber-300" />}
    </div>
  );
}

function Metric({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return <div className={`rounded-2xl border p-3 ${danger ? "border-red-300/20 bg-red-400/10 text-red-100" : "border-cyan-300/20 bg-cyan-400/10 text-cyan-100"}`}><p className="text-2xl font-black">{numberValue(value)}</p><p className="mt-1 text-[10px] font-black uppercase tracking-[.15em] opacity-70">{label}</p></div>;
}

export default function AdminSecurityPanel() {
  const { toast } = useToast();
  const securityQuery = useQuery<SecurityResponse>({
    queryKey: ADMIN_SECURITY_KEY,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
  const [draft, setDraft] = useState<SecuritySettings | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!securityQuery.data?.settings || dirty) return;
    setDraft(cloneSettings(securityQuery.data.settings));
  }, [securityQuery.data?.settings, securityQuery.data?.updatedAt, dirty]);

  const applyServerResult = (result: SecurityResponse, fallback: SecuritySettings, preserveUnsavedSections = false) => {
    const settings = result?.settings || fallback;
    queryClient.setQueryData<SecurityResponse>(ADMIN_SECURITY_KEY, (current) => ({ ...(current || {} as SecurityResponse), ...result, settings }));
    setDraft((current) => preserveUnsavedSections && current ? { ...current, emergency: cloneSettings(settings).emergency } : cloneSettings(settings));
    setClientSecurityStatus(settings.emergency);
    return settings;
  };

  const saveMutation = useMutation({
    mutationFn: async (settings: SecuritySettings) => {
      const response = await apiRequest("PATCH", "/api/admin/security", { settings });
      return response.json() as Promise<SecurityResponse>;
    },
    onSuccess: async (result, settings) => {
      applyServerResult(result, settings);
      setDirty(false);
      await queryClient.invalidateQueries({ queryKey: PUBLIC_SECURITY_KEY });
      toast({ title: "Security settings saved", description: "The controls are active across Fantasy Arena." });
    },
    onError: (error: any) => {
      toast({ title: "Security settings not saved", description: error?.message || "Unable to update the controls", variant: "destructive" });
    },
  });

  const emergencyMutation = useMutation({
    mutationFn: async ({ settings }: { settings: SecuritySettings; key: EmergencyBooleanKey; value: boolean }) => {
      const response = await apiRequest("PATCH", "/api/admin/security", { settings });
      return response.json() as Promise<SecurityResponse>;
    },
    onMutate: async ({ settings }) => {
      await queryClient.cancelQueries({ queryKey: ADMIN_SECURITY_KEY });
      const previous = queryClient.getQueryData<SecurityResponse>(ADMIN_SECURITY_KEY);
      queryClient.setQueryData<SecurityResponse>(ADMIN_SECURITY_KEY, (current) => ({ ...(current || {} as SecurityResponse), settings }));
      setDraft((current) => current ? { ...current, emergency: cloneSettings(settings).emergency } : cloneSettings(settings));
      setClientSecurityStatus(settings.emergency);
      return { previous };
    },
    onSuccess: async (result, variables) => {
      applyServerResult(result, variables.settings, true);
      await queryClient.invalidateQueries({ queryKey: PUBLIC_SECURITY_KEY });
      const label = variables.key === "readOnly" ? "Read-only mode" : "Emergency control";
      toast({ title: `${label} ${variables.value ? "enabled" : "disabled"}`, description: "The change was saved immediately and will remain active when you change tabs." });
    },
    onError: async (error: any, _variables, context) => {
      const previous = context?.previous;
      if (previous?.settings) {
        queryClient.setQueryData(ADMIN_SECURITY_KEY, previous);
        setDraft((current) => current ? { ...current, emergency: cloneSettings(previous.settings).emergency } : cloneSettings(previous.settings));
        setClientSecurityStatus(previous.settings.emergency);
      }
      await securityQuery.refetch();
      toast({ title: "Emergency control not saved", description: error?.message || "The previous setting has been restored.", variant: "destructive" });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async (eventId: number) => (await apiRequest("POST", `/api/admin/security/events/${eventId}/resolve`, { resolution: "Reviewed in the admin security center" })).json(),
    onSuccess: async () => { await securityQuery.refetch(); toast({ title: "Security event resolved" }); },
    onError: (error: any) => toast({ title: "Event not resolved", description: error?.message || "Unable to resolve the event", variant: "destructive" }),
  });

  const actionMutation = useMutation({
    mutationFn: async (endpoint: string) => (await apiRequest("POST", endpoint, {})).json(),
    onSuccess: async () => { await securityQuery.refetch(); toast({ title: "Security action completed" }); },
    onError: (error: any) => toast({ title: "Security action failed", description: error?.message || "Unable to complete the action", variant: "destructive" }),
  });

  if (securityQuery.isLoading || !draft) {
    return <div className="grid gap-4 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-48 rounded-3xl bg-white/10" />)}</div>;
  }

  const summary = securityQuery.data?.overview?.summary || {};
  const runtime = securityQuery.data?.runtime || {};
  const events = securityQuery.data?.overview?.recentEvents || [];
  const emergencyActive = [draft.emergency.readOnly, draft.emergency.authPaused, draft.emergency.depositsPaused, draft.emergency.withdrawalsPaused, draft.emergency.marketplacePaused, draft.emergency.auctionsPaused].filter(Boolean).length;
  const lockedForReadOnly = draft.emergency.readOnly;

  const updateEmergencySwitch = (key: EmergencyBooleanKey, value: boolean) => {
    const persisted = securityQuery.data?.settings;
    if (!persisted || emergencyMutation.isPending) return;
    const nextEmergency = { ...draft.emergency, [key]: value };
    const nextSettings = { ...cloneSettings(persisted), emergency: nextEmergency };
    emergencyMutation.mutate({ settings: nextSettings, key, value });
  };
  const updateEmergencyMessage = (value: string) => { setDraft((current) => current ? { ...current, emergency: { ...current.emergency, message: value } } : current); setDirty(true); };
  const updateRate = (key: keyof SecuritySettings["rateLimits"], value: number) => { setDraft((current) => current ? { ...current, rateLimits: { ...current.rateLimits, [key]: value } } : current); setDirty(true); };
  const updateDetection = (key: keyof SecuritySettings["detection"], value: number) => { setDraft((current) => current ? { ...current, detection: { ...current.detection, [key]: value } } : current); setDirty(true); };
  const updatePosture = (key: keyof SecuritySettings["posture"], value: boolean | string) => { setDraft((current) => current ? { ...current, posture: { ...current.posture, [key]: value } } : current); setDirty(true); };

  const save = () => {
    if (emergencyActive > 0 && !window.confirm(`${emergencyActive} emergency control(s) will remain active. Save the remaining settings?`)) return;
    saveMutation.mutate(draft);
  };

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden border-cyan-300/20 bg-gradient-to-br from-slate-950 via-slate-950/95 to-cyan-950/35 p-5 text-white shadow-2xl shadow-black/30">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4"><div className="rounded-3xl border border-cyan-300/25 bg-cyan-300/10 p-4 text-cyan-100"><Shield className="h-8 w-8" /></div><div><p className="text-xs font-black uppercase tracking-[0.26em] text-cyan-200/70">Security command center</p><h2 className="mt-2 text-2xl font-black sm:text-3xl">Protect Fantasy Arena in real time</h2><p className="mt-2 max-w-3xl text-sm text-slate-400">Emergency switches save immediately. Other limits and checklist changes use the Save button below.</p><p className="mt-2 text-xs text-slate-500">Last changed {dateLabel(securityQuery.data?.updatedAt)} by {securityQuery.data?.updatedBy || "system"}.</p></div></div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[32rem]"><Metric label="Open" value={summary.openEvents || 0} /><Metric label="Critical" value={summary.criticalOpenEvents || 0} danger /><Metric label="Blocked 24h" value={summary.blockedLast24Hours || 0} /><Metric label="Emergency" value={emergencyActive} danger={emergencyActive > 0} /></div>
        </div>
      </Card>

      <Card className="border-red-300/15 bg-slate-950/75 p-5 text-white">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2 text-lg font-black"><Power className="h-5 w-5 text-red-200" />Emergency controls</div><p className="mt-1 text-sm text-slate-400">Each switch is written to the database immediately and stays in the same position when you change tabs or refresh.</p></div><Badge className={emergencyActive ? "bg-red-500/15 text-red-100" : "bg-emerald-500/15 text-emerald-100"}>{emergencyMutation.isPending ? "Applying…" : emergencyActive ? `${emergencyActive} active` : "Normal operation"}</Badge></div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <SwitchRow title="Read-only mode" description="Launch preview mode. Sign-up, starter onboarding and the daily common reward remain available; economy and tournament actions stay paused." checked={draft.emergency.readOnly} disabled={emergencyMutation.isPending} onCheckedChange={(value) => updateEmergencySwitch("readOnly", value)} danger />
          <SwitchRow title="Pause new logins" description="Stops new sign-ups and logins, including during preview mode." checked={draft.emergency.authPaused} disabled={emergencyMutation.isPending} onCheckedChange={(value) => updateEmergencySwitch("authPaused", value)} danger />
          <SwitchRow title="Pause deposits" description="Stops new wallet deposit submissions." checked={draft.emergency.depositsPaused} disabled={emergencyMutation.isPending} onCheckedChange={(value) => updateEmergencySwitch("depositsPaused", value)} danger />
          <SwitchRow title="Pause withdrawals" description="Stops new withdrawal requests." checked={draft.emergency.withdrawalsPaused} disabled={emergencyMutation.isPending} onCheckedChange={(value) => updateEmergencySwitch("withdrawalsPaused", value)} danger />
          <SwitchRow title="Pause marketplace" description="Blocks buying, selling, listing and loans while pages remain viewable." checked={draft.emergency.marketplacePaused} disabled={emergencyMutation.isPending} onCheckedChange={(value) => updateEmergencySwitch("marketplacePaused", value)} danger />
          <SwitchRow title="Pause auctions" description="Blocks auction creation, bids, buy-now and settlement actions." checked={draft.emergency.auctionsPaused} disabled={emergencyMutation.isPending} onCheckedChange={(value) => updateEmergencySwitch("auctionsPaused", value)} danger />
        </div>
        <div className="mt-4 space-y-2"><Label htmlFor="securityMessage" className="font-black">Message shown when an action is blocked</Label><Input id="securityMessage" value={draft.emergency.message} maxLength={240} onChange={(event) => updateEmergencyMessage(event.target.value)} className="border-white/10 bg-black/35" /></div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="border-white/10 bg-slate-950/75 p-5 text-white"><div className="flex items-center gap-2 text-lg font-black"><Gauge className="h-5 w-5 text-cyan-200" />Application rate limits</div><div className="mt-4 grid gap-3 sm:grid-cols-2"><NumberField label="All API / minute" value={draft.rateLimits.apiPerMinute} onChange={(value) => updateRate("apiPerMinute", value)} helper="General per-user or IP ceiling." /><NumberField label="Authentication / 15 min" value={draft.rateLimits.authPer15Minutes} onChange={(value) => updateRate("authPer15Minutes", value)} helper="Login endpoint ceiling." /><NumberField label="Financial / minute" value={draft.rateLimits.financialPerMinute} onChange={(value) => updateRate("financialPerMinute", value)} helper="Wallet and marketplace writes." /><NumberField label="Auctions / minute" value={draft.rateLimits.auctionPerMinute} onChange={(value) => updateRate("auctionPerMinute", value)} helper="Auction writes." /><NumberField label="Admin / minute" value={draft.rateLimits.adminPerMinute} onChange={(value) => updateRate("adminPerMinute", value)} helper="Administrative requests." /></div></Card>
        <Card className="border-white/10 bg-slate-950/75 p-5 text-white"><div className="flex items-center gap-2 text-lg font-black"><AlertTriangle className="h-5 w-5 text-amber-200" />Suspicious activity thresholds</div><div className="mt-4 grid gap-3 sm:grid-cols-2"><NumberField label="Auth attempts / 15 min" value={draft.detection.authAttemptsPer15Minutes} onChange={(value) => updateDetection("authAttemptsPer15Minutes", value)} helper="Creates an authentication alert." /><NumberField label="Bid attempts / minute" value={draft.detection.bidAttemptsPerMinute} onChange={(value) => updateDetection("bidAttemptsPerMinute", value)} helper="Creates an auction alert." /><NumberField label="Financial actions / minute" value={draft.detection.financialActionsPerMinute} onChange={(value) => updateDetection("financialActionsPerMinute", value)} helper="Creates a financial alert." /><NumberField label="Temporary block minutes" value={draft.detection.blockMinutes} onChange={(value) => updateDetection("blockMinutes", value)} helper="Duration of temporary blocking." /></div></Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="border-white/10 bg-slate-950/75 p-5 text-white"><div className="flex items-center gap-2 text-lg font-black"><Lock className="h-5 w-5 text-cyan-200" />Security posture checklist</div><div className="mt-4 grid gap-3 sm:grid-cols-2"><SwitchRow title="Admin MFA required" description="All administrator Google accounts use MFA." checked={draft.posture.adminMfaRequired} onCheckedChange={(value) => updatePosture("adminMfaRequired", value)} /><SwitchRow title="Cloudflare enabled" description="DNS, DDoS and WAF protection are active." checked={draft.posture.cloudflareEnabled} onCheckedChange={(value) => updatePosture("cloudflareEnabled", value)} /><SwitchRow title="GitHub security enabled" description="Secret scanning, Dependabot, CodeQL and branch protection are active." checked={draft.posture.githubSecurityEnabled} onCheckedChange={(value) => updatePosture("githubSecurityEnabled", value)} /><SwitchRow title="Backups verified" description="A recent database restoration was tested." checked={draft.posture.backupsVerified} onCheckedChange={(value) => updatePosture("backupsVerified", value)} /></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label>Last penetration test</Label><Input type="date" value={draft.posture.penetrationTestDate} onChange={(event) => updatePosture("penetrationTestDate", event.target.value)} className="border-white/10 bg-black/35" /></div><div className="space-y-2"><Label>Incident contact</Label><Input value={draft.posture.incidentContact} onChange={(event) => updatePosture("incidentContact", event.target.value)} className="border-white/10 bg-black/35" /></div></div></Card>
        <Card className="border-white/10 bg-slate-950/75 p-5 text-white"><div className="flex items-center gap-2 text-lg font-black"><Server className="h-5 w-5 text-cyan-200" />Live runtime protections</div><div className="mt-4 grid gap-3"><RuntimeCheck label="Strict global read-only guard" ok={Boolean(runtime.strictGlobalReadOnlyGuard)} detail="All state-changing routes are checked before execution." /><RuntimeCheck label="Strong session secret" ok={Boolean(runtime.sessionSecretConfigured)} detail="Production session secret is configured." /><RuntimeCheck label="Google OAuth configured" ok={Boolean(runtime.googleOAuthConfigured)} detail="Google login credentials are present." /><RuntimeCheck label="Secure cookies" ok={Boolean(runtime.secureCookiesEnabled)} detail="HTTPS-only cookies are enabled." /><RuntimeCheck label="CSRF origin guard" ok={Boolean(runtime.csrfOriginGuard)} detail="Cross-origin writes are rejected." /><RuntimeCheck label="Cloudflare detected" ok={Boolean(runtime.cloudflareRequestDetected)} detail="Cloudflare headers reached this request." /></div></Card>
      </div>

      <Card className="border-white/10 bg-slate-950/75 p-5 text-white">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2 text-lg font-black"><Activity className="h-5 w-5 text-cyan-200" />Security events</div><p className="mt-1 text-sm text-slate-400">Blocked requests, suspicious bursts and administrator actions.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => securityQuery.refetch()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button><Button variant="outline" disabled={lockedForReadOnly || actionMutation.isPending} onClick={() => window.confirm("Clear temporary rate-limit blocks?") && actionMutation.mutate("/api/admin/security/rate-limits/clear")}><Gauge className="mr-2 h-4 w-4" />Clear limits</Button><Button variant="destructive" disabled={lockedForReadOnly || actionMutation.isPending} onClick={() => window.confirm("Revoke every other logged-in session?") && actionMutation.mutate("/api/admin/security/sessions/revoke-others")}><Users className="mr-2 h-4 w-4" />Revoke sessions</Button></div></div>
        <div className="mt-4 space-y-3">{events.length ? events.map((event) => <div key={event.id} className={`rounded-2xl border p-4 ${event.resolved ? "border-white/10 bg-black/20 opacity-70" : "border-white/15 bg-black/35"}`}><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap gap-2"><Badge className={event.severity === "critical" ? "bg-red-500/15 text-red-100" : event.severity === "warning" ? "bg-amber-500/15 text-amber-100" : "bg-cyan-500/15 text-cyan-100"}>{event.severity}</Badge><Badge variant="outline">{event.category}</Badge>{event.resolved ? <Badge className="bg-emerald-500/15 text-emerald-100">Resolved</Badge> : null}</div><p className="mt-2 break-words font-black">{event.action}</p><p className="mt-1 break-all text-xs text-slate-500">{event.route || "No route"} • {event.ip || "No IP"} • {dateLabel(event.createdAt)}</p></div>{!event.resolved ? <Button size="sm" variant="outline" disabled={lockedForReadOnly || resolveMutation.isPending} onClick={() => resolveMutation.mutate(event.id)}>Mark reviewed</Button> : null}</div>{event.details && Object.keys(event.details).length ? <details className="mt-3 rounded-xl border border-white/10 bg-black/25 p-3"><summary className="cursor-pointer text-xs font-black text-slate-400">Event details</summary><pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all text-xs text-cyan-100/70">{JSON.stringify(event.details, null, 2)}</pre></details> : null}</div>) : <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-slate-500">No security events recorded.</div>}</div>
      </Card>

      <div className="sticky bottom-3 z-20 flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-950/95 p-3 shadow-2xl backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2 text-sm text-slate-400">{dirty ? <AlertTriangle className="h-4 w-4 text-amber-300" /> : <CheckCircle2 className="h-4 w-4 text-emerald-300" />}{dirty ? "Unsaved non-emergency changes" : emergencyMutation.isPending ? "Saving emergency control…" : "All settings are saved"}</div><div className="flex gap-2"><Button variant="outline" disabled={!dirty || saveMutation.isPending || emergencyMutation.isPending} onClick={() => { setDraft(cloneSettings(securityQuery.data!.settings)); setDirty(false); }}><RefreshCw className="mr-2 h-4 w-4" />Reset</Button><Button disabled={!dirty || saveMutation.isPending || emergencyMutation.isPending} onClick={save} className="bg-cyan-300 font-black text-slate-950 hover:bg-cyan-200"><Save className="mr-2 h-4 w-4" />{saveMutation.isPending ? "Saving…" : "Save other settings"}</Button></div></div>
    </div>
  );
}
