import fs from "node:fs";

const MARKER = "NATIVE_LOGOUT_SIGNUP_POLISH_V1";

function replaceRequired(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`[native-signup-polish] anchor not found: ${label}`);
  return source.replace(from, to);
}

function patchFile(path, transform, required = []) {
  if (!fs.existsSync(path)) throw new Error(`[native-signup-polish] target missing: ${path}`);
  const original = fs.readFileSync(path, "utf8");
  const next = transform(original);
  for (const marker of required) {
    if (!next.includes(marker)) throw new Error(`[native-signup-polish] verification failed for ${path}: ${marker}`);
  }
  if (next !== original) {
    fs.writeFileSync(path, next);
    console.log(`[native-signup-polish] patched ${path}`);
  } else {
    console.log(`[native-signup-polish] ${path} already patched`);
  }
}

patchFile("client/src/components/native/NativeMobileShell.tsx", (original) => {
  if (original.includes(MARKER)) return original;
  let source = original;

  source = replaceRequired(
    source,
    '  Home,\n  Menu,',
    '  Home,\n  LogOut,\n  Menu,',
    "native logout icon import",
  );
  source = replaceRequired(
    source,
    'import UnreadNotificationDot from "../UnreadNotificationDot";\n',
    'import UnreadNotificationDot from "../UnreadNotificationDot";\nimport { useAuth } from "../../hooks/use-auth";\n',
    "native auth hook import",
  );
  source = replaceRequired(
    source,
    'export default function NativeMobileShell({ children }: NativeMobileShellProps) {\n  const [location] = useLocation();',
    `export default function NativeMobileShell({ children }: NativeMobileShellProps) {\n  // ${MARKER}: logout is always reachable from the native More sheet.\n  const [location] = useLocation();\n  const { logout, isLoggingOut } = useAuth();`,
    "native logout hook",
  );

  const menuFooter = `            </div>\n            <div className="mt-3 rounded-2xl border border-cyan-300/10 bg-cyan-300/[.035] px-3 py-2.5 text-center text-[9px] font-bold text-slate-500">\n              Compact app views use the same live website data and actions.\n            </div>`;
  const logoutBlock = `            </div>\n            <button\n              type="button"\n              data-testid="native-logout-button"\n              onClick={() => logout()}\n              disabled={isLoggingOut}\n              className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-red-300/15 bg-red-400/[.055] px-3.5 py-3 text-left transition active:scale-[.995] disabled:opacity-55"\n              aria-label="Sign out of Fantasy Arena"\n            >\n              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-red-300/15 bg-red-300/[.08] text-red-200"><LogOut className="h-[18px] w-[18px]" /></span>\n              <span className="min-w-0 flex-1"><span className="block text-xs font-black text-white">Sign out</span><span className="mt-0.5 block text-[9px] text-slate-500">End this Fantasy Arena session on this device.</span></span>\n              <ChevronRight className="h-4 w-4 shrink-0 text-red-200/45" />\n            </button>\n            <div className="mt-3 rounded-2xl border border-cyan-300/10 bg-cyan-300/[.035] px-3 py-2.5 text-center text-[9px] font-bold text-slate-500">\n              Compact app views use the same live website data and actions.\n            </div>`;
  source = replaceRequired(source, menuFooter, logoutBlock, "native More logout button");
  return source;
}, [MARKER, 'data-testid="native-logout-button"', 'const { logout, isLoggingOut } = useAuth();']);

patchFile("client/src/pages/onboarding.tsx", (original) => {
  if (original.includes(MARKER)) return original;
  let source = original;

  source = replaceRequired(
    source,
    'import { Package, ChevronRight, Check, Sparkles, Shield, Swords, Zap, Target, Flame } from "lucide-react";',
    'import { Package, ChevronRight, Check, Sparkles, Shield, Swords, Zap, Target, Flame, LogOut } from "lucide-react";',
    "onboarding logout icon import",
  );
  source = replaceRequired(
    source,
    'import { useLocation } from "wouter";\n',
    'import { useLocation } from "wouter";\nimport { useAuth } from "../hooks/use-auth";\n',
    "onboarding auth hook import",
  );
  source = replaceRequired(
    source,
    'export default function OnboardingPage() {\n  const [, setLocation] = useLocation();',
    `export default function OnboardingPage() {\n  // ${MARKER}: conversion-critical signup stays branded, centered and recoverable on every phone.\n  const [, setLocation] = useLocation();\n  const { logout, isLoggingOut } = useAuth();`,
    "onboarding logout hook",
  );

  source = replaceRequired(
    source,
    '<motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md space-y-6 rounded-[2rem] border border-white/10 bg-black/45 p-6 text-center shadow-2xl backdrop-blur-xl sm:p-8">\n          <div className="space-y-2"><Sparkles className="mx-auto h-12 w-12 text-primary" /><h1 className="text-3xl font-bold text-foreground sm:text-4xl">Welcome to Fantasy Arena</h1><p className="text-muted-foreground">Create your unique manager team name, then choose 5 starter common cards.</p></div>',
    `<motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md space-y-6 rounded-[2rem] border border-fuchsia-300/15 bg-[#070914]/88 p-5 text-center shadow-[0_24px_80px_rgba(0,0,0,.55),0_0_48px_rgba(168,85,247,.08)] backdrop-blur-xl sm:p-8">\n          <div className="flex items-center justify-between gap-3 text-left">\n            <div className="flex min-w-0 items-center gap-2.5">\n              <img src="/brand/fantasy-arena-logo.jpg" alt="Fantasy Arena" className="h-11 w-11 shrink-0 rounded-2xl border border-fuchsia-300/20 object-cover shadow-[0_0_20px_rgba(168,85,247,.16)]" />\n              <div className="min-w-0"><p className="truncate text-[10px] font-black uppercase tracking-[.2em] text-fuchsia-200/80">Fantasy Arena</p><p className="mt-0.5 text-[9px] font-bold uppercase tracking-[.12em] text-cyan-200/50">Free starter setup · Step 1 of 2</p></div>\n            </div>\n            <button type="button" onClick={() => logout()} disabled={isLoggingOut} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[.035] px-2.5 text-[10px] font-bold text-white/55" aria-label="Sign out"><LogOut className="h-3.5 w-3.5" /><span className="hidden sm:inline">Sign out</span></button>\n          </div>\n          <div className="h-1.5 overflow-hidden rounded-full bg-white/[.055]"><div className="h-full w-1/2 rounded-full bg-gradient-to-r from-fuchsia-400 to-cyan-300" /></div>\n          <div className="space-y-2"><Sparkles className="mx-auto h-10 w-10 text-cyan-200" /><h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Create Your Club</h1><p className="text-sm leading-6 text-white/50">Choose your unique club name. Next, pick 5 <strong className="text-white/80">FREE Common starter cards</strong> — one from each position group.</p><div className="flex flex-wrap justify-center gap-1.5 pt-1"><span className="rounded-full border border-emerald-300/15 bg-emerald-300/[.06] px-2 py-1 text-[9px] font-black uppercase tracking-[.12em] text-emerald-200">No payment</span><span className="rounded-full border border-cyan-300/15 bg-cyan-300/[.06] px-2 py-1 text-[9px] font-black uppercase tracking-[.12em] text-cyan-100">5 free cards</span><span className="rounded-full border border-fuchsia-300/15 bg-fuchsia-300/[.06] px-2 py-1 text-[9px] font-black uppercase tracking-[.12em] text-fuchsia-100">Premier League</span></div></div>`,
    "premium team-name signup card",
  );

  source = replaceRequired(
    source,
    '<div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200/80"><Sparkles className="h-3 w-3" />Starter Draft</div>',
    '<div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200/80"><Sparkles className="h-3 w-3" />Starter Draft · Step 2 of 2</div>',
    "starter draft progress label",
  );

  const selectedCounter = `<div className="shrink-0 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-center">\n              <div className="text-[9px] font-black uppercase tracking-[0.14em] text-white/45">Selected</div>\n              <div className="text-xl font-black leading-none text-cyan-200">{selectedCount}<span className="text-sm text-white/35">/{requiredSelections}</span></div>\n            </div>`;
  const selectedCounterWithExit = `<div className="flex shrink-0 items-center gap-2">\n              <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-center">\n                <div className="text-[9px] font-black uppercase tracking-[0.14em] text-white/45">Selected</div>\n                <div className="text-xl font-black leading-none text-cyan-200">{selectedCount}<span className="text-sm text-white/35">/{requiredSelections}</span></div>\n              </div>\n              <button type="button" onClick={() => logout()} disabled={isLoggingOut} className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/[.035] text-white/50" aria-label="Sign out of signup"><LogOut className="h-4 w-4" /></button>\n            </div>`;
  source = replaceRequired(source, selectedCounter, selectedCounterWithExit, "starter draft sign out");
  return source;
}, [MARKER, "Free starter setup · Step 1 of 2", "Starter Draft · Step 2 of 2", 'aria-label="Sign out of signup"']);

console.log("Native logout and signup polish applied: persistent sign-out access, premium 2-step onboarding and small-phone starter card stability.");
