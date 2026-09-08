import * as React from "react";
import { Home, RefreshCcw, RotateCcw } from "lucide-react";

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

    return (
      <div className="mx-auto flex min-h-[58dvh] w-full max-w-md items-center px-4 py-8 text-white">
        <section className="w-full rounded-[1.8rem] border border-white/[.08] bg-gradient-to-br from-[#11162a] via-[#090d19] to-violet-400/[.08] p-5 text-center shadow-2xl">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-violet-300/10 text-violet-200"><RotateCcw className="h-5 w-5" /></div>
          <p className="mt-4 text-[10px] font-black uppercase tracking-[.2em] text-violet-200/65">Fantasy Arena recovery</p>
          <h2 className="mt-1 text-xl font-black">This section did not load properly</h2>
          <p className="mt-2 text-xs leading-5 text-slate-500">Your account and game data are safe. Reload this section or return to Matchday HQ.</p>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <button onClick={() => window.location.reload()} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-3 py-3 text-xs font-black text-slate-950"><RefreshCcw className="h-4 w-4" />Retry</button>
            <button onClick={() => { window.location.href = "/"; }} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-xs font-black"><Home className="h-4 w-4" />Home</button>
          </div>
        </section>
      </div>
    );
  }
}
