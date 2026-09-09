import * as React from "react";
import { Download } from "lucide-react";
import { isInstalledMobileApp } from "../lib/site-view";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const ANDROID_APK_BASE_URL =
  "https://github.com/zjondreangermund/Fantasy-Sports-Exchange/releases/download/android-1.1.6/Fantasy-Arena-Android.apk";
const ANDROID_VERSION = "1.1.6";
const ANDROID_SIZE_LABEL = "5.7 MB";

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

export default function InstallAppButton() {
  const [, refresh] = React.useReducer((value) => value + 1, 0);
  const [installing, setInstalling] = React.useState(false);
  const isAndroidBrowser = typeof navigator !== "undefined" && /android/i.test(String(navigator.userAgent || ""));

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

  if (isInstalledMobileApp()) return null;

  const install = async () => {
    if (installing) return;

    if (isAndroidBrowser) {
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
      await prompt.userChoice;
      deferredInstallPrompt = null;
      notifyPromptListeners();
    } catch {
      fallbackInstallInstructions();
    } finally {
      setInstalling(false);
    }
  };

  const label = isAndroidBrowser ? `Download ${ANDROID_VERSION}` : installing ? "Installing…" : "Install App";
  const accessibleLabel = isAndroidBrowser
    ? `Download Fantasy Arena Android ${ANDROID_VERSION}, ${ANDROID_SIZE_LABEL}`
    : "Install Fantasy Arena app";

  return (
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
      <span className={isAndroidBrowser ? "inline" : "hidden sm:inline"}>{label}</span>
    </button>
  );
}
