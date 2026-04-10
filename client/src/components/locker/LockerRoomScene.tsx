import React, { useEffect, useMemo, useRef, useState } from "react";

type LockerRoomSceneProps = {
  enabled?: boolean;
  intensity?: number; // parallax intensity
  className?: string;
};

/**
 * LockerRoomScene
 * - Background room layers (walls/ceiling glow)
 * - Shelf surface (thickness + highlight)
 * - Fog/haze + vignette
 * - Particles (CSS only)
 * - Parallax (mouse / touch)
 */
export default function LockerRoomScene({
  enabled = true,
  intensity = 14,
  className = "",
}: LockerRoomSceneProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(Boolean(mq?.matches));
    update();
    mq?.addEventListener?.("change", update);
    return () => mq?.removeEventListener?.("change", update);
  }, []);

  // Generate particles once
  const particles = useMemo(() => {
    const count = 22;
    return Array.from({ length: count }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 70,
      s: 0.5 + Math.random() * 1.4,
      o: 0.15 + Math.random() * 0.35,
      d: 6 + Math.random() * 10,
      delay: Math.random() * 8,
    }));
  }, []);

  useEffect(() => {
    if (!enabled) return;
    if (reducedMotion) return;

    const el = ref.current;
    if (!el) return;

    let raf = 0;
    let targetX = 0;
    let targetY = 0;
    let x = 0;
    let y = 0;

    const onMove = (clientX: number, clientY: number) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (clientX - cx) / (rect.width / 2);
      const dy = (clientY - cy) / (rect.height / 2);
      targetX = Math.max(-1, Math.min(1, dx));
      targetY = Math.max(-1, Math.min(1, dy));
    };

    const onMouse = (e: MouseEvent) => onMove(e.clientX, e.clientY);
    const onTouch = (e: TouchEvent) => {
      const t = e.touches?.[0];
      if (t) onMove(t.clientX, t.clientY);
    };

    window.addEventListener("mousemove", onMouse, { passive: true });
    window.addEventListener("touchmove", onTouch, { passive: true });

    const tick = () => {
      // smooth follow
      x += (targetX - x) * 0.06;
      y += (targetY - y) * 0.06;

      // gentle idle drift
      const t = Date.now() * 0.00035;
      const idleX = Math.sin(t) * 0.18;
      const idleY = Math.cos(t * 0.9) * 0.14;

      const px = (x + idleX) * intensity;
      const py = (y + idleY) * intensity;

      el.style.setProperty("--px", `${px}px`);
      el.style.setProperty("--py", `${py}px`);

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMouse);
      window.removeEventListener("touchmove", onTouch);
    };
  }, [enabled, intensity, reducedMotion]);

  if (!enabled) return null;

  return (
    <div
      ref={ref}
      aria-hidden
      className={[
        "pointer-events-none absolute inset-0 overflow-hidden",
        className,
      ].join(" ")}
      style={
        {
          // parallax variables
          ["--px" as any]: "0px",
          ["--py" as any]: "0px",
        } as React.CSSProperties
      }
    >
      {/* Base dark */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#070A0F] via-[#05070B] to-black" />

      {/* Back wall texture-ish gradient */}
      <div
        className="absolute -inset-[12%] opacity-90"
        style={{
          transform: "translate(var(--px), var(--py)) scale(1.02)",
          background:
            "radial-gradient(1200px 520px at 50% 18%, rgba(120,160,255,0.10), transparent 60%)," +
            "radial-gradient(800px 380px at 16% 28%, rgba(255,255,255,0.06), transparent 62%)," +
            "radial-gradient(900px 520px at 84% 34%, rgba(255,255,255,0.05), transparent 66%)," +
            "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 26%, rgba(0,0,0,0.0) 60%, rgba(0,0,0,0.35) 100%)",
          filter: "blur(0.2px)",
        }}
      />

      {/* Side walls shadows (makes room boundaries) */}
      <div
        className="absolute inset-0 opacity-95"
        style={{
          background:
            "linear-gradient(90deg, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.35) 18%, transparent 40%, transparent 60%, rgba(0,0,0,0.35) 82%, rgba(0,0,0,0.78) 100%)",
        }}
      />

      {/* Ceiling light strip */}
      <div
        className="absolute left-1/2 top-[6%] h-[90px] w-[78%] -translate-x-1/2 opacity-80"
        style={{
          background:
            "radial-gradient(600px 110px at 50% 30%, rgba(255,255,255,0.22), transparent 60%)," +
            "linear-gradient(180deg, rgba(255,255,255,0.10), transparent)",
          filter: "blur(0.2px)",
        }}
      />

      {/* Light beams */}
      <div
        className="absolute -inset-[20%] opacity-30"
        style={{
          transform: "translate(calc(var(--px) * 0.35), calc(var(--py) * 0.25)) rotate(-8deg)",
          background:
            "radial-gradient(240px 520px at 35% 0%, rgba(200,220,255,0.10), transparent 70%)," +
            "radial-gradient(260px 560px at 68% 0%, rgba(200,220,255,0.08), transparent 72%)",
          filter: "blur(1.2px)",
        }}
      />

      {/* Shelf (top surface + thickness) */}
      <div className="absolute left-1/2 top-[44%] h-[180px] w-[92%] -translate-x-1/2">
        {/* shelf surface */}
        <div
          className="absolute inset-x-0 top-[10px] h-[56px] rounded-[22px]"
          style={{
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.03) 30%, rgba(0,0,0,0.25) 100%)",
            boxShadow:
              "0 30px 80px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.14)",
          }}
        />
        {/* shelf front thickness */}
        <div
          className="absolute inset-x-0 top-[56px] h-[36px] rounded-b-[22px]"
          style={{
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.15), rgba(0,0,0,0.55) 55%, rgba(0,0,0,0.9) 100%)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
          }}
        />
        {/* shelf highlight line */}
        <div
          className="absolute inset-x-[7%] top-[16px] h-[1px] opacity-60"
          style={{
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)",
          }}
        />
      </div>

      {/* Floor reflection area */}
      <div
        className="absolute inset-x-0 top-[52%] bottom-0 opacity-90"
        style={{
          background:
            "radial-gradient(900px 600px at 50% 0%, rgba(120,160,255,0.08), transparent 60%)," +
            "linear-gradient(180deg, rgba(0,0,0,0.0), rgba(0,0,0,0.35) 35%, rgba(0,0,0,0.85) 100%)",
        }}
      />

      {/* Fog/Haze */}
      <div
        className="absolute inset-x-0 bottom-0 top-[38%] opacity-80"
        style={{
          background:
            "radial-gradient(900px 320px at 50% 38%, rgba(255,255,255,0.08), transparent 60%)," +
            "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.38) 60%, rgba(0,0,0,0.9) 100%)",
          filter: "blur(1.1px)",
        }}
      />

      {/* Particles */}
      {!reducedMotion && (
        <div className="absolute inset-0">
          {particles.map((p) => (
            <span
              key={p.id}
              className="absolute rounded-full"
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                width: `${p.s * 6}px`,
                height: `${p.s * 6}px`,
                opacity: p.o,
                background: "rgba(255,255,255,0.85)",
                filter: "blur(0.2px)",
                animation: `lockerFloat ${p.d}s ease-in-out ${p.delay}s infinite`,
                transform: "translate(var(--px), var(--py))",
              }}
            />
          ))}
        </div>
      )}

      {/* Vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(1200px 700px at 50% 35%, transparent 55%, rgba(0,0,0,0.65) 100%)",
        }}
      />

      {/* Keyframes */}
      <style>{`
        @keyframes lockerFloat {
          0%, 100% { transform: translate(var(--px), var(--py)) translate3d(0,0,0); }
          50% { transform: translate(var(--px), var(--py)) translate3d(0,-10px,0); }
        }
      `}</style>
    </div>
  );
}
