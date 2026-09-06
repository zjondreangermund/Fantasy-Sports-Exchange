import * as React from "react";
import { Download } from "lucide-react";
import { isInstalledMobileApp } from "../lib/site-view";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

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

export default function InstallAppButton() {
  const [, refresh] = React.useReducer((value) => value + 1, 0);
  const [installing, setInstalling] = React.useState(false);

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

  return (
    <button
      type="button"
      onClick={install}
      disabled={installing}
      aria-label="Install Fantasy Arena app"
      title="Install Fantasy Arena app"
      className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-cyan-300/25 bg-cyan-300/10 px-2 text-[11px] font-bold text-cyan-100 hover:bg-cyan-300/15 disabled:opacity-60"
      data-install-app-button
    >
      <Download className="h-4 w-4" />
      <span className="hidden sm:inline">{installing ? "Installing…" : "Install App"}</span>
    </button>
  );
}
