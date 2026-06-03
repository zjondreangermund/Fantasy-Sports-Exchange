import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

type LivePageTone =
  | "stadium"
  | "arena"
  | "vault"
  | "trading"
  | "wallet"
  | "admin"
  | "profile";

const toneClasses: Record<LivePageTone, string> = {
  stadium: "from-emerald-950 via-slate-950 to-sky-950 before:bg-[radial-gradient(circle_at_18%_20%,rgba(34,197,94,0.22),transparent_32%),radial-gradient(circle_at_82%_10%,rgba(56,189,248,0.18),transparent_28%),linear-gradient(120deg,rgba(255,255,255,0.04)_1px,transparent_1px)]",
  arena: "from-amber-950 via-slate-950 to-red-950 before:bg-[radial-gradient(circle_at_50%_0%,rgba(251,191,36,0.24),transparent_28%),radial-gradient(circle_at_10%_80%,rgba(239,68,68,0.16),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.045)_1px,transparent_1px)]",
  vault: "from-violet-950 via-slate-950 to-indigo-950 before:bg-[radial-gradient(circle_at_20%_10%,rgba(168,85,247,0.22),transparent_28%),radial-gradient(circle_at_85%_70%,rgba(99,102,241,0.20),transparent_30%),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)]",
  trading: "from-cyan-950 via-slate-950 to-emerald-950 before:bg-[radial-gradient(circle_at_20%_30%,rgba(6,182,212,0.22),transparent_30%),radial-gradient(circle_at_90%_20%,rgba(16,185,129,0.16),transparent_28%),linear-gradient(115deg,rgba(34,211,238,0.08)_1px,transparent_1px)]",
  wallet: "from-lime-950 via-slate-950 to-yellow-950 before:bg-[radial-gradient(circle_at_16%_20%,rgba(132,204,22,0.18),transparent_28%),radial-gradient(circle_at_80%_15%,rgba(234,179,8,0.16),transparent_30%),linear-gradient(145deg,rgba(255,255,255,0.04)_1px,transparent_1px)]",
  admin: "from-slate-950 via-zinc-950 to-rose-950 before:bg-[radial-gradient(circle_at_20%_20%,rgba(244,63,94,0.18),transparent_28%),radial-gradient(circle_at_80%_10%,rgba(148,163,184,0.16),transparent_26%),linear-gradient(120deg,rgba(255,255,255,0.035)_1px,transparent_1px)]",
  profile: "from-blue-950 via-slate-950 to-purple-950 before:bg-[radial-gradient(circle_at_18%_20%,rgba(59,130,246,0.20),transparent_30%),radial-gradient(circle_at_80%_18%,rgba(147,51,234,0.17),transparent_28%),linear-gradient(130deg,rgba(255,255,255,0.04)_1px,transparent_1px)]",
};

export function LivePageShell({
  tone,
  children,
  className,
}: {
  tone: LivePageTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex-1 overflow-auto bg-gradient-to-br p-4 text-foreground sm:p-6 lg:p-8",
        "before:pointer-events-none before:absolute before:inset-0 before:bg-[length:140px_140px] before:opacity-100",
        "after:pointer-events-none after:absolute after:inset-x-0 after:top-0 after:h-48 after:bg-gradient-to-b after:from-white/8 after:to-transparent",
        toneClasses[tone],
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(2,6,23,0.08),rgba(2,6,23,0.72))]" />
      <div className="relative z-10 mx-auto max-w-7xl space-y-6">{children}</div>
    </div>
  );
}

export function LiveHero({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.055] p-5 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-7">
      <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.28em] text-white/55">{eyebrow}</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm text-white/62 sm:text-base">{description}</p>
        </div>
        {children && <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">{children}</div>}
      </div>
    </div>
  );
}

export function LiveStatCard({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/24 p-4 backdrop-blur-md">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/45">{label}</p>
      <p className="mt-1 text-2xl font-black text-white">{value}</p>
      {helper && <p className="mt-1 text-xs text-white/45">{helper}</p>}
    </div>
  );
}
