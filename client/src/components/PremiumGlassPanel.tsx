import * as React from "react";
import { cn } from "../lib/utils";

type PremiumGlassPanelProps = React.HTMLAttributes<HTMLDivElement> & {
  eyebrow?: string;
  title?: string;
  description?: string;
};

export default function PremiumGlassPanel({
  eyebrow,
  title,
  description,
  className,
  children,
  ...props
}: PremiumGlassPanelProps) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/70 p-5 shadow-2xl shadow-black/30 backdrop-blur-xl",
        "before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_20%_0%,rgba(125,211,252,0.14),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.09),transparent_38%)] before:opacity-90",
        "after:pointer-events-none after:absolute after:inset-x-6 after:top-0 after:h-px after:bg-gradient-to-r after:from-transparent after:via-white/40 after:to-transparent",
        className,
      )}
      {...props}
    >
      <div className="relative z-10">
        {(eyebrow || title || description) && (
          <div className="mb-4">
            {eyebrow && <p className="text-xs font-black uppercase tracking-[0.26em] text-cyan-200/70">{eyebrow}</p>}
            {title && <h2 className="mt-2 text-2xl font-black text-white">{title}</h2>}
            {description && <p className="mt-1 max-w-3xl text-sm text-slate-400">{description}</p>}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}
