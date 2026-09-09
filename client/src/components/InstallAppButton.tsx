import * as React from "react";
import { Download, Smartphone, X } from "lucide-react";
import { isInstalledMobileApp } from "../lib/site-view";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const ANDROID_APK_BASE_URL =
  "https://github.com/zjondreangermund/Fantasy-Sports-Exchange/releases/download/android-1.1.8/Fantasy-Arena-Android.apk";
const ANDROID_VERSION = "1.1.8";
const ANDROID_SIZE_LABEL = "5.7 MB";
const INSTALL_PROMPT_SNOOZE_KEY = "fantasy_arena_install_prompt_snoozed_until";
const INSTALL_PROMPT_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;
const promptListeners = new Set<() => void>();

function notifyPromptListeners() {
  for (const listener of promptListeners) listener();
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event as BeforeInstallPromptEvent;
    notifyPromptListeners();
  });
  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    notifyPromptListeners();
  });
}

function fallbackInstallInstructions() {
  const ua = String(navigator.userAgent || "").toLowerCase();
  const isIos = /iphone|ipad|ipod/.test(ua);
  if (isIos) {
    window.alert("Install Fantasy Arena: tap the Share button in your browser, then choose Add to Home Screen.");
    return;
  }
  window.alert("Install Fantasy Arena: open your browser menu (⋮) and choose Install app or Add to Home screen.");
}

function freshAndroidApkUrl() {
  const nonce = Date.now();
  return `${ANDROID_APK_BASE_URL}?version=${encodeURIComponent(ANDROID_VERSION)}&nocache=${nonce}`;
}

function installPromptIsSnoozed() {
  try {
    return Number(window.localStorage.getItem(INSTALL_PROMPT_SNOOZE_KEY) || 0) > Date.now();
  } catch {
    return false;
  }
}

export default function InstallAppButton() {
  const [, refresh] = React.useReducer((value) => value + 1, 0);
  const [installing, setInstalling] = React.useState(false);
  const [promptOpen, setPromptOpen] = React.useState(false);
  const isAndroidBrowser = typeof navigator !== "undefined" && /android/i.test(String(navigator.userAgent || ""));
  const installed = isInstalledMobileApp();

  React.useEffect(() => {
    const listener = () => refresh();
    promptListeners.add(listener);
    const media = window.matchMedia?.("(display-mode: standalone)");
    media?.addEventListener?.("change", listener);
    return () => {
      promptListeners.delete(listener);
      media?.removeEventListener?.("change", listener);
    };
  }, []);

  React.useEffect(() => {
    if (installed || installPromptIsSnoozed()) return;
    const timer = window.setTimeout(() => setPromptOpen(true), 1_800);
    return () => window.clearTimeout(timer);
  }, [installed]);

  if (installed) return null;

  const dismissPrompt = () => {
    try { window.localStorage.setItem(INSTALL_PROMPT_SNOOZE_KEY, String(Date.now() + INSTALL_PROMPT_SNOOZE_MS)); } catch { /* storage may be restricted */ }
    setPromptOpen(false);
  };

  const install = async () => {
    if (installing) return;

    if (isAndroidBrowser) {
      setPromptOpen(false);
      window.location.assign(freshAndroidApkUrl());
      return;
    }

    const prompt = deferredInstallPrompt;
    if (!prompt) {
      fallbackInstallInstructions();
      return;
    }

    setInstalling(true);
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === "accepted") setPromptOpen(false);
      deferredInstallPrompt = null;
      notifyPromptListeners();
    } catch {
      fallbackInstallInstructions();
    } finally {
      setInstalling(false);
    }
  };

  const accessibleLabel = isAndroidBrowser
    ? `Install Fantasy Arena Android ${ANDROID_VERSION}, ${ANDROID_SIZE_LABEL}`
    : "Install Fantasy Arena app";

  return (
    <>
      <button
        type="button"
        onClick={install}
        disabled={installing}
        aria-label={accessibleLabel}
        title={accessibleLabel}
        className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-cyan-300/25 bg-cyan-300/10 px-2 text-[11px] font-bold text-cyan-100 hover:bg-cyan-300/15 disabled:opacity-60"
        data-install-app-button
        data-android-version={isAndroidBrowser ? ANDROID_VERSION : undefined}
        data-android-size={isAndroidBrowser ? ANDROID_SIZE_LABEL : undefined}
      >
        <Download className="h-4 w-4" />
        <span className="hidden sm:inline">{installing ? "Installing…" : "Install App"}</span>
      </button>

      {promptOpen ? (
        <div className="fixed inset-0 z-[220] flex items-end justify-center bg-black/75 p-3 backdrop-blur-md sm:items-center" role="dialog" aria-modal="true" aria-label="Install Fantasy Arena" data-install-app-popup>
          <button type="button" className="absolute inset-0 cursor-default" onClick={dismissPrompt} aria-label="Close install prompt" />
          <section className="relative z-10 w-full max-w-md overflow-hidden rounded-[1.75rem] border border-cyan-300/25 bg-[#070b18] p-5 text-white shadow-[0_28px_100px_rgba(0,0,0,.72),0_0_50px_rgba(34,211,238,.12)]">
            <button type="button" onClick={dismissPrompt} className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5 text-white/70" aria-label="Close install prompt"><X className="h-4 w-4" /></button>
            <div className="grid h-14 w-14 place-items-center rounded-2xl border border-fuchsia-300/20 bg-gradient-to-br from-fuchsia-400/15 to-cyan-300/10 text-cyan-100 shadow-[0_0_24px_rgba(139,92,246,.18)]"><Smartphone className="h-6 w-6" /></div>
            <p className="mt-4 text-[10px] font-black uppercase tracking-[.2em] text-cyan-200/70">Fantasy Arena App</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight">Install the app</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">Get the full-screen Fantasy Arena experience, faster access and native notifications for tournaments, prizes and important account updates.</p>
            {isAndroidBrowser ? <p className="mt-3 rounded-2xl border border-emerald-300/12 bg-emerald-300/[.05] px-3 py-2 text-xs text-emerald-100">Android app {ANDROID_VERSION} · {ANDROID_SIZE_LABEL}</p> : null}
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" onClick={dismissPrompt} className="h-11 rounded-2xl border border-white/10 bg-white/[.04] text-sm font-black text-white/75">Not now</button>
              <button type="button" onClick={install} disabled={installing} className="h-11 rounded-2xl bg-gradient-to-r from-cyan-300 via-sky-300 to-violet-400 px-3 text-sm font-black text-slate-950 shadow-[0_0_30px_rgba(34,211,238,.25)] disabled:opacity-60">{installing ? "Installing…" : isAndroidBrowser ? "Download App" : "Install App"}</button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
