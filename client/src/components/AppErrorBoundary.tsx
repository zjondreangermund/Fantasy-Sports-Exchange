import * as React from "react";

type Props = { children: React.ReactNode; scope: string; optional?: boolean };

/** Keep delayed popup/API render failures from unmounting the entire app. */
export default class AppErrorBoundary extends React.Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[Fantasy Arena ${this.props.scope}]`, error, info.componentStack);
    try {
      void fetch("/api/audit/client-event", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "app_render_error", path: window.location.pathname,
          title: document.title, ts: new Date().toISOString(),
          detail: `${this.props.scope}: ${String(error?.message || error)}`.slice(0, 500) }),
      }).catch(() => {});
    } catch { /* Diagnostics must not prevent recovery. */ }
  }

  render() {
    if (!this.state.failed) return this.props.children;
    if (this.props.optional) return null;
    return <main role="alert" className="flex min-h-[100dvh] items-center justify-center bg-[#050817] p-6 text-white">
      <section className="w-full max-w-sm rounded-3xl border border-cyan-300/25 bg-slate-900 p-6 text-center">
        <h1 className="text-2xl font-black">Let’s reopen Fantasy Arena</h1>
        <p className="mt-3 text-sm text-slate-300">This screen could not load. Your cards and tournament progress are saved online.</p>
        <button type="button" onClick={() => window.location.reload()} className="mt-5 min-h-12 w-full rounded-xl bg-cyan-300 px-4 font-bold text-slate-950">Reload Arena</button>
        <a href="/" className="mt-4 block min-h-11 text-cyan-200">Return to Arena HQ</a>
      </section>
    </main>;
  }
}
