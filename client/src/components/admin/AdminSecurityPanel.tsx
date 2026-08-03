import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cloud,
  Database,
  Gauge,
  KeyRound,
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
  resolvedAt?: string | null;
  resolvedBy?: string | null;
  resolution?: string | null;
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
    topCategories?: Array<{ category: string; count: number }>;
    recentEvents?: SecurityEvent[];
  };
  runtime?: Record<string, string | number | boolean | null | undefined>;
};

function numberValue(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateLabel(value?: string | null) {
  if (!value) return "Never";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : String(value);
}

function severityClass(severity: string) {
  if (severity === "critical") return "border-red-400/30 bg-red-500/15 text-red-100";
  if (severity === "warning") return "border-amber-400/30 bg-amber-500/15 text-amber-100";
  return "border-cyan-400/30 bg-cyan-500/15 text-cyan-100";
}

function SectionHeading({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-3 text-cyan-100">{icon}</div>
      <div>
        <h3 className="text-lg font-black text-white">{title}</h3>
        <p className="mt-1 text-sm text-slate-400">{description}</p>
      </div>
    </div>
  );
}

function SwitchRow({
  title,
  description,
  checked,
  onCheckedChange,
  danger = false,
}: {
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  danger?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between gap-4 rounded-2xl border p-4 ${checked && danger ? "border-red-400/30 bg-red-500/10" : "border-white/10 bg-black/25"}`}>
      <div>
        <p className="font-black text-white">{title}</p>
        <p className="mt-1 text-xs text-slate-400">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function NumberField({ label, value, onChange, helper }: { label: string; value: number; onChange: (value: number) => void; helper: string }) {
  return (
    <div className="space-y-2 rounded-2xl border border-white/10 bg-black/25 p-4">
      <Label className="font-black text-white">{label}</Label>
      <Input
        type="number"
        min={1}
        value={value}
        onChange={(event) => onChange(numberValue(event.target.value))}
        className="border-white/10 bg-black/40 text-white"
      />
      <p className="text-xs text-slate-500">{helper}</p>
    </div>
  );
}

function RuntimeCheck({ label, ok, detail }: { label: string; ok: boolean; detail?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/25 p-3">
      <div>
        <p className="text-sm font-bold text-white">{label}</p>
        {detail ? <p className="mt-1 text-xs text-slate-500">{detail}</p> : null}
      </div>
      {ok ? <CheckCircle2 className="h-5 w-5 text-emerald-300" /> : <XCircle className="h-5 w-5 text-amber-300" />}
    </div>
  );
}

export default function AdminSecurityPanel() {
  const { toast } = useToast();
  const securityQuery = useQuery<SecurityResponse>({ queryKey: ["/api/admin/security"] });
  const [draft, setDraft] = useState<SecuritySettings | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!securityQuery.data?.settings) return;
    setDraft(structuredClone(securityQuery.data.settings));
    setDirty(false);
  }, [securityQuery.data?.settings, securityQuery.data?.updatedAt]);

  const saveMutation = useMutation({
    mutationFn: async (settings: SecuritySettings) => {
      const response = await apiRequest("PATCH", "/api/admin/security", { settings });
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/security"] });
      toast({ title: "Security settings saved", description: "The controls are now active across Fantasy Arena." });
    },
    onError: (error: any) => {
      toast({ title: "Security settings not saved", description: error?.message || "Unable to update the controls", variant: "destructive" });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async (eventId: number) => {
      const response = await apiRequest("POST", `/api/admin/security/events/${eventId}/resolve`, { resolution: "Reviewed in the admin security center" });
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/security"] });
      toast({ title: "Security event resolved" });
    },
    onError: (error: any) => {
      toast({ title: "Event not resolved", description: error?.message || "Unable to resolve the event", variant: "destructive" });
    },
  });

  const actionMutation = useMutation({
    mutationFn: async (endpoint: string) => {
      const response = await apiRequest("POST", endpoint, {});
      return response.json();
    },
    onSuccess: async (result: any, endpoint) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/security"] });
      const description = endpoint.includes("sessions")
        ? `${numberValue(result?.revoked)} other session(s) revoked.`
        : `${numberValue(result?.cleared)} rate-limit bucket(s) cleared.`;
      toast({ title: "Security action completed", description });
    },
    onError: (error: any) => {
      toast({ title: "Security action failed", description: error?.message || "Unable to complete the action", variant: "destructive" });
    },
  });

  const summary = securityQuery.data?.overview?.summary || {};
  const runtime = securityQuery.data?.runtime || {};
  const events = securityQuery.data?.overview?.recentEvents || [];
  const emergencyActive = useMemo(() => {
    if (!draft) return 0;
    return [
      draft.emergency.readOnly,
      draft.emergency.authPaused,
      draft.emergency.depositsPaused,
      draft.emergency.withdrawalsPaused,
      draft.emergency.marketplacePaused,
      draft.emergency.auctionsPaused,
    ].filter(Boolean).length;
  }, [draft]);

  if (securityQuery.isLoading || !draft) {
    return (
      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-48 rounded-3xl bg-white/10" />)}
      </div>
    );
  }

  const updateEmergency = (key: keyof SecuritySettings["emergency"], value: boolean | string) => {
    setDraft((current) => current ? { ...current, emergency: { ...current.emergency, [key]: value } } : current);
    setDirty(true);
  };
  const updateRate = (key: keyof SecuritySettings["rateLimits"], value: number) => {
    setDraft((current) => current ? { ...current, rateLimits: { ...current.rateLimits, [key]: value } } : current);
    setDirty(true);
  };
  const updateDetection = (key: keyof SecuritySettings["detection"], value: number) => {
    setDraft((current) => current ? { ...current, detection: { ...current.detection, [key]: value } } : current);
    setDirty(true);
  };
  const updatePosture = (key: keyof SecuritySettings["posture"], value: boolean | string) => {
    setDraft((current) => current ? { ...current, posture: { ...current.posture, [key]: value } } : current);
    setDirty(true);
  };

  const save = () => {
    if (emergencyActive > 0 && !window.confirm(`${emergencyActive} emergency control(s) will be active. Continue?`)) return;
    saveMutation.mutate(draft);
  };

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden border-cyan-300/20 bg-gradient-to-br from-slate-950 via-slate-950/95 to-cyan-950/35 p-5 text-white shadow-2xl shadow-black/30">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-3xl border border-cyan-300/25 bg-cyan-300/10 p-4 text-cyan-100"><Shield className="h-8 w-8" /></div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.26em] text-cyan-200/70">Security command center</p>
              <h2 className="mt-2 text-2xl font-black sm:text-3xl">Protect Fantasy Arena in real time</h2>
              <p className="mt-2 max-w-3xl text-sm text-slate-400">Pause risky services, edit application rate limits, review security events and verify the external protection checklist.</p>
              <p className="mt-2 text-xs text-slate-500">Last changed {dateLabel(securityQuery.data?.updatedAt)} by {securityQuery.data?.updatedBy || "system"}.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[32rem]">
            <Metric label="Open" value={summary.openEvents || 0} tone="amber" />
            <Metric label="Critical" value={summary.criticalOpenEvents || 0} tone="red" />
            <Metric label="Blocked 24h" value={summary.blockedLast24Hours || 0} tone="cyan" />
            <Metric label="Emergency" value={emergencyActive} tone={emergencyActive ? "red" : "emerald"} />
          </div>
        </div>
      </Card>

      <Card className="border-red-300/15 bg-slate-950/75 p-5 text-white">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <SectionHeading icon={<Power className="h-5 w-5" />} title="Emergency controls" description="These switches immediately restrict high-risk parts of the platform. The security center remains available so you can recover access." />
          <Badge className={emergencyActive ? "border-red-300/30 bg-red-500/15 text-red-100" : "border-emerald-300/30 bg-emerald-500/15 text-emerald-100"}>{emergencyActive ? `${emergencyActive} active` : "Normal operation"}</Badge>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <SwitchRow title="Read-only mode" description="Blocks all API changes except the security controls and logout." checked={draft.emergency.readOnly} onCheckedChange={(value) => updateEmergency("readOnly", value)} danger />
          <SwitchRow title="Pause new logins" description="Stops Google login and authentication callbacks." checked={draft.emergency.authPaused} onCheckedChange={(value) => updateEmergency("authPaused", value)} danger />
          <SwitchRow title="Pause deposits" description="Stops users from submitting new wallet deposits." checked={draft.emergency.depositsPaused} onCheckedChange={(value) => updateEmergency("depositsPaused", value)} danger />
          <SwitchRow title="Pause withdrawals" description="Stops new withdrawal requests while reviews remain available." checked={draft.emergency.withdrawalsPaused} onCheckedChange={(value) => updateEmergency("withdrawalsPaused", value)} danger />
          <SwitchRow title="Pause marketplace" description="Blocks buy, sell and loan actions while listings remain visible." checked={draft.emergency.marketplacePaused} onCheckedChange={(value) => updateEmergency("marketplacePaused", value)} danger />
          <SwitchRow title="Pause auctions" description="Blocks bids and buy-now actions while auctions remain visible." checked={draft.emergency.auctionsPaused} onCheckedChange={(value) => updateEmergency("auctionsPaused", value)} danger />
        </div>
        <div className="mt-4 space-y-2">
          <Label htmlFor="securityMessage" className="font-black">Message shown when an action is blocked</Label>
          <Input id="securityMessage" value={draft.emergency.message} maxLength={240} onChange={(event) => updateEmergency("message", event.target.value)} className="border-white/10 bg-black/35" />
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="border-white/10 bg-slate-950/75 p-5 text-white">
          <SectionHeading icon={<Gauge className="h-5 w-5" />} title="Application rate limits" description="Requests above these limits are temporarily blocked and recorded as security events." />
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <NumberField label="All API / minute" value={draft.rateLimits.apiPerMinute} onChange={(value) => updateRate("apiPerMinute", value)} helper="General per-account or per-IP API ceiling." />
            <NumberField label="Authentication / 15 min" value={draft.rateLimits.authPer15Minutes} onChange={(value) => updateRate("authPer15Minutes", value)} helper="Login and authentication endpoint ceiling." />
            <NumberField label="Financial / minute" value={draft.rateLimits.financialPerMinute} onChange={(value) => updateRate("financialPerMinute", value)} helper="Wallet and marketplace write operations." />
            <NumberField label="Auctions / minute" value={draft.rateLimits.auctionPerMinute} onChange={(value) => updateRate("auctionPerMinute", value)} helper="Bid and buy-now write operations." />
            <NumberField label="Admin / minute" value={draft.rateLimits.adminPerMinute} onChange={(value) => updateRate("adminPerMinute", value)} helper="Administrative API requests." />
          </div>
        </Card>

        <Card className="border-white/10 bg-slate-950/75 p-5 text-white">
          <SectionHeading icon={<AlertTriangle className="h-5 w-5" />} title="Suspicious activity thresholds" description="Events are flagged before the hard rate limit is reached so the admin can investigate unusual behaviour." />
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <NumberField label="Auth attempts / 15 min" value={draft.detection.authAttemptsPer15Minutes} onChange={(value) => updateDetection("authAttemptsPer15Minutes", value)} helper="Creates an authentication burst alert." />
            <NumberField label="Bid attempts / minute" value={draft.detection.bidAttemptsPerMinute} onChange={(value) => updateDetection("bidAttemptsPerMinute", value)} helper="Creates an auction burst alert." />
            <NumberField label="Financial actions / minute" value={draft.detection.financialActionsPerMinute} onChange={(value) => updateDetection("financialActionsPerMinute", value)} helper="Creates a wallet or marketplace risk alert." />
            <NumberField label="Temporary block minutes" value={draft.detection.blockMinutes} onChange={(value) => updateDetection("blockMinutes", value)} helper="How long a rate-limit block remains active." />
          </div>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.05fr_.95fr]">
        <Card className="border-white/10 bg-slate-950/75 p-5 text-white">
          <SectionHeading icon={<Lock className="h-5 w-5" />} title="Security posture checklist" description="Record the protections managed outside the app. These switches document readiness; Cloudflare and GitHub must still be configured on their own platforms." />
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <SwitchRow title="Admin MFA required" description="All administrator Google accounts use multi-factor authentication." checked={draft.posture.adminMfaRequired} onCheckedChange={(value) => updatePosture("adminMfaRequired", value)} />
            <SwitchRow title="Cloudflare enabled" description="DNS, DDoS protection, WAF and edge rate limits are active." checked={draft.posture.cloudflareEnabled} onCheckedChange={(value) => updatePosture("cloudflareEnabled", value)} />
            <SwitchRow title="GitHub security enabled" description="Secret scanning, Dependabot, CodeQL and branch protection are active." checked={draft.posture.githubSecurityEnabled} onCheckedChange={(value) => updatePosture("githubSecurityEnabled", value)} />
            <SwitchRow title="Backups verified" description="A recent database restore test completed successfully." checked={draft.posture.backupsVerified} onCheckedChange={(value) => updatePosture("backupsVerified", value)} />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="space-y-2"><Label>Last penetration test</Label><Input type="date" value={draft.posture.penetrationTestDate} onChange={(event) => updatePosture("penetrationTestDate", event.target.value)} className="border-white/10 bg-black/35" /></div>
            <div className="space-y-2"><Label>Incident contact</Label><Input value={draft.posture.incidentContact} placeholder="Email or emergency number" onChange={(event) => updatePosture("incidentContact", event.target.value)} className="border-white/10 bg-black/35" /></div>
          </div>
        </Card>

        <Card className="border-white/10 bg-slate-950/75 p-5 text-white">
          <SectionHeading icon={<Server className="h-5 w-5" />} title="Live runtime protections" description="Read-only checks from the running Fantasy Arena server. Secrets are never displayed." />
          <div className="mt-5 grid gap-3">
            <RuntimeCheck label="Strong session secret" ok={Boolean(runtime.sessionSecretConfigured)} detail="A production session secret of at least 32 characters." />
            <RuntimeCheck label="Google OAuth configured" ok={Boolean(runtime.googleOAuthConfigured)} detail="Client ID and secret are present in Railway." />
            <RuntimeCheck label="Secure production cookies" ok={Boolean(runtime.secureCookiesEnabled)} detail="HTTPS-only cookies are enabled in production." />
            <RuntimeCheck label="CSRF origin guard" ok={Boolean(runtime.csrfOriginGuard)} detail="Cross-origin state-changing browser requests are blocked." />
            <RuntimeCheck label="Security headers" ok={Boolean(runtime.securityHeaders)} detail="CSP, HSTS, anti-frame and browser permission policies." />
            <RuntimeCheck label="Cloudflare detected on this request" ok={Boolean(runtime.cloudflareRequestDetected)} detail="A Cloudflare request header was received by the server." />
          </div>
        </Card>
      </div>

      <Card className="border-white/10 bg-slate-950/75 p-5 text-white">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <SectionHeading icon={<Activity className="h-5 w-5" />} title="Security events" description="Blocked origins, burst traffic, emergency-control blocks and administrator security actions." />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => securityQuery.refetch()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
            <Button variant="outline" disabled={actionMutation.isPending} onClick={() => window.confirm("Clear all temporary application rate-limit blocks?") && actionMutation.mutate("/api/admin/security/rate-limits/clear")}><Gauge className="mr-2 h-4 w-4" />Clear rate limits</Button>
            <Button variant="destructive" disabled={actionMutation.isPending} onClick={() => window.confirm("Revoke every other logged-in session? Your current admin session will remain active.") && actionMutation.mutate("/api/admin/security/sessions/revoke-others")}><Users className="mr-2 h-4 w-4" />Revoke other sessions</Button>
          </div>
        </div>
        <div className="mt-5 space-y-3">
          {events.length ? events.map((event) => (
            <div key={event.id} className={`rounded-2xl border p-4 ${event.resolved ? "border-white/10 bg-black/20 opacity-70" : "border-white/15 bg-black/35"}`}>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={severityClass(event.severity)}>{event.severity}</Badge>
                    <Badge variant="outline" className="border-white/15 text-slate-300">{event.category}</Badge>
                    {event.resolved ? <Badge className="bg-emerald-500/15 text-emerald-200">Resolved</Badge> : null}
                  </div>
                  <p className="mt-3 break-words font-black text-white">{event.action}</p>
                  <p className="mt-1 break-all text-xs text-slate-500">{event.route || "No route"} • {event.ip || "No IP"} • {dateLabel(event.createdAt)}</p>
                  {event.userId ? <p className="mt-1 break-all text-xs text-cyan-200/70">User {event.userId}</p> : null}
                </div>
                {!event.resolved ? <Button size="sm" variant="outline" disabled={resolveMutation.isPending} onClick={() => resolveMutation.mutate(event.id)}>Mark reviewed</Button> : null}
              </div>
              {event.details && Object.keys(event.details).length ? <details className="mt-3 rounded-xl border border-white/10 bg-black/25 p-3"><summary className="cursor-pointer text-xs font-black uppercase tracking-[.12em] text-slate-400">Event details</summary><pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap break-all text-xs text-cyan-100/70">{JSON.stringify(event.details, null, 2)}</pre></details> : null}
            </div>
          )) : <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-slate-500">No security events have been recorded.</div>}
        </div>
      </Card>

      <div className="sticky bottom-3 z-20 flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-950/95 p-3 shadow-2xl backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          {dirty ? <AlertTriangle className="h-4 w-4 text-amber-300" /> : <CheckCircle2 className="h-4 w-4 text-emerald-300" />}
          {dirty ? "Unsaved security changes" : "Security settings are saved"}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled={!dirty || saveMutation.isPending} onClick={() => { setDraft(structuredClone(securityQuery.data!.settings)); setDirty(false); }}><RefreshCw className="mr-2 h-4 w-4" />Reset</Button>
          <Button disabled={!dirty || saveMutation.isPending} onClick={save} className="bg-cyan-300 font-black text-slate-950 hover:bg-cyan-200"><Save className="mr-2 h-4 w-4" />{saveMutation.isPending ? "Saving..." : "Save security settings"}</Button>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: "cyan" | "amber" | "red" | "emerald" }) {
  const toneClass = {
    cyan: "border-cyan-300/20 bg-cyan-400/10 text-cyan-100",
    amber: "border-amber-300/20 bg-amber-400/10 text-amber-100",
    red: "border-red-300/20 bg-red-400/10 text-red-100",
    emerald: "border-emerald-300/20 bg-emerald-400/10 text-emerald-100",
  }[tone];
  return <div className={`rounded-2xl border p-3 ${toneClass}`}><p className="text-2xl font-black">{numberValue(value)}</p><p className="mt-1 text-[10px] font-black uppercase tracking-[.15em] opacity-70">{label}</p></div>;
}
