import * as React from "react";
import { Download, RefreshCw, ShieldCheck, Sparkles, X } from "lucide-react";
import PushNotificationControl from "../PushNotificationControl";
import { useNativeFullRouteBridge } from "./NativeFullRouteBridge";

const RELEASES_API = "https://api.github.com/repos/zjondreangermund/Fantasy-Sports-Exchange/releases?per_page=20";
const CACHE_KEY = "fantasy-arena-native-update-v1";
const CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000;

type AndroidRelease = {
  version: string;
  title: string;
  notes: string;
  downloadUrl: string;
  required: boolean;
};

type CachedUpdate = {
  checkedAt: number;
  currentVersion: string;
  release: AndroidRelease | null;
};

function parseVersion(value: unknown): number[] | null {
  const match = String(value || "").match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
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

function minimumSupportedVersion(body: string) {
  const marker = String(body || "").match(/(?:fantasy-arena:min-version=|minimum-supported:\s*)(\d+\.\d+\.\d+)/i);
  return marker?.[1] || null;
}

function releaseFromApi(releases: any[], currentVersion: string): AndroidRelease | null {
  const candidates = (Array.isArray(releases) ? releases : [])
    .filter((release) => !release?.draft && !release?.prerelease)
    .map((release) => {
      const version = String(release?.tag_name || "").match(/^android-(\d+\.\d+\.\d+)$/i)?.[1];
      if (!version || !parseVersion(version)) return null;
      const asset = Array.isArray(release?.assets)
        ? release.assets.find((item: any) => String(item?.name || "").toLowerCase() === "fantasy-arena-android.apk")
        : null;
      if (!asset?.browser_download_url) return null;
      const minVersion = minimumSupportedVersion(String(release?.body || ""));
      return {
        version,
        title: String(release?.name || `Fantasy Arena Android ${version}`),
        notes: String(release?.body || "").replace(/<!--.*?-->/gs, "").trim(),
        downloadUrl: String(asset.browser_download_url),
        required: Boolean(minVersion && compareVersions(currentVersion, minVersion) < 0),
      } satisfies AndroidRelease;
    })
    .filter(Boolean) as AndroidRelease[];

  candidates.sort((a, b) => compareVersions(b.version, a.version));
  const newest = candidates[0];
  if (!newest || compareVersions(newest.version, currentVersion) <= 0) return null;
  return newest;
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
    // Update checks are best-effort and must never block the app.
  }
}

export default function NativeAppUpdatePrompt() {
  useNativeFullRouteBridge();
  const currentVersion = React.useMemo(installedVersion, []);
  const [release, setRelease] = React.useState<AndroidRelease | null>(null);
  const [dismissed, setDismissed] = React.useState(false);

  React.useEffect(() => {
    if (!currentVersion) return;
    const cached = readCache(currentVersion);
    if (cached) {
      setRelease(cached.release);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(RELEASES_API, {
          headers: { Accept: "application/vnd.github+json" },
          signal: controller.signal,
        });
        if (!response.ok) return;
        const data = await response.json();
        const nextRelease = releaseFromApi(data, currentVersion);
        writeCache({ checkedAt: Date.now(), currentVersion, release: nextRelease });
        setRelease(nextRelease);
      } catch {
        // A network or GitHub API failure should leave gameplay unaffected.
      }
    }, 1200);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [currentVersion]);

  const showUpdate = Boolean(currentVersion && release && !(dismissed && !release.required));
  const notes = release
    ? release.notes
      .split(/\r?\n/)
      .map((line) => line.replace(/^[-*#\s]+/, "").trim())
      .filter(Boolean)
      .slice(0, 2)
      .join(" ")
    : "";

  const updateNow = () => {
    if (!release) return;
    const opened = window.open(release.downloadUrl, "_blank", "noopener,noreferrer");
    if (!opened) window.location.assign(release.downloadUrl);
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
            {!release.required ? (
              <button type="button" onClick={() => setDismissed(true)} className="absolute right-4 top-4 z-10 grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-black/25 text-slate-400" aria-label="Update later">
                <X className="h-4 w-4" />
              </button>
            ) : null}

            <div className="relative">
              <div className="mb-4 flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
                  {release.required ? <RefreshCw className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[.22em] text-cyan-200/70">Fantasy Arena Android</p>
                  <h2 className="mt-0.5 text-xl font-black text-white">{release.required ? "Update required" : "Update available"}</h2>
                </div>
              </div>

              <div className="rounded-2xl border border-white/[.07] bg-white/[.035] p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-bold text-white">Version {release.version}</span>
                  <span className="rounded-full bg-cyan-300/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-cyan-200">Installed {currentVersion}</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {notes || "A newer Fantasy Arena Android build is ready with app improvements and fixes."}
                </p>
              </div>

              <div className="mt-4 flex items-start gap-2 rounded-2xl border border-emerald-300/10 bg-emerald-300/[.04] p-3 text-xs leading-5 text-slate-400">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                <span>The download opens the verified Fantasy Arena Android release. Android will ask you to confirm the app update.</span>
              </div>

              <button type="button" onClick={updateNow} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-300 to-violet-400 px-4 text-sm font-black text-slate-950 shadow-[0_0_30px_rgba(34,211,238,.16)] active:scale-[.99]">
                <Download className="h-5 w-5" />
                Update Fantasy Arena
              </button>
              {!release.required ? (
                <button type="button" onClick={() => setDismissed(true)} className="mt-2 min-h-11 w-full rounded-2xl text-sm font-bold text-slate-500 active:text-slate-300">
                  Later
                </button>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
