import { useRef, useState, useMemo, useCallback, Suspense, Component, type ReactNode, useEffect, type RefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { type PlayerCardWithPlayer, type EplPlayer } from "../../../shared/schema";
import { Shield } from "lucide-react";

type RarityKey = "common" | "rare" | "unique" | "epic" | "legendary";

const rarityStyles: Record<
  RarityKey,
  {
    base: number;
    label: string;
    glow: string;
    accentColor: string;
    labelBg: string;
  }
> = {
  common: {
    base: 0x8e9aaf,
    label: "COMMON",
    glow: "0 8px 32px rgba(120,140,165,0.25)",
    accentColor: "#b8c4d4",
    labelBg: "rgba(100,120,140,0.85)",
  },
  rare: {
    base: 0xb91c1c,
    label: "RARE",
    glow: "0 8px 40px rgba(220,38,38,0.3)",
    accentColor: "#fca5a5",
    labelBg: "rgba(185,28,28,0.9)",
  },
  unique: {
    base: 0x6d28d9,
    label: "UNIQUE",
    glow: "0 8px 40px rgba(124,58,237,0.3)",
    accentColor: "#e9d5ff",
    labelBg: "linear-gradient(135deg, #6d28d9, #db2777)",
  },
  epic: {
    base: 0x1a1a3e,
    label: "EPIC",
    glow: "0 8px 40px rgba(79,70,229,0.2)",
    accentColor: "#a5b4fc",
    labelBg: "linear-gradient(135deg, #1e1b4b, #312e81)",
  },
  legendary: {
    base: 0xb45309,
    label: "LEGENDARY",
    glow: "0 8px 48px rgba(245,158,11,0.35)",
    accentColor: "#fef3c7",
    labelBg: "linear-gradient(135deg, #92400e, #d97706)",
  },
};

interface CanvasErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
  onError?: () => void;
}

class CanvasErrorBoundary extends Component<CanvasErrorBoundaryProps, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch() {
    this.props.onError?.();
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

function EngravedPortrait({ url, hovered }: { url: string; hovered: boolean }) {
  const fallbackTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const grad = ctx.createLinearGradient(0, 0, 32, 32);
      grad.addColorStop(0, "#4b5563");
      grad.addColorStop(1, "#9ca3af");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 32, 32);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, []);

  const [processedTexture, setProcessedTexture] = useState<THREE.Texture>(fallbackTexture);

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.referrerPolicy = "no-referrer";

    img.onload = () => {
      if (cancelled) return;
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || img.width || 512;
      canvas.height = img.naturalHeight || img.height || 512;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setProcessedTexture(fallbackTexture);
        return;
      }

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;

      let removed = 0;
      const totalPixels = data.length / 4;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const sat = max === 0 ? 0 : (max - min) / max;
        const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        const likelyWhiteBg = luminance > 246 && sat < 0.1;
        if (likelyWhiteBg) {
          data[i + 3] = 0;
          removed += 1;
        }
      }

      if (removed / totalPixels <= 0.65) {
        ctx.putImageData(imgData, 0, 0);
      }

      const out = new THREE.CanvasTexture(canvas);
      out.needsUpdate = true;
      out.wrapS = THREE.ClampToEdgeWrapping;
      out.wrapT = THREE.ClampToEdgeWrapping;
      out.colorSpace = THREE.SRGBColorSpace;
      setProcessedTexture(out);
    };

    img.onerror = () => {
      if (!cancelled) setProcessedTexture(fallbackTexture);
    };

    img.src = url;
    return () => {
      cancelled = true;
    };
  }, [url, fallbackTexture]);

  const ref = useRef<THREE.Mesh>(null);

  useMemo(() => {
    processedTexture.wrapS = THREE.ClampToEdgeWrapping;
    processedTexture.wrapT = THREE.ClampToEdgeWrapping;
    processedTexture.colorSpace = THREE.SRGBColorSpace;
  }, [processedTexture]);

  useFrame(() => {
    if (ref.current) {
      ref.current.position.x = THREE.MathUtils.lerp(ref.current.position.x, hovered ? 0.04 : 0, 0.1);
      ref.current.position.y = THREE.MathUtils.lerp(ref.current.position.y, hovered ? 0.015 : 0, 0.1);
    }
  });

  return (
    <mesh ref={ref} position={[0, 0.08, 0.36]}>
      <planeGeometry args={[1.62, 2.06, 64, 64]} />
      <meshStandardMaterial
        map={processedTexture}
        alphaMap={processedTexture}
        bumpMap={processedTexture}
        bumpScale={0.11}
        roughness={0.26}
        metalness={0.85}
        emissive={new THREE.Color("#7dd3fc")}
        emissiveIntensity={0.08}
        transparent
        alphaTest={0.08}
        opacity={0.98}
      />
    </mesh>
  );
}

function ShineLight({ mouse, hovered }: { mouse: RefObject<{ x: number; y: number }>; hovered: boolean }) {
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(() => {
    if (lightRef.current && mouse.current) {
      const tx = hovered ? mouse.current.x * 2.5 : 0;
      const ty = hovered ? mouse.current.y * 2.0 : 0.5;

      lightRef.current.position.x = THREE.MathUtils.lerp(lightRef.current.position.x, tx, 0.1);
      lightRef.current.position.y = THREE.MathUtils.lerp(lightRef.current.position.y, ty, 0.1);
      lightRef.current.intensity = THREE.MathUtils.lerp(lightRef.current.intensity, hovered ? 6 : 2, 0.1);
    }
  });

  return <pointLight ref={lightRef} position={[0, 0.5, 3]} intensity={2} color="#ffffff" distance={8} decay={1.5} />;
}

function CardMesh({
  rarity,
  playerImageUrl,
  hovered,
  mouse,
}: {
  rarity: RarityKey;
  playerImageUrl: string;
  hovered: boolean;
  mouse: RefObject<{ x: number; y: number }>;
}) {
  const colors = rarityStyles[rarity];

  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    const w = 2;
    const h = 3;
    const r = 0.25;

    shape.moveTo(-w / 2 + r, -h / 2);
    shape.lineTo(w / 2 - r, -h / 2);
    shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
    shape.lineTo(w / 2, h / 2 - r);
    shape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
    shape.lineTo(-w / 2 + r, h / 2);
    shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
    shape.lineTo(-w / 2, -h / 2 + r);
    shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);

    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.7,
      bevelEnabled: true,
      bevelThickness: 0.08,
      bevelSize: 0.08,
      bevelSegments: 8,
    });

    geo.center();
    return geo;
  }, []);

  const baseMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colors.base,
        metalness: 0.95,
        roughness: 0.18,
        envMapIntensity: 1.5,
      }),
    [colors.base],
  );

  const frameMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(colors.base).multiplyScalar(0.35),
        metalness: 0.85,
        roughness: 0.15,
      }),
    [colors.base],
  );

  const crystalMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
        fragmentShader: `
      varying vec2 vUv;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      vec2 voronoi(vec2 x){
        vec2 p=floor(x),f=fract(x); float res=8.0,id=0.0;
        for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){
          vec2 b=vec2(float(i),float(j)),r=b-f+hash(p+b); float d=dot(r,r);
          if(d<res){res=d;id=hash(p+b);}
        } return vec2(sqrt(res),id);
      }
      void main(){
        vec2 v=voronoi(vUv*12.0); float facet=v.y*0.3+0.7; float edge=smoothstep(0.02,0.06,v.x);
        float ef=smoothstep(0.0,0.08,vUv.x)*smoothstep(0.0,0.08,vUv.y)*smoothstep(1.0,0.92,vUv.x)*smoothstep(1.0,0.92,vUv.y);
        vec3 c=vec3(facet*edge)*ef; gl_FragColor=vec4(c,0.22*ef);
      }`,
      }),
    [],
  );

  return (
    <group>
      <mesh geometry={geometry} scale={[1.03, 1.03, 1.03]} material={frameMat} />
      <mesh geometry={geometry} material={baseMat} />
      <Suspense fallback={null}>
        <EngravedPortrait url={playerImageUrl} hovered={hovered} />
      </Suspense>
      <mesh geometry={geometry} renderOrder={1}>
        <primitive object={crystalMat} attach="material" />
      </mesh>
      <ShineLight mouse={mouse} hovered={hovered} />
    </group>
  );
}

function eplAssignRarity(player: EplPlayer): RarityKey {
  const rating = player.rating ? parseFloat(String(player.rating)) : 0;
  const goals = player.goals ?? 0;
  const assists = player.assists ?? 0;
  const apps = player.appearances ?? 0;

  if (rating >= 7.5 || goals >= 15) return "legendary";
  if (rating >= 7.2 || goals >= 10 || goals + assists >= 15) return "epic";
  if (rating >= 7.0 || goals >= 5 || assists >= 8) return "unique";
  if (rating >= 6.8 || apps >= 15 || goals + assists >= 5) return "rare";

  return "common";
}

function eplPositionShort(pos: string | null): string {
  if (!pos) return "N/A";
  const map: Record<string, string> = { Goalkeeper: "GK", Defender: "DEF", Midfielder: "MID", Attacker: "FWD" };
  return map[pos] || pos.substring(0, 3).toUpperCase();
}

export function eplPlayerToCard(player: EplPlayer): PlayerCardWithPlayer {
  const rarity = eplAssignRarity(player);
  const goals = player.goals ?? 0;
  const assists = player.assists ?? 0;
  const rating = player.rating ? parseFloat(String(player.rating)) : 0;
  const overall = Math.min(99, Math.round(60 + rating * 3 + goals * 0.5 + assists * 0.3));

  return {
    id: player.id,
    playerId: player.id,
    ownerId: null,
    rarity,
    serialId: null,
    serialNumber: null,
    maxSupply: rarity === "common" ? 0 : rarity === "rare" ? 100 : rarity === "unique" ? 1 : rarity === "epic" ? 10 : 5,
    level: 1,
    xp: 0,
    decisiveScore: 35,
    last5Scores: [0, 0, 0, 0, 0],
    forSale: false,
    price: 0,
    acquiredAt: new Date(),
    player: {
      id: player.id,
      name: player.name,
      team: player.team || "Unknown",
      league: "Premier League",
      position: eplPositionShort(player.position ?? null),
      nationality: player.nationality || "Unknown",
      age: player.age || 0,
      overall,
      imageUrl: player.photo || "/images/player-1.png",
    },
  } as PlayerCardWithPlayer;
}

function StatBadge({ label, value, color, size }: { label: string; value: string; color: string; size: "sm" | "md" | "lg" }) {
  const fs = size === "sm" ? 6 : size === "lg" ? 8 : 7;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
      <span
        style={{
          fontSize: fs - 1,
          fontWeight: 700,
          color: "rgba(255,255,255,0.4)",
          letterSpacing: "0.08em",
          textShadow: "0 1px 2px rgba(0,0,0,0.5)",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: fs + 1,
          fontWeight: 900,
          color,
          textShadow: "0 1px 3px rgba(0,0,0,0.6)",
          fontFamily: "'Inter','Arial Black',system-ui,sans-serif",
        }}
      >
        {value}
      </span>
    </div>
  );
}

interface Card3DProps {
  card: PlayerCardWithPlayer;
  size?: "sm" | "md" | "lg";
  selected?: boolean;
  selectable?: boolean;
  onClick?: () => void;
  showPrice?: boolean;
  sorareImageUrl?: string | null;
}

export default function Card3D({
  card,
  size = "md",
  selected = false,
  selectable = false,
  onClick,
  showPrice = false,
  sorareImageUrl,
}: Card3DProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);
  const [rotX, setRotX] = useState(-5);
  const [rotY, setRotY] = useState(0);
  const rafRef = useRef<number>(0);

  const rarity = (card.rarity as RarityKey) || "common";
  const rs = rarityStyles[rarity];

  const sizeMap = { sm: { w: 170, h: 250 }, md: { w: 220, h: 320 }, lg: { w: 270, h: 390 } };
  const s = sizeMap[size];
  const pad = size === "sm" ? "10px 12px 8px" : size === "lg" ? "16px 18px 14px" : "12px 14px 10px";

  const imageIndex = ((card.playerId - 1) % 6) + 1;
  const fallbackImage = card.player?.imageUrl || `/images/player-${imageIndex}.png`;
  const imageUrl = sorareImageUrl || fallbackImage;

  const serialText = card.serialNumber && card.maxSupply ? `#${String(card.serialNumber).padStart(3, "0")}/${card.maxSupply}` : card.serialId || "";

  const dsColor = (card.decisiveScore || 35) >= 80 ? "#4ade80" : (card.decisiveScore || 35) >= 60 ? "#facc15" : "#94a3b8";

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    mouseRef.current = {
      x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
      y: -((e.clientY - rect.top) / rect.height) * 2 + 1,
    };
  }, []);

  const handleMouseEnter = useCallback(() => setHovered(true), []);
  const handleMouseLeave = useCallback(() => {
    mouseRef.current = { x: 0, y: 0 };
    setHovered(false);
  }, []);

  useEffect(() => {
    let running = true;

    const animate = () => {
      if (!running) return;

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      const targetRotY = hovered ? mx * 20 : 0;
      const targetRotX = hovered ? my * -15 - 5 : -5;

      setRotY((prev) => prev + (targetRotY - prev) * 0.1);
      setRotX((prev) => prev + (targetRotX - prev) * 0.1);
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [hovered]);

  return (
    <div
      ref={wrapperRef}
      className="card-wrapper"
      style={{
        width: s.w,
        height: s.h,
        perspective: "1000px",
        position: "relative",
        cursor: selectable ? "pointer" : "default",
      }}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      data-testid={`player-card-${card.id}`}
    >
      <div
        className="card-3d"
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          transformStyle: "preserve-3d",
          transform: `rotateX(${rotX}deg) rotateY(${rotY}deg)`,
          transition: hovered ? "none" : "transform 0.5s cubic-bezier(0.23, 1, 0.32, 1)",
          borderRadius: 14,
        }}
      >
        <CanvasErrorBoundary fallback={null}>
          <Canvas
            camera={{ position: [0, 0, 4.5], fov: 45 }}
            dpr={[1, 1.5]}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              borderRadius: 14,
              pointerEvents: "none",
            }}
            gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
            onCreated={({ gl }) => {
              gl.setClearColor(0x000000, 0);
            }}
          >
            <ambientLight intensity={0.5} />
            <directionalLight position={[5, 5, 5]} intensity={3} />
            <directionalLight position={[-3, 2, 4]} intensity={1} />
            <pointLight position={[0, 0, 4]} intensity={0.5} />
            <CardMesh rarity={rarity} playerImageUrl={imageUrl} hovered={hovered} mouse={mouseRef} />
          </Canvas>
        </CanvasErrorBoundary>

        <div
          className="card-content"
          style={{
            position: "absolute",
            top: "7%",
            left: "9%",
            right: "9%",
            bottom: "9%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            zIndex: 10,
            pointerEvents: "none",
            padding: pad,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div
                style={{
                  fontSize: size === "sm" ? 20 : size === "lg" ? 28 : 24,
                  fontWeight: 900,
                  color: "#fff",
                  textShadow: "0 2px 6px rgba(0,0,0,0.8), 0 0 2px rgba(0,0,0,0.5)",
                  lineHeight: 1,
                  fontFamily: "'Inter','Arial Black',system-ui,sans-serif",
                }}
              >
                {card.player?.overall || 0}
              </div>
              <div
                style={{
                  fontSize: size === "sm" ? 7 : size === "lg" ? 10 : 8,
                  fontWeight: 800,
                  color: rs.accentColor,
                  letterSpacing: "0.12em",
                  marginTop: 1,
                  textShadow: "0 1px 3px rgba(0,0,0,0.6)",
                }}
              >
                {card.player?.position || "N/A"}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              {serialText && (
                <div
                  style={{
                    fontSize: size === "sm" ? 6 : size === "lg" ? 8 : 7,
                    fontWeight: 700,
                    color: "rgba(255,255,255,0.45)",
                    letterSpacing: "0.08em",
                    textShadow: "0 1px 2px rgba(0,0,0,0.6)",
                  }}
                >
                  {serialText}
                </div>
              )}
              <div
                style={{
                  fontSize: size === "sm" ? 6 : size === "lg" ? 8 : 7,
                  fontWeight: 800,
                  color: rs.accentColor,
                  letterSpacing: "0.15em",
                  marginTop: 1,
                  background: rs.labelBg,
                  borderRadius: 3,
                  padding: "1px 5px",
                  textShadow: "0 1px 2px rgba(0,0,0,0.3)",
                }}
              >
                {rs.label}
              </div>
            </div>
          </div>

          <div style={{ textAlign: "center" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: size === "sm" ? 6 : 10,
                marginBottom: size === "sm" ? 2 : 3,
              }}
            >
              <StatBadge label="LV" value={String(card.level || 1)} color="#facc15" size={size} />
              <StatBadge label="DS" value={String(card.decisiveScore || 35)} color={dsColor} size={size} />
              <StatBadge label="XP" value={String(card.xp || 0)} color="#60a5fa" size={size} />
            </div>

            {card.last5Scores && card.last5Scores.some((score: number) => score > 0) && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  gap: 2,
                  marginBottom: size === "sm" ? 2 : 3,
                }}
              >
                {(card.last5Scores as number[]).map((score: number, i: number) => (
                  <div
                    key={i}
                    style={{
                      width: size === "sm" ? 10 : 13,
                      height: size === "sm" ? 10 : 13,
                      borderRadius: 2,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background:
                        score >= 70 ? "rgba(74,222,128,0.3)" : score >= 40 ? "rgba(250,204,21,0.25)" : "rgba(148,163,184,0.2)",
                      fontSize: size === "sm" ? 5 : 6,
                      fontWeight: 800,
                      color: "#fff",
                    }}
                  >
                    {score}
                  </div>
                ))}
              </div>
            )}

            <div
              style={{
                fontSize: size === "sm" ? 9 : size === "lg" ? 13 : 11,
                fontWeight: 900,
                color: "#fff",
                letterSpacing: "0.06em",
                textShadow: "0 2px 6px rgba(0,0,0,0.9), 0 0 12px rgba(0,0,0,0.4)",
                textTransform: "uppercase",
                fontFamily: "'Inter','Arial Black',system-ui,sans-serif",
                lineHeight: 1.1,
              }}
            >
              {(card.player?.name || "Unknown").substring(0, 16)}
            </div>

            <div
              style={{
                fontSize: size === "sm" ? 6 : size === "lg" ? 8 : 7,
                fontWeight: 700,
                color: "rgba(255,255,255,0.5)",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                marginTop: 1,
                textShadow: "0 1px 3px rgba(0,0,0,0.7)",
              }}
            >
              {(card.player?.team || "Unknown").substring(0, 20)}
            </div>
          </div>
        </div>

        {(showPrice || card.forSale) && card.price != null && card.price > 0 && (
          <div
            style={{
              position: "absolute",
              bottom: "11%",
              left: "50%",
              transform: "translateX(-50%)",
              background: "linear-gradient(135deg, rgba(0,0,0,0.75), rgba(0,0,0,0.6))",
              backdropFilter: "blur(6px)",
              borderRadius: 8,
              padding: size === "sm" ? "2px 8px" : "3px 12px",
              zIndex: 20,
              pointerEvents: "none",
              border: "1px solid rgba(74,222,128,0.3)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)",
            }}
          >
            <span
              style={{
                color: "#4ade80",
                fontSize: size === "sm" ? 10 : size === "lg" ? 14 : 12,
                fontWeight: 900,
                fontFamily: "'Inter','Arial Black',system-ui,sans-serif",
                textShadow: "0 0 8px rgba(74,222,128,0.4)",
              }}
            >
              N${card.price.toFixed(2)}
            </span>
          </div>
        )}
      </div>

      {selected && (
        <div
          style={{
            position: "absolute",
            top: -4,
            right: -4,
            zIndex: 30,
            width: 20,
            height: 20,
            background: "hsl(250,85%,65%)",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Shield style={{ width: 12, height: 12, color: "#fff" }} />
        </div>
      )}
    </div>
  );
}

