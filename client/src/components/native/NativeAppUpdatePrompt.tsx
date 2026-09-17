import * as React from "react";
import { Loader2, RefreshCw, ShieldCheck, Sparkles, X } from "lucide-react";
import PushNotificationControl from "../PushNotificationControl";
import { useNativeFullRouteBridge } from "./NativeFullRouteBridge";

const RELEASES_API = "/api/android/releases/latest";
const CACHE_KEY = "fantasy-arena-native-update-v2";
const CACHE_MAX_AGE_MS = 30 * 60 * 1000;

type AndroidRelease = {
  version: string;
  name: string;
  notes: string;
};

type CachedUpdate = {
  checkedAt: number;
  currentVersion: string;
  release: AndroidRelease | null;
};

type UpdateState = {
  state: "idle" | "downloading" | "permission_required" | "ready" | "error";
  message: string;
};

function parseVersion(value: unknown): number[] | null {
  const match = String(value || "").match(/^(\d+)\.(\d+)\.(\d+)$/);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

function compareVersions(left: string, right: string) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  if (!a || !b) return 0;
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] > b[index] ? 1 : -1;
  }
  return 0;
}

function installedVersion() {
  if (typeof navigator === "undefined") return null;
  return String(navigator.userAgent || "").match(/FantasyArenaNative\/(\d+\.\d+\.\d+)/i)?.[1] || null;
}

function nativeUpdater() {
  if (typeof window === "undefined") return null;
  const updater = (window as any).FantasyArenaUpdater;
  return updater && typeof updater.installLatestUpdate === "function" ? updater : null;
}

function readCache(currentVersion: string): CachedUpdate | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedUpdate;
    if (parsed.currentVersion !== currentVersion) return null;
    if (!Number.isFinite(parsed.checkedAt) || Date.now() - parsed.checkedAt > CACHE_MAX_AGE_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(value: CachedUpdate) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(value));
  } catch {
    // Update checks are best-effort and must never block gameplay.
  }
}

function clearForcedUpdateFlag() {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("appUpdate")) return;
    url.searchParams.delete("appUpdate");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  } catch {
    // Query cleanup must never affect app startup.
  }
}

export default function NativeAppUpdatePrompt() {
  useNativeFullRouteBridge();
  const currentVersion = React.useMemo(installedVersion, []);
  const updaterAvailable = React.useMemo(() => Boolean(nativeUpdater()), []);
  const [release, setRelease] = React.useState<AndroidRelease | null>(null);
  const [dismissed, setDismissed] = React.useState(false);
  const [updateState, setUpdateState] = React.useState<UpdateState>({ state: "idle", message: "" });

  React.useEffect(() => {
    // 1.1.9/1.1.10 do not contain the native updater bridge. Do not expose the
    // old browser/GitHub download path while the migration build is being tested.
    if (!currentVersion) return;
    if (!updaterAvailable) return;
    const cached = readCache(currentVersion);
    if (cached) {
      setRelease(cached.release);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(RELEASES_API, { signal: controller.signal, credentials: "include" });
        if (!response.ok) return;
        const body = await response.json();
        const candidate = parseVersion(body?.version)
          ? { version: String(body.version), name: String(body?.name || `Fantasy Arena Android ${body.version}`), notes: String(body?.notes || "") }
          : null;
        const nextRelease = candidate && compareVersions(candidate.version, currentVersion) > 0 ? candidate : null;
        writeCache({ checkedAt: Date.now(), currentVersion, release: nextRelease });
        setRelease(nextRelease);
      } catch {
        // Network/update service failure leaves gameplay unaffected.
      }
    }, 1000);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [currentVersion, updaterAvailable]);

  React.useEffect(() => {
    if (!updaterAvailable) return;
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<any>).detail || {};
      const state = String(detail.state || "idle") as UpdateState["state"];
      const message = String(detail.message || "");
      if (["downloading", "permission_required", "ready", "error", "idle"].includes(state)) {
        setUpdateState({ state, message });
      }
    };
    window.addEventListener("fantasy-arena:update-state", listener as EventListener);
    return () => window.removeEventListener("fantasy-arena:update-state", listener as EventListener);
  }, [updaterAvailable]);

  React.useEffect(() => {
    if (!release) clearForcedUpdateFlag();
  }, [release]);

  const showUpdate = Boolean(currentVersion && updaterAvailable && release && !dismissed);
  const busy = updateState.state === "downloading" || updateState.state === "ready";
  const notes = release
    ? release.notes.split(/\r?\n/).map((line) => line.replace(/^[-*#\s]+/, "").trim()).filter(Boolean).slice(0, 2).join(" ")
    : "";

  const updateNow = () => {
    const updater = nativeUpdater();
    if (!updater || busy) return;
    setUpdateState({ state: "downloading", message: "Preparing the verified Fantasy Arena update…" });
    updater.installLatestUpdate();
  };

  return (
    <>
      <div className="absolute right-[4.45rem] top-[calc(env(safe-area-inset-top,0px)+0.72rem)] z-[65] [&_span]:hidden" data-native-alert-control>
        <PushNotificationControl />
      </div>

      {showUpdate && release ? (
        <div className="absolute inset-0 z-[120] flex items-end bg-black/75 px-3 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-8 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Fantasy Arena app update">
          <section className="relative w-full overflow-hidden rounded-[2rem] border border-cyan-300/20 bg-[#0a0d1c] p-5 shadow-[0_2rem_6rem_rgba(0,0,0,.7)]">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_25%_0%,rgba(34,211,238,.18),transparent_48%),radial-gradient(circle_at_85%_0%,rgba(139,92,246,.2),transparent_50%)]" />
            {!busy ? (
              <button type="button" onClick={() => setDismissed(true)} className="absolute right-4 top-4 z-10 grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-black/25 text-slate-400" aria-label="Update later">
                <X className="h-4 w-4" />
              </button>
            ) : null}

            <div className="relative">
              <div className="mb-4 flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
                  {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <Sparkles className="h-6 w-6" />}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[.22em] text-cyan-200/70">Fantasy Arena Android</p>
                  <h2 className="mt-0.5 text-xl font-black text-white">{busy ? "Preparing update" : "Update available"}</h2>
                </div>
              </div>

              <div className="rounded-2xl border border-white/[.07] bg-white/[.035] p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-bold text-white">Version {release.version}</span>
                  <span className="rounded-full bg-cyan-300/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-cyan-200">Installed {currentVersion}</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-400">{notes || "A newer Fantasy Arena Android build is ready."}</p>
              </div>

              <div className="mt-4 flex items-start gap-2 rounded-2xl border border-emerald-300/10 bg-emerald-300/[.04] p-3 text-xs leading-5 text-slate-400">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                <span>Fantasy Arena downloads and verifies the update inside the app. Your browser and GitHub will not open. Android only asks you to confirm the final app update.</span>
              </div>

              {updateState.message ? (
                <p className={`mt-3 rounded-xl px-3 py-2 text-xs leading-5 ${updateState.state === "error" ? "bg-rose-400/10 text-rose-200" : updateState.state === "permission_required" ? "bg-amber-300/10 text-amber-100" : "bg-cyan-300/[.06] text-cyan-100"}`}>
                  {updateState.message}
                </p>
              ) : null}

              <button type="button" onClick={updateNow} disabled={busy} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-300 to-violet-400 px-4 text-sm font-black text-slate-950 shadow-[0_0_30px_rgba(34,211,238,.16)] disabled:opacity-60 active:scale-[.99]">
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5" />}
                {busy ? "Preparing Update…" : "Update Fantasy Arena"}
              </button>
              {!busy ? (
                <button type="button" onClick={() => setDismissed(true)} className="mt-2 min-h-11 w-full rounded-2xl text-sm font-bold text-slate-500 active:text-slate-300">Later</button>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
