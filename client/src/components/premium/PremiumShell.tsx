import type { ReactNode } from "react";
import { ArrowRight, Sparkles } from "lucide-react";

export function PremiumPage({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <main className={`premium-page relative min-h-full overflow-x-hidden px-3 pb-6 pt-4 text-white sm:px-6 lg:px-8 ${className}`}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(124,58,237,.24),transparent_34%),radial-gradient(circle_at_82%_8%,rgba(14,165,233,.16),transparent_32%),linear-gradient(180deg,rgba(2,6,23,.08),rgba(2,6,23,.72))]" />
      <div className="relative mx-auto max-w-7xl space-y-5">{children}</div>
    </main>
  );
}

export function PremiumHero({ eyebrow, title, subtitle, children }: { eyebrow: string; title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <section className="fa-premium-panel relative overflow-hidden rounded-[2rem] p-4 sm:p-6">
      <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-16 bottom-[-8rem] h-72 w-72 rounded-full bg-violet-500/14 blur-3xl" />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[.07] px-3 py-1 text-[10px] font-black uppercase tracking-[.22em] text-cyan-100">
            <Sparkles className="h-3.5 w-3.5 text-cyan-200" />
            {eyebrow}
          </div>
          <h1 className="fa-page-title fa-chrome-text mt-3 text-3xl font-black sm:text-5xl">{title}</h1>
          {subtitle ? <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">{subtitle}</p> : null}
        </div>
        {children ? <div className="relative">{children}</div> : null}
      </div>
    </section>
  );
}

export function PremiumStat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,.08)]">
      <p className="text-[10px] font-black uppercase tracking-[.16em] text-white/45">{label}</p>
      <p className="mt-1 truncate text-lg font-black text-white">{value}</p>
      {hint ? <p className="mt-1 truncate text-[10px] font-bold text-white/35">{hint}</p> : null}
    </div>
  );
}

export function PremiumPanel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`fa-premium-panel rounded-[1.75rem] p-4 sm:p-5 ${className}`}>{children}</section>;
}

export function PremiumCTA({ children, onClick, disabled = false }: { children: ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="fa-premium-button inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black uppercase tracking-[.1em] text-white disabled:cursor-not-allowed disabled:opacity-50">
      <span className="relative">{children}</span>
      <ArrowRight className="relative h-4 w-4" />
    </button>
  );
}

export function PremiumSectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h2 className="text-xl font-black tracking-tight text-white">{title}</h2>
      {subtitle ? <p className="mt-1 text-sm text-white/45">{subtitle}</p> : null}
    </div>
  );
}
