import * as React from "react";
import { ExternalLink, Home, RefreshCcw, RotateCcw } from "lucide-react";

type Props = {
  children: React.ReactNode;
  routeKey: string;
};

type State = {
  error: Error | null;
};

const CHUNK_ERROR = /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i;

export default class NativeRouteBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    const route = this.props.routeKey || window.location.pathname;
    const isChunkFailure = CHUNK_ERROR.test(String(error?.message || error));

    try {
      fetch("/api/audit/client-event", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "native_route_error",
          path: route,
          title: document.title,
          ts: new Date().toISOString(),
          detail: String(error?.message || error).slice(0, 500),
          chunkFailure: isChunkFailure,
        }),
      }).catch(() => {});
    } catch {
      // Recovery UI must never fail because telemetry failed.
    }

    if (isChunkFailure) {
      try {
        const key = `fa_native_chunk_retry:${route}`;
        if (window.sessionStorage.getItem(key) !== "1") {
          window.sessionStorage.setItem(key, "1");
          window.setTimeout(() => window.location.reload(), 80);
        }
      } catch {
        // If storage is blocked, keep the visible recovery controls instead.
      }
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    const route = this.props.routeKey || window.location.pathname || "/";
    const canOpenWebsiteView = route !== "/" && route !== "/dashboard";
    const fullRoute = `${route}${route.includes("?") ? "&" : "?"}nativeFull=1`;

    return (
      <div className="mx-auto flex min-h-[58dvh] w-full max-w-md items-center px-4 py-8 text-white">
        <section className="w-full overflow-hidden rounded-[1.8rem] border border-fuchsia-300/20 bg-[radial-gradient(circle_at_10%_0%,rgba(192,76,255,.22),transparent_34%),radial-gradient(circle_at_95%_5%,rgba(38,190,255,.18),transparent_32%),linear-gradient(145deg,#100a22,#060914)] p-5 text-center shadow-[0_24px_60px_rgba(0,0,0,.5)]">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-fuchsia-300/15 bg-gradient-to-br from-fuchsia-400/15 to-cyan-300/10 text-cyan-100 shadow-[0_0_22px_rgba(139,92,246,.12)]"><RotateCcw className="h-5 w-5" /></div>
          <p className="mt-4 text-[10px] font-black uppercase tracking-[.2em] text-fuchsia-200/70">Arena recovery</p>
          <h2 className="mt-1 text-xl font-black">This zone did not load properly</h2>
          <p className="mt-2 text-xs leading-5 text-slate-400">Your account and game data are safe. Retry the compact app screen, or open the same live website page.</p>
          <div className={`mt-5 grid gap-2 ${canOpenWebsiteView ? "grid-cols-1" : "grid-cols-2"}`}>
            <button onClick={() => window.location.reload()} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-500 to-cyan-400 px-3 py-3 text-xs font-black text-white shadow-[0_0_22px_rgba(139,92,246,.16)]"><RefreshCcw className="h-4 w-4" />Retry app screen</button>
            {canOpenWebsiteView ? <button onClick={() => { window.location.href = fullRoute; }} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-300/20 bg-cyan-300/[.06] px-3 py-3 text-xs font-black text-cyan-50"><ExternalLink className="h-4 w-4" />Open live website view</button> : null}
            <button onClick={() => { window.location.href = "/"; }} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[.04] px-3 py-3 text-xs font-black"><Home className="h-4 w-4" />Arena HQ</button>
          </div>
        </section>
      </div>
    );
  }
}
