import { cn } from "../../lib/utils";

type RealisticLightingVariant = "stadium" | "arena" | "vault" | "trading" | "wallet" | "admin" | "profile";

const variantLens: Record<RealisticLightingVariant, string> = {
  stadium: "bg-emerald-300/20 left-[8%] top-[2%]",
  arena: "bg-amber-300/20 left-[42%] top-[-3%]",
  vault: "bg-violet-300/20 right-[12%] top-[8%]",
  trading: "bg-cyan-300/20 left-[18%] top-[10%]",
  wallet: "bg-lime-300/20 right-[16%] top-[6%]",
  admin: "bg-rose-300/18 left-[18%] top-[8%]",
  profile: "bg-blue-300/20 right-[18%] top-[8%]",
};

export default function RealisticLighting({ variant, className }: { variant: RealisticLightingVariant; className?: string }) {
  return (
    <div className={cn("pointer-events-none absolute inset-0 z-[1] overflow-hidden", className)} aria-hidden="true">
      <style>{`
        @keyframes realisticBeamDrift {
          0% { transform: translate3d(-7%, 0, 0) rotate(-10deg); opacity: .18; }
          50% { transform: translate3d(8%, 2%, 0) rotate(-6deg); opacity: .42; }
          100% { transform: translate3d(-7%, 0, 0) rotate(-10deg); opacity: .18; }
        }
        @keyframes realisticBeamDriftReverse {
          0% { transform: translate3d(7%, 0, 0) rotate(9deg); opacity: .16; }
          50% { transform: translate3d(-8%, 2%, 0) rotate(5deg); opacity: .38; }
          100% { transform: translate3d(7%, 0, 0) rotate(9deg); opacity: .16; }
        }
        @keyframes lensPulseReal {
          0%, 100% { opacity: .18; transform: scale(.95); filter: blur(18px); }
          50% { opacity: .38; transform: scale(1.08); filter: blur(24px); }
        }
        @keyframes fineDustDrift {
          0% { background-position: 0 0, 40px 120px, 140px 20px; opacity: .16; }
          50% { opacity: .34; }
          100% { background-position: 120px -60px, 20px 40px, 20px 160px; opacity: .16; }
        }
        @keyframes reflectionSweepReal {
          0% { transform: translateX(-140%) skewX(-16deg); opacity: 0; }
          20% { opacity: .34; }
          100% { transform: translateX(160%) skewX(-16deg); opacity: 0; }
        }
      `}</style>
      <div className="absolute inset-0 opacity-90 [background:radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.11),transparent_28%),linear-gradient(to_bottom,rgba(255,255,255,0.05),transparent_32%)]" />
      <div className="absolute -top-32 left-[-12%] h-[78vh] w-[52vw] origin-top bg-[linear-gradient(105deg,transparent_8%,rgba(255,255,255,0.025)_24%,rgba(255,255,255,0.17)_48%,rgba(255,255,255,0.025)_66%,transparent_84%)] blur-xl" style={{ animation: "realisticBeamDrift 10s ease-in-out infinite" }} />
      <div className="absolute -top-36 right-[-14%] h-[82vh] w-[54vw] origin-top bg-[linear-gradient(75deg,transparent_8%,rgba(255,255,255,0.025)_26%,rgba(167,243,208,0.15)_50%,rgba(255,255,255,0.025)_68%,transparent_84%)] blur-xl" style={{ animation: "realisticBeamDriftReverse 12s ease-in-out infinite" }} />
      <div className={cn("absolute h-56 w-56 rounded-full blur-2xl", variantLens[variant])} style={{ animation: "lensPulseReal 7s ease-in-out infinite" }} />
      <div className="absolute inset-0 opacity-25 [background-image:radial-gradient(circle,rgba(255,255,255,0.22)_0_1px,transparent_1.6px),radial-gradient(circle,rgba(255,255,255,0.14)_0_1px,transparent_1.5px),radial-gradient(circle,rgba(167,243,208,0.14)_0_1px,transparent_1.6px)] [background-size:220px_220px,280px_280px,340px_340px]" style={{ animation: "fineDustDrift 18s linear infinite" }} />
      <div className="absolute inset-y-0 left-0 w-1/3 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.10),transparent)] mix-blend-screen" style={{ animation: "reflectionSweepReal 8s ease-in-out infinite" }} />
    </div>
  );
}
