import * as React from "react";
import { Download, Smartphone, X } from "lucide-react";
import { isInstalledMobileApp } from "../lib/site-view";

const ANDROID_APK_BASE_URL = "https://playfantasyarena.com/api/android/update/apk";
const ANDROID_VERSION = "1.1.11";
const ANDROID_SIZE_LABEL = "about 6 MB";
const INSTALL_PROMPT_SNOOZE_KEY = "fantasy_arena_install_prompt_snoozed_until";
const INSTALL_PROMPT_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

// APK-only policy: the browser beforeinstallprompt flow is intentionally not used.
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
  const [installing, setInstalling] = React.useState(false);
  const [promptOpen, setPromptOpen] = React.useState(false);
  const installed = isInstalledMobileApp();
  const isAndroidBrowser = typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);

  React.useEffect(() => {
    if (installed || installPromptIsSnoozed()) return;
    const timer = window.setTimeout(() => setPromptOpen(true), 1_800);
    return () => window.clearTimeout(timer);
  }, [installed]);

  if (installed) return null;

  const dismissPrompt = () => {
    try {
      window.localStorage.setItem(
        INSTALL_PROMPT_SNOOZE_KEY,
        String(Date.now() + INSTALL_PROMPT_SNOOZE_MS),
      );
    } catch {
      // Storage may be restricted.
    }
    setPromptOpen(false);
  };

  const downloadApk = () => {
    if (installing) return;
    setInstalling(true);
    if (isAndroidBrowser) {
      setPromptOpen(false);
      window.location.assign(freshAndroidApkUrl());
      return;
    }
    setPromptOpen(false);
    window.location.assign(freshAndroidApkUrl());
  };

  const accessibleLabel = `Download Fantasy Arena Android ${ANDROID_VERSION}, ${ANDROID_SIZE_LABEL}`;

  return (
    <>
      <button
        type="button"
        onClick={downloadApk}
        disabled={installing}
        aria-label={accessibleLabel}
        title={accessibleLabel}
        className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-cyan-300/25 bg-cyan-300/10 px-2 text-[11px] font-bold text-cyan-100 hover:bg-cyan-300/15 disabled:opacity-60"
        data-install-app-button
        data-install-method="apk"
        data-android-version={ANDROID_VERSION}
        data-android-size={ANDROID_SIZE_LABEL}
      >
        <Download className="h-4 w-4" />
        <span>{installing ? "Downloading…" : "Install APK"}</span>
      </button>

      {promptOpen ? (
        <div
          className="fixed inset-0 z-[220] flex items-end justify-center bg-black/75 p-3 backdrop-blur-md sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Install Fantasy Arena APK"
          data-install-app-popup
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            onClick={dismissPrompt}
            aria-label="Close install prompt"
          />
          <section className="relative z-10 w-full max-w-md overflow-hidden rounded-[1.75rem] border border-cyan-300/25 bg-[#070b18] p-5 text-white shadow-[0_28px_100px_rgba(0,0,0,.72),0_0_50px_rgba(34,211,238,.12)]">
            <button
              type="button"
              onClick={dismissPrompt}
              className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5 text-white/70"
              aria-label="Close install prompt"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="grid h-14 w-14 place-items-center rounded-2xl border border-fuchsia-300/20 bg-gradient-to-br from-fuchsia-400/15 to-cyan-300/10 text-cyan-100 shadow-[0_0_24px_rgba(139,92,246,.18)]">
              <Smartphone className="h-6 w-6" />
            </div>
            <p className="mt-4 text-[10px] font-black uppercase tracking-[.2em] text-cyan-200/70">Fantasy Arena APK</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight">Install the Android app</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Download the official Fantasy Arena APK for the full-screen Android experience and native notifications.
            </p>
            <p className="mt-3 rounded-2xl border border-emerald-300/12 bg-emerald-300/[.05] px-3 py-2 text-xs text-emerald-100">
              Android app {ANDROID_VERSION} · {ANDROID_SIZE_LABEL}
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={dismissPrompt}
                className="h-11 rounded-2xl border border-white/10 bg-white/[.04] text-sm font-black text-white/75"
              >
                Not now
              </button>
              <button
                type="button"
                onClick={downloadApk}
                disabled={installing}
                className="h-11 rounded-2xl bg-gradient-to-r from-cyan-300 via-sky-300 to-violet-400 px-3 text-sm font-black text-slate-950 shadow-[0_0_30px_rgba(34,211,238,.25)] disabled:opacity-60"
              >
                {installing ? "Downloading…" : "Download APK"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
