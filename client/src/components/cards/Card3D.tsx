import { useCallback, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";

export type Card3DProps = {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  intensity?: number;
  onClick?: () => void;
};

export default function Card3D({
  children,
  className = "",
  disabled = false,
  intensity = 1,
  onClick,
}: Card3DProps) {
  const [style, setStyle] = useState<CSSProperties>({
    ["--mx" as string]: "50%",
    ["--my" as string]: "50%",
    ["--rx" as string]: "0deg",
    ["--ry" as string]: "0deg",
    ["--shine" as string]: "0",
  });

  const handleMove = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      if (disabled) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;
      const rx = (0.5 - y) * 10 * intensity;
      const ry = (x - 0.5) * 12 * intensity;

      setStyle({
        ["--mx" as string]: `${Math.round(x * 100)}%`,
        ["--my" as string]: `${Math.round(y * 100)}%`,
        ["--rx" as string]: `${rx.toFixed(2)}deg`,
        ["--ry" as string]: `${ry.toFixed(2)}deg`,
        ["--shine" as string]: "1",
      });
    },
    [disabled, intensity],
  );

  const reset = useCallback(() => {
    setStyle({
      ["--mx" as string]: "50%",
      ["--my" as string]: "50%",
      ["--rx" as string]: "0deg",
      ["--ry" as string]: "0deg",
      ["--shine" as string]: "0",
    });
  }, []);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseMove={handleMove}
      onMouseLeave={reset}
      className={`premium-card-3d group relative border-0 bg-transparent p-0 text-left outline-none ${
        onClick ? "cursor-pointer" : "cursor-default"
      } ${className}`}
      style={style}
      disabled={disabled && !onClick}
    >
      <div
        className="premium-card-3d__inner relative transition-transform duration-200 ease-out"
        style={{
          transform: "perspective(900px) rotateX(var(--rx)) rotateY(var(--ry)) translateZ(0)",
          transformStyle: "preserve-3d",
        }}
      >
        {children}
      </div>
    </button>
  );
}
