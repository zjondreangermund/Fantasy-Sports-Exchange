import { useRef, useCallback, useEffect, type ReactNode } from "react";

export interface Card3DProps {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  /** Base Y rotation in degrees (slight showcase tilt) */
  baseRotateY?: number;
  onClick?: () => void;
}

/**
 * CSS-only 3D perspective wrapper — mouse / touch tilt with smooth reset.
 */
export default function Card3D({
  children,
  className = "",
  disabled = false,
  baseRotateY = -6,
  onClick,
}: Card3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const shineRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  const applyTilt = useCallback(
    (clientX: number, clientY: number) => {
      const container = containerRef.current;
      const inner = innerRef.current;
      const shine = shineRef.current;
      if (!container || !inner || disabled) return;

      const rect = container.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const px = (x / rect.width) * 2 - 1;
      const py = (y / rect.height) * 2 - 1;
      const rotateX = py * -14;
      const rotateY = baseRotateY + px * 14;

      inner.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02,1.02,1.02)`;

      if (shine) {
        shine.style.background = `radial-gradient(circle at ${x}px ${y}px, rgba(255,255,255,0.22) 0%, transparent 55%)`;
        shine.style.opacity = "1";
      }
    },
    [baseRotateY, disabled],
  );

  const resetTilt = useCallback(() => {
    const inner = innerRef.current;
    const shine = shineRef.current;
    if (!inner) return;
    inner.style.transform = `rotateX(0deg) rotateY(${baseRotateY}deg) scale3d(1,1,1)`;
    if (shine) shine.style.opacity = "0";
  }, [baseRotateY]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || disabled) return;

    const onMove = (e: MouseEvent) => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => applyTilt(e.clientX, e.clientY));
    };

    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => applyTilt(t.clientX, t.clientY));
    };

    container.addEventListener("mousemove", onMove);
    container.addEventListener("mouseleave", resetTilt);
    container.addEventListener("touchmove", onTouchMove, { passive: true });
    container.addEventListener("touchend", resetTilt);

    return () => {
      cancelAnimationFrame(rafRef.current);
      container.removeEventListener("mousemove", onMove);
      container.removeEventListener("mouseleave", resetTilt);
      container.removeEventListener("touchmove", onTouchMove);
      container.removeEventListener("touchend", resetTilt);
    };
  }, [applyTilt, resetTilt, disabled]);

  return (
    <div
      ref={containerRef}
      className={`premium-card-3d ${className}`}
      style={{ perspective: "900px", touchAction: "pan-y" }}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <div
        ref={innerRef}
        className="premium-card-3d__inner"
        style={{
          transform: `rotateY(${baseRotateY}deg)`,
          transformStyle: "preserve-3d",
          transition: "transform 0.18s ease-out",
        }}
      >
        {children}
        <div
          ref={shineRef}
          className="premium-card-3d__shine"
          aria-hidden
        />
      </div>
    </div>
  );
}
