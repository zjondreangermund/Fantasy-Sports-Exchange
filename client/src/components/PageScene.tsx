import * as React from "react";

export type PageSceneVariant =
  | "landing"
  | "dashboard"
  | "vault"
  | "market"
  | "auction"
  | "wallet"
  | "account"
  | "competition"
  | "premierLeague"
  | "onboarding"
  | "reveal"
  | "admin"
  | "lab";

type SceneMood = {
  base: string;
  spotlight: string;
  glowA: string;
  glowB: string;
  glowC: string;
  beam: string;
  textureOpacity: number;
};

function sceneArtworkSrc(variant: PageSceneVariant) {
  return `/page-scenes/${variant}.svg`;
}

const MOODS: Record<PageSceneVariant, SceneMood> = {
  landing: {
    base: "radial-gradient(140% 120% at 50% 4%, rgba(94, 134, 255, 0.18), transparent 56%), linear-gradient(160deg, rgba(8, 12, 32, 0.98), rgba(18, 16, 40, 0.92) 38%, rgba(8, 10, 24, 0.98))",
    spotlight: "radial-gradient(70% 52% at 50% 7%, rgba(126, 164, 255, 0.2), transparent 70%)",
    glowA: "radial-gradient(circle at center, rgba(104, 144, 255, 0.28), transparent 74%)",
    glowB: "radial-gradient(circle at center, rgba(193, 112, 255, 0.2), transparent 72%)",
    glowC: "radial-gradient(circle at center, rgba(70, 223, 255, 0.16), transparent 72%)",
    beam: "linear-gradient(180deg, rgba(168, 186, 255, 0.18), rgba(168, 186, 255, 0))",
    textureOpacity: 0.18,
  },
  dashboard: {
    base: "radial-gradient(125% 90% at 74% -14%, rgba(68, 95, 245, 0.16), transparent 54%), linear-gradient(140deg, rgba(10, 18, 33, 0.94), rgba(19, 28, 52, 0.9) 40%, rgba(6, 13, 26, 0.97))",
    spotlight: "radial-gradient(52% 40% at 30% 12%, rgba(94, 144, 255, 0.16), transparent 68%)",
    glowA: "radial-gradient(circle at center, rgba(90, 123, 255, 0.24), transparent 74%)",
    glowB: "radial-gradient(circle at center, rgba(74, 191, 255, 0.16), transparent 72%)",
    glowC: "radial-gradient(circle at center, rgba(149, 124, 255, 0.14), transparent 72%)",
    beam: "linear-gradient(180deg, rgba(118, 146, 255, 0.14), rgba(118, 146, 255, 0))",
    textureOpacity: 0.13,
  },
  vault: {
    base: "radial-gradient(120% 96% at 22% -10%, rgba(255, 184, 86, 0.16), transparent 46%), linear-gradient(150deg, rgba(14, 12, 20, 0.96), rgba(25, 20, 30, 0.93) 46%, rgba(10, 8, 14, 0.98))",
    spotlight: "radial-gradient(56% 44% at 50% 9%, rgba(255, 202, 118, 0.14), transparent 70%)",
    glowA: "radial-gradient(circle at center, rgba(255, 196, 93, 0.2), transparent 73%)",
    glowB: "radial-gradient(circle at center, rgba(234, 148, 82, 0.2), transparent 70%)",
    glowC: "radial-gradient(circle at center, rgba(151, 103, 255, 0.14), transparent 74%)",
    beam: "linear-gradient(180deg, rgba(255, 203, 127, 0.14), rgba(255, 203, 127, 0))",
    textureOpacity: 0.2,
  },
  market: {
    base: "radial-gradient(120% 95% at 83% -22%, rgba(154, 105, 255, 0.2), transparent 54%), linear-gradient(148deg, rgba(8, 12, 24, 0.96), rgba(26, 21, 42, 0.93) 45%, rgba(8, 13, 26, 0.98))",
    spotlight: "radial-gradient(56% 46% at 46% 11%, rgba(160, 128, 255, 0.2), transparent 70%)",
    glowA: "radial-gradient(circle at center, rgba(168, 124, 255, 0.22), transparent 73%)",
    glowB: "radial-gradient(circle at center, rgba(64, 215, 255, 0.18), transparent 73%)",
    glowC: "radial-gradient(circle at center, rgba(255, 148, 212, 0.14), transparent 76%)",
    beam: "linear-gradient(180deg, rgba(162, 124, 255, 0.17), rgba(162, 124, 255, 0))",
    textureOpacity: 0.17,
  },
  auction: {
    base: "radial-gradient(112% 88% at 52% -20%, rgba(255, 135, 92, 0.2), transparent 48%), linear-gradient(152deg, rgba(14, 10, 14, 0.96), rgba(28, 14, 18, 0.95) 42%, rgba(11, 8, 12, 0.99))",
    spotlight: "radial-gradient(42% 36% at 50% 14%, rgba(255, 170, 114, 0.2), transparent 72%)",
    glowA: "radial-gradient(circle at center, rgba(255, 137, 98, 0.24), transparent 74%)",
    glowB: "radial-gradient(circle at center, rgba(255, 194, 134, 0.19), transparent 73%)",
    glowC: "radial-gradient(circle at center, rgba(175, 102, 255, 0.12), transparent 76%)",
    beam: "linear-gradient(180deg, rgba(255, 171, 118, 0.18), rgba(255, 171, 118, 0))",
    textureOpacity: 0.22,
  },
  wallet: {
    base: "radial-gradient(120% 102% at 84% -16%, rgba(77, 248, 215, 0.14), transparent 52%), linear-gradient(155deg, rgba(3, 9, 13, 0.98), rgba(10, 17, 22, 0.95) 48%, rgba(2, 6, 9, 0.99))",
    spotlight: "radial-gradient(50% 40% at 32% 12%, rgba(76, 237, 216, 0.13), transparent 72%)",
    glowA: "radial-gradient(circle at center, rgba(76, 235, 215, 0.2), transparent 72%)",
    glowB: "radial-gradient(circle at center, rgba(52, 156, 255, 0.18), transparent 73%)",
    glowC: "radial-gradient(circle at center, rgba(121, 190, 255, 0.14), transparent 74%)",
    beam: "linear-gradient(180deg, rgba(96, 240, 220, 0.16), rgba(96, 240, 220, 0))",
    textureOpacity: 0.12,
  },
  account: {
    base: "radial-gradient(122% 92% at 81% -20%, rgba(101, 151, 255, 0.14), transparent 52%), linear-gradient(154deg, rgba(8, 14, 26, 0.96), rgba(19, 27, 44, 0.92) 45%, rgba(9, 13, 20, 0.98))",
    spotlight: "radial-gradient(46% 38% at 30% 10%, rgba(108, 156, 255, 0.16), transparent 72%)",
    glowA: "radial-gradient(circle at center, rgba(103, 158, 255, 0.2), transparent 74%)",
    glowB: "radial-gradient(circle at center, rgba(96, 206, 255, 0.16), transparent 72%)",
    glowC: "radial-gradient(circle at center, rgba(187, 170, 255, 0.12), transparent 74%)",
    beam: "linear-gradient(180deg, rgba(124, 167, 255, 0.15), rgba(124, 167, 255, 0))",
    textureOpacity: 0.12,
  },
  competition: {
    base: "radial-gradient(124% 90% at 78% -16%, rgba(71, 138, 255, 0.16), transparent 54%), linear-gradient(145deg, rgba(7, 20, 24, 0.97), rgba(9, 30, 37, 0.92) 42%, rgba(4, 12, 17, 0.98))",
    spotlight: "radial-gradient(58% 46% at 48% 12%, rgba(87, 217, 193, 0.14), transparent 70%)",
    glowA: "radial-gradient(circle at center, rgba(78, 189, 166, 0.22), transparent 72%)",
    glowB: "radial-gradient(circle at center, rgba(61, 152, 255, 0.18), transparent 74%)",
    glowC: "radial-gradient(circle at center, rgba(81, 214, 255, 0.13), transparent 74%)",
    beam: "linear-gradient(180deg, rgba(95, 205, 182, 0.15), rgba(95, 205, 182, 0))",
    textureOpacity: 0.19,
  },
  premierLeague: {
    base: "radial-gradient(118% 94% at 78% -20%, rgba(149, 95, 255, 0.19), transparent 52%), linear-gradient(142deg, rgba(9, 16, 34, 0.98), rgba(18, 20, 54, 0.92) 44%, rgba(8, 9, 24, 0.99))",
    spotlight: "radial-gradient(48% 38% at 52% 9%, rgba(147, 105, 255, 0.17), transparent 70%)",
    glowA: "radial-gradient(circle at center, rgba(154, 108, 255, 0.23), transparent 73%)",
    glowB: "radial-gradient(circle at center, rgba(69, 179, 255, 0.18), transparent 73%)",
    glowC: "radial-gradient(circle at center, rgba(246, 109, 255, 0.12), transparent 74%)",
    beam: "linear-gradient(180deg, rgba(169, 132, 255, 0.17), rgba(169, 132, 255, 0))",
    textureOpacity: 0.16,
  },
  onboarding: {
    base: "radial-gradient(130% 108% at 48% -10%, rgba(127, 179, 255, 0.2), transparent 54%), linear-gradient(160deg, rgba(6, 11, 30, 0.98), rgba(19, 18, 41, 0.93) 40%, rgba(6, 8, 18, 0.99))",
    spotlight: "radial-gradient(55% 42% at 50% 10%, rgba(126, 169, 255, 0.18), transparent 70%)",
    glowA: "radial-gradient(circle at center, rgba(127, 168, 255, 0.22), transparent 74%)",
    glowB: "radial-gradient(circle at center, rgba(154, 102, 255, 0.18), transparent 72%)",
    glowC: "radial-gradient(circle at center, rgba(72, 220, 255, 0.15), transparent 74%)",
    beam: "linear-gradient(180deg, rgba(149, 177, 255, 0.16), rgba(149, 177, 255, 0))",
    textureOpacity: 0.18,
  },
  reveal: {
    base: "radial-gradient(120% 95% at 50% -18%, rgba(255, 198, 109, 0.2), transparent 50%), linear-gradient(155deg, rgba(13, 10, 20, 0.98), rgba(28, 18, 38, 0.94) 44%, rgba(9, 7, 14, 0.99))",
    spotlight: "radial-gradient(38% 30% at 50% 16%, rgba(255, 215, 141, 0.18), transparent 75%)",
    glowA: "radial-gradient(circle at center, rgba(255, 197, 106, 0.24), transparent 74%)",
    glowB: "radial-gradient(circle at center, rgba(188, 135, 255, 0.18), transparent 73%)",
    glowC: "radial-gradient(circle at center, rgba(107, 213, 255, 0.12), transparent 74%)",
    beam: "linear-gradient(180deg, rgba(255, 210, 138, 0.17), rgba(255, 210, 138, 0))",
    textureOpacity: 0.2,
  },
  admin: {
    base: "radial-gradient(124% 95% at 78% -14%, rgba(82, 221, 255, 0.14), transparent 50%), linear-gradient(156deg, rgba(2, 8, 13, 0.99), rgba(6, 17, 21, 0.96) 44%, rgba(1, 7, 11, 0.99))",
    spotlight: "radial-gradient(45% 36% at 28% 10%, rgba(83, 224, 255, 0.14), transparent 72%)",
    glowA: "radial-gradient(circle at center, rgba(86, 223, 255, 0.18), transparent 73%)",
    glowB: "radial-gradient(circle at center, rgba(76, 163, 255, 0.15), transparent 73%)",
    glowC: "radial-gradient(circle at center, rgba(117, 255, 218, 0.12), transparent 74%)",
    beam: "linear-gradient(180deg, rgba(96, 230, 255, 0.14), rgba(96, 230, 255, 0))",
    textureOpacity: 0.12,
  },
  lab: {
    base: "radial-gradient(130% 98% at 84% -20%, rgba(125, 118, 255, 0.18), transparent 52%), linear-gradient(145deg, rgba(10, 12, 21, 0.97), rgba(18, 20, 34, 0.93) 44%, rgba(8, 9, 16, 0.99))",
    spotlight: "radial-gradient(48% 38% at 44% 10%, rgba(129, 132, 255, 0.18), transparent 70%)",
    glowA: "radial-gradient(circle at center, rgba(129, 126, 255, 0.2), transparent 74%)",
    glowB: "radial-gradient(circle at center, rgba(89, 190, 255, 0.16), transparent 73%)",
    glowC: "radial-gradient(circle at center, rgba(191, 142, 255, 0.12), transparent 74%)",
    beam: "linear-gradient(180deg, rgba(145, 145, 255, 0.15), rgba(145, 145, 255, 0))",
    textureOpacity: 0.16,
  },
};

type PageSceneProps = {
  variant: PageSceneVariant;
  children: React.ReactNode;
  className?: string;
};

export function routeToPageSceneVariant(pathname: string, isAuthenticated = true): PageSceneVariant {
  if (pathname === "/landing") return "landing";
  if (pathname.startsWith("/onboarding")) return "onboarding";
  if (pathname.startsWith("/card-reveal")) return "reveal";
  if (pathname.startsWith("/collection")) return "vault";
  if (pathname.startsWith("/marketplace")) return "market";
  if (pathname.startsWith("/auctions")) return "auction";
  if (pathname.startsWith("/wallet")) return "wallet";
  if (pathname.startsWith("/account")) return "account";
  if (pathname.startsWith("/competitions")) return "competition";
  if (pathname.startsWith("/premier-league")) return "premierLeague";
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname.startsWith("/card-lab")) return "lab";
  if (pathname === "/" || pathname.startsWith("/dashboard")) return "dashboard";
  return isAuthenticated ? "dashboard" : "landing";
}

export default function PageScene({ variant, children, className }: PageSceneProps) {
  const mood = MOODS[variant] ?? MOODS.dashboard;
  const artwork = sceneArtworkSrc(variant);
  const [parallax, setParallax] = React.useState({ x: 0, y: 0 });

  React.useEffect(() => {
    let frame = 0;
    const onMove = (event: PointerEvent) => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        const x = (event.clientX / window.innerWidth - 0.5) * 2;
        const y = (event.clientY / window.innerHeight - 0.5) * 2;
        setParallax({ x, y });
        frame = 0;
      });
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  const parallaxStyle = {
    "--scene-shift-x": `${(parallax.x * 14).toFixed(3)}px`,
    "--scene-shift-y": `${(parallax.y * 10).toFixed(3)}px`,
    "--scene-base": mood.base,
    "--scene-spotlight": mood.spotlight,
    "--scene-glow-a": mood.glowA,
    "--scene-glow-b": mood.glowB,
    "--scene-glow-c": mood.glowC,
    "--scene-beam": mood.beam,
    "--scene-texture-opacity": mood.textureOpacity,
  } as React.CSSProperties;

  return (
    <div className={`page-scene ${className ?? ""}`.trim()} data-scene={variant}>
      <div className="page-scene__atmosphere" style={parallaxStyle} aria-hidden="true">
        <div className="page-scene__base" />
        <img className="page-scene__artwork" src={artwork} alt="" loading="eager" decoding="async" />
        <div className="page-scene__spotlight" />
        <div className="page-scene__beam" />
        <div className="page-scene__texture" />
        <div className="page-scene__glow page-scene__glow--a" />
        <div className="page-scene__glow page-scene__glow--b" />
        <div className="page-scene__glow page-scene__glow--c" />
        <div className="page-scene__vignette" />
      </div>
      <div className="page-scene__content">{children}</div>
    </div>
  );
}
