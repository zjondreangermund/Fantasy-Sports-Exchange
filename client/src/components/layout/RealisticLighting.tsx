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
      <div className="absolute inset-0 opacity-90 [background:radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.10),transparent_28%),linear-gradient(to_bottom,rgba(255,255,255,0.05),transparent_32%)]" />
      <div className="absolute -top-32 left-[-12%] h-[78vh] w-[52vw] origin-top rotate-[-10deg] bg-[linear-gradient(105deg,transparent_8%,rgba(255,255,255,0.025)_24%,rgba(255,255,255,0.16)_48%,rgba(255,255,255,0.025)_66%,transparent_84%)] blur-xl animate-[realisticBeamDrift_10s_ease-in-out_infinite]" />
      <div className="absolute -top-36 right-[-14%] h-[82vh] w-[54vw] origin-top rotate-[9deg] bg-[linear-gradient(75deg,transparent_8%,rgba(255,255,255,0.025)_26%,rgba(167,243,208,0.14)_50%,rgba(255,255,255,0.025)_68%,transparent_84%)] blur-xl animate-[realisticBeamDrift_12s_ease-in-out_infinite_reverse]" />
      <div className={cn("absolute h-56 w-56 rounded-full blur-2xl animate-[lensPulseReal_7s_ease-in-out_infinite]", variantLens[variant])} />
      <div className="absolute inset-0 opacity-25 [background-image:radial-gradient(circle,rgba(255,255,255,0.22)_0_1px,transparent_1.6px),radial-gradient(circle,rgba(255,255,255,0.14)_0_1px,transparent_1.5px),radial-gradient(circle,rgba(167,243,208,0.14)_0_1px,transparent_1.6px)] [background-size:220px_220px,280px_280px,340px_340px] animate-[fineDustDrift_18s_linear_infinite]" />
    </div>
  );
}
