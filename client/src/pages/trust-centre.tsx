import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Activity, CheckCircle2, CircleDot, Clock3, CreditCard, Database, LockKeyhole, Map, RefreshCw, Rocket, ShieldCheck, Wrench } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";

const trustPaths = [
  ["System Status", "/trust/status"],
  ["Security", "/trust/security"],
  ["Payments", "/trust/payments"],
  ["Release Notes", "/trust/releases"],
  ["Roadmap", "/trust/roadmap"],
] as const;

async function probe(path: string) {
  const started = performance.now();
  try {
    const response = await fetch(path, { credentials: "include", cache: "no-store" });
    return { online: response.ok, status: response.status, responseTimeMs: Math.round(performance.now() - started), checkedAt: new Date().toISOString() };
  } catch {
    return { online: false, status: 0, responseTimeMs: null, checkedAt: new Date().toISOString() };
  }
}

export default function TrustCentrePage() {
  const [location] = useLocation();
  const competitions = useQuery({ queryKey: ["trust-probe", "competitions"], queryFn: () => probe("/api/competitions"), refetchInterval: 60000 });
  const vault = useQuery({ queryKey: ["trust-probe", "vault"], queryFn: () => probe("/api/prize-vault"), refetchInterval: 60000 });
  const browserOnline = typeof navigator === "undefined" ? true : navigator.onLine;

  return (
    <main className="min-h-screen bg-[#02040c] px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_82%_0%,rgba(34,211,238,.18),transparent_34%),linear-gradient(145deg,#0b1020,#050711)] p-5 sm:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.2em] text-emerald-100"><ShieldCheck className="h-3.5 w-3.5" />Fantasy Arena Trust Centre</div>
              <h1 className="mt-4 text-3xl font-black sm:text-5xl">Transparency, security and launch readiness</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-white/55">Public information about service availability, security controls, payment readiness, releases and the Fantasy Arena launch roadmap.</p>
            </div>
            <Button variant="outline" className="border-white/15 bg-white/5 text-white" onClick={() => Promise.all([competitions.refetch(), vault.refetch()])}><RefreshCw className="mr-2 h-4 w-4" />Refresh checks</Button>
          </div>
        </header>

        <nav className="mt-5 flex gap-2 overflow-x-auto pb-2">
          {trustPaths.map(([label, href]) => <Link key={href} href={href} className={`whitespace-nowrap rounded-xl border px-3 py-2 text-xs font-bold ${location === href ? "border-cyan-300/50 bg-cyan-400/10 text-cyan-100" : "border-white/10 bg-white/[.03] text-white/45 hover:text-white"}`}>{label}</Link>)}
        </nav>

        {location === "/trust/security" ? <Security /> : location === "/trust/payments" ? <Payments /> : location === "/trust/releases" ? <Releases /> : location === "/trust/roadmap" ? <Roadmap /> : <Status browserOnline={browserOnline} competitions={competitions.data} vault={vault.data} loading={competitions.isFetching || vault.isFetching} />}
      </div>
    </main>
  );
}

function Status({ browserOnline, competitions, vault, loading }: { browserOnline: boolean; competitions: any; vault: any; loading: boolean }) {
  const services = [
    { name: "Fantasy Arena website", online: browserOnline, note: browserOnline ? "Your device is connected" : "Your device appears offline", latency: null },
    { name: "Tournament service", online: Boolean(competitions?.online), note: competitions?.online ? "Competition data is responding" : "Competition data could not be reached", latency: competitions?.responseTimeMs },
    { name: "Prize Vault service", online: Boolean(vault?.online), note: vault?.online ? "Prize ladders are responding" : "Prize Vault data could not be reached", latency: vault?.responseTimeMs },
    { name: "API-Football live data", online: null, note: "Verified privately in Admin → Live Data; public health reporting will be enabled before launch", latency: null },
    { name: "Payments and withdrawals", online: null, note: "Not live yet — provider integrations and merchant approvals are pending", latency: null },
  ];
  const knownOnline = services.filter((service) => service.online === true).length;
  const knownOffline = services.filter((service) => service.online === false).length;
  return <div className="mt-5 space-y-4">
    <section className="grid gap-3 sm:grid-cols-3"><Metric icon={Activity} label="Operational checks" value={`${knownOnline} online`} good={knownOffline === 0} /><Metric icon={Clock3} label="Automatic refresh" value="Every 60 sec" good /><Metric icon={Database} label="Unknown / pre-launch" value={String(services.filter((s) => s.online === null).length)} good /></section>
    <Card className="border-white/10 bg-white/[.04] p-4 text-white sm:p-6">
      <div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-black">Current service status</h2><p className="mt-1 text-sm text-white/45">These public checks do not expose credentials or private admin data.</p></div>{loading && <RefreshCw className="h-5 w-5 animate-spin text-cyan-300" />}</div>
      <div className="mt-5 divide-y divide-white/10">{services.map((service) => <div key={service.name} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="font-bold">{service.name}</div><div className="mt-1 text-xs text-white/40">{service.note}</div></div><div className="flex items-center gap-3"><span className="text-xs text-white/35">{service.latency != null ? `${service.latency} ms` : ""}</span><StatusBadge value={service.online} /></div></div>)}</div>
    </Card>
  </div>;
}

function Security() {
  const sections = [
    ["Account and access security", ["Authenticated sessions and server-side authorization protect private routes.", "Admin tools require separate admin authorization.", "Users should never share passwords, payment credentials or verification codes."]],
    ["Payment and API secrets", ["Payment keys and API-Football credentials must remain in Railway environment variables.", "Secrets are not intended for frontend bundles or GitHub commits.", "Third-party card/payment information should be handled by approved payment providers wherever possible."]],
    ["Fraud and platform integrity", ["Transaction, competition and marketplace activity may be logged for audit and fraud review.", "Suspicious withdrawals, multi-accounting, automated abuse and chargebacks may trigger restrictions.", "Sensitive changes should be released only after type checks and production builds succeed."]],
    ["Responsible disclosure", ["Security concerns should be sent privately to security@fantasyarena.com with steps to reproduce.", "Do not publicly disclose exploitable issues before Fantasy Arena has had reasonable time to investigate."]],
  ];
  return <div className="mt-5 grid gap-4 md:grid-cols-2">{sections.map(([title, bullets]) => <Card key={title as string} className="border-white/10 bg-white/[.04] p-5 text-white"><div className="flex items-center gap-2 font-black"><LockKeyhole className="h-5 w-5 text-cyan-300" />{title as string}</div><ul className="mt-4 space-y-3">{(bullets as string[]).map((bullet) => <li key={bullet} className="flex gap-3 text-sm leading-6 text-white/50"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-300" />{bullet}</li>)}</ul></Card>)}</div>;
}

function Payments() {
  const methods = [
    ["Visa / Mastercard gateway", "Planned", "Merchant gateway selection and approval required"],
    ["PayToday", "Contact provider", "Request merchant onboarding, API documentation, fees and sandbox access"],
    ["FNB Pay2Cell / eWallet", "Provider review", "Confirm whether merchant API or reconciliation integration is available"],
    ["Bank Windhoek EasyWallet", "Provider review", "Confirm supported merchant flow and settlement process"],
    ["BlueWallet", "Provider review", "Confirm business acceptance and technical integration options"],
    ["Bank transfer", "Manual launch option", "Can be supported with references and admin reconciliation before automation"],
  ];
  return <div className="mt-5 space-y-4"><div className="rounded-2xl border border-amber-300/20 bg-amber-400/[.07] p-4 text-sm text-amber-100/75">No payment method is presented here as live until a provider approves Fantasy Arena and the full deposit, webhook, reconciliation, refund and withdrawal flow has passed testing.</div><div className="grid gap-3 md:grid-cols-2">{methods.map(([name, status, note]) => <Card key={name} className="border-white/10 bg-white/[.04] p-5 text-white"><div className="flex items-start justify-between gap-3"><div className="font-black">{name}</div><span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-black uppercase tracking-[.12em] text-white/50">{status}</span></div><p className="mt-3 text-sm leading-6 text-white/45">{note}</p></Card>)}</div></div>;
}

function Releases() {
  const releases = [
    { version: "Pre-launch 0.9", date: "July 2026", items: ["Added Trust and Legal Centre.", "Added tiered verification policy.", "Linked reward notifications to exact Prize Vault items.", "Upgraded Prize Vault rarity artwork and floor-price presentation.", "Added safe read-only API-Football fixture and player-stat testing."] },
    { version: "Pre-launch 0.8", date: "July 2026", items: ["Expanded mobile compatibility across core pages.", "Added tournament simulation, rankings and settlement testing.", "Added card ownership lookup and detailed score breakdowns."] },
  ];
  return <div className="mt-5 space-y-4">{releases.map((release) => <Card key={release.version} className="border-white/10 bg-white/[.04] p-5 text-white"><div className="flex flex-wrap items-center justify-between gap-2"><div className="text-xl font-black">{release.version}</div><div className="text-xs text-white/35">{release.date}</div></div><ul className="mt-4 space-y-2">{release.items.map((item) => <li key={item} className="flex gap-3 text-sm text-white/50"><Rocket className="mt-0.5 h-4 w-4 shrink-0 text-purple-300" />{item}</li>)}</ul></Card>)}</div>;
}

function Roadmap() {
  const stages = [
    { title: "Now — launch safety", status: "In progress", items: ["Complete live-data verification", "Merchant and payment-provider onboarding", "Production settlement audit", "Legal and regulatory review", "Mobile regression testing"] },
    { title: "Next — live football engine", status: "Planned", items: ["Player ID mapping", "Fixture import", "Live score polling", "Admin approval of final scores", "Automated tournament rankings"] },
    { title: "After launch", status: "Future", items: ["Player and card history pages", "Market analytics", "Fantasy Arena TV", "Public profiles and achievements", "Push notifications and installable PWA"] },
  ];
  return <div className="mt-5 grid gap-4 lg:grid-cols-3">{stages.map((stage, index) => <Card key={stage.title} className="relative overflow-hidden border-white/10 bg-white/[.04] p-5 text-white"><div className="absolute right-4 top-4 text-5xl font-black text-white/[.04]">0{index + 1}</div><div className="flex items-center gap-2 text-xs font-black uppercase tracking-[.16em] text-cyan-300"><Map className="h-4 w-4" />{stage.status}</div><h2 className="mt-3 text-xl font-black">{stage.title}</h2><ul className="mt-4 space-y-3">{stage.items.map((item) => <li key={item} className="flex gap-3 text-sm text-white/50"><CircleDot className="mt-1 h-3.5 w-3.5 shrink-0 text-purple-300" />{item}</li>)}</ul></Card>)}</div>;
}

function Metric({ icon: Icon, label, value, good }: { icon: any; label: string; value: string; good: boolean }) {
  return <Card className="border-white/10 bg-white/[.04] p-4 text-white"><div className="flex items-center justify-between"><Icon className="h-5 w-5 text-cyan-300" />{good ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : <Wrench className="h-4 w-4 text-amber-300" />}</div><div className="mt-3 text-xl font-black">{value}</div><div className="mt-1 text-xs text-white/40">{label}</div></Card>;
}

function StatusBadge({ value }: { value: boolean | null }) {
  if (value === null) return <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.14em] text-amber-200">Pre-launch</span>;
  return <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[.14em] ${value ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-200" : "border-red-300/20 bg-red-400/10 text-red-200"}`}>{value ? "Operational" : "Unavailable"}</span>;
}
