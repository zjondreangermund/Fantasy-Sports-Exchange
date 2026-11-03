import * as React from "react";

type Props = { children: React.ReactNode; scope: string; optional?: boolean };
type State = { failed: boolean; retryKey: number; chunkError: boolean };

const STALE_BUNDLE_ERROR = /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i;

/** Isolate a failing page or optional overlay without restarting the whole app. */
export default class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { failed: false, retryKey: 0, chunkError: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { failed: true, chunkError: STALE_BUNDLE_ERROR.test(String(error?.message || error)) };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[Fantasy Arena ${this.props.scope}]`, error, info.componentStack);
    try {
      void fetch("/api/audit/client-event", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "app_render_error", path: window.location.pathname,
          title: document.title, ts: new Date().toISOString(),
          detail: `${this.props.scope}: ${String(error?.message || error)}`.slice(0, 500),
          componentStack: String(info.componentStack || "").slice(0, 1200),
        }),
      }).catch(() => {});
    } catch { /* Diagnostics must never prevent recovery. */ }
  }

  private retrySection = () => {
    this.setState((previous) => ({ failed: false, chunkError: false, retryKey: previous.retryKey + 1 }));
  };

  render() {
    if (!this.state.failed) return <React.Fragment key={this.state.retryKey}>{this.props.children}</React.Fragment>;
    if (this.props.optional) return null;
    return <main role="alert" className="flex min-h-[45dvh] w-full items-center justify-center p-5 text-white">
      <section className="w-full max-w-sm rounded-3xl border border-cyan-300/25 bg-slate-900 p-6 text-center">
        <h1 className="text-xl font-black">This Arena screen had a problem</h1>
        <p className="mt-3 text-sm text-slate-300">Your account, cards and tournament progress are saved online. Other Arena sections remain available.</p>
        <button type="button" onClick={this.retrySection} className="mt-5 min-h-12 w-full rounded-xl bg-cyan-300 px-4 font-bold text-slate-950">Retry this screen</button>
        {this.state.chunkError
          ? <button type="button" onClick={() => window.location.reload()} className="mt-2 min-h-11 w-full rounded-xl border border-white/20 text-sm font-semibold text-white">Load latest app version</button>
          : null}
        <a href="/" className="mt-3 block min-h-11 py-3 text-cyan-200">Return to Arena HQ</a>
      </section>
    </main>;
  }
}
