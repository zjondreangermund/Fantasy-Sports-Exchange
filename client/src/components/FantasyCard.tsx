import React from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, RoundedBox } from "@react-three/drei";
import * as THREE from "three";

export type Rarity = "common" | "rare" | "unique" | "epic" | "legendary";

export type PlayerCardData = {
  id: string;
  name: string;
  rating: number;
  position: string;
  club?: string;
  image?: string;
  imageCandidates?: string[];
  rarity: Rarity;
  serial?: number;
  maxSupply?: number;
  form?: number;
};

type FantasyCardProps = {
  player: PlayerCardData;
  className?: string;
};

type Rarity3DConfig = {
  bodyColor: string;
  sideColor: string;
  frameColor: string;
  chamberColor: string;
  plateColor: string;
  edgeGlow: string;
  radius: number;
  bodyScale: [number, number, number];
  frameScale: [number, number, number];
  chamberScale: [number, number, number];
  plateScale: [number, number, number];
  crownTop?: boolean;
  uniqueEdge?: boolean;
};

const rarityConfig: Record<Rarity, Rarity3DConfig> = {
  common: {
    bodyColor: "#3b434d",
    sideColor: "#1f252d",
    frameColor: "#808996",
    chamberColor: "#1d232d",
    plateColor: "#1b2028",
    edgeGlow: "rgba(210,220,232,0.12)",
    radius: 0.12,
    bodyScale: [2.16, 3.14, 0.30],
    frameScale: [2.02, 2.94, 0.08],
    chamberScale: [1.72, 1.44, 0.06],
    plateScale: [1.78, 0.58, 0.10],
  },
  rare: {
    bodyColor: "#244f94",
    sideColor: "#0d1f3f",
    frameColor: "#6ea6f5",
    chamberColor: "#142848",
    plateColor: "#0f1d36",
    edgeGlow: "rgba(70,140,255,0.22)",
    radius: 0.14,
    bodyScale: [2.18, 3.16, 0.31],
    frameScale: [2.02, 2.93, 0.08],
    chamberScale: [1.74, 1.46, 0.06],
    plateScale: [1.80, 0.60, 0.10],
  },
  epic: {
    bodyColor: "#4b2388",
    sideColor: "#1f0f36",
    frameColor: "#9157d9",
    chamberColor: "#1f1131",
    plateColor: "#1a102a",
    edgeGlow: "rgba(162,72,255,0.22)",
    radius: 0.10,
    bodyScale: [2.22, 3.14, 0.32],
    frameScale: [2.00, 2.91, 0.08],
    chamberScale: [1.72, 1.44, 0.06],
    plateScale: [1.80, 0.60, 0.10],
  },
  legendary: {
    bodyColor: "#8f6516",
    sideColor: "#2a1802",
    frameColor: "#d2a84f",
    chamberColor: "#3b2604",
    plateColor: "#2a1a06",
    edgeGlow: "rgba(255,203,82,0.24)",
    radius: 0.11,
    bodyScale: [2.20, 3.16, 0.33],
    frameScale: [2.00, 2.90, 0.08],
    chamberScale: [1.70, 1.42, 0.06],
    plateScale: [1.82, 0.62, 0.10],
    crownTop: true,
  },
  unique: {
    bodyColor: "#181d28",
    sideColor: "#090c13",
    frameColor: "#7988a8",
    chamberColor: "#101722",
    plateColor: "#0c1119",
    edgeGlow: "rgba(124,247,255,0.18)",
    radius: 0.15,
    bodyScale: [2.18, 3.18, 0.32],
    frameScale: [2.00, 2.94, 0.08],
    chamberScale: [1.72, 1.44, 0.06],
    plateScale: [1.80, 0.60, 0.10],
    uniqueEdge: true,
  },
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function computeStats(player: PlayerCardData) {
  const rating = clamp(Number(player.rating) || 70, 45, 99);
  const form = clamp(Number(player.form) || 72, 40, 99);
  const pos = String(player.position || "").toUpperCase();
  const atkBias = pos.includes("FWD") || pos.includes("ST") ? 8 : pos.includes("MID") ? 4 : -2;
  const defBias = pos.includes("GK") || pos.includes("DEF") ? 9 : pos.includes("MID") ? 3 : -4;

  return [
    { key: "ATK", value: clamp(rating + atkBias, 40, 99) },
    { key: "CTL", value: clamp(Math.round(rating * 0.94 + 2), 38, 99) },
    { key: "DEF", value: clamp(rating + defBias, 35, 99) },
    { key: "FRM", value: form },
  ];
}

function useResolvedImage(player: PlayerCardData) {
  const imageCandidates = React.useMemo(() => {
    const list = Array.isArray(player.imageCandidates) ? player.imageCandidates : [];
    const merged = [player.image, ...list].filter((value): value is string => Boolean(String(value || "").trim()));
    return Array.from(new Set(merged));
  }, [player.image, player.imageCandidates]);

  const [imageIndex, setImageIndex] = React.useState(0);

  React.useEffect(() => {
    setImageIndex(0);
  }, [player.id, imageCandidates.join("|")]);

  React.useEffect(() => {
    const src = imageCandidates[imageIndex];
    if (!src) return;
    const probe = new Image();
    probe.onload = () => {};
    probe.onerror = () => setImageIndex((prev) => (prev >= imageCandidates.length - 1 ? prev : prev + 1));
    probe.src = src;
  }, [imageCandidates, imageIndex]);

  return imageCandidates[imageIndex] || "";
}

function Slab3DScene({ rarity, imageUrl, hoverTilt, hovered }: { rarity: Rarity; imageUrl: string; hoverTilt: { x: number; y: number }; hovered: boolean }) {
  const config = rarityConfig[rarity];
  const groupRef = React.useRef<THREE.Group | null>(null);
  const shimmerRef = React.useRef<THREE.MeshStandardMaterial | null>(null);

  const texture = React.useMemo(() => {
    if (!imageUrl) return null;
    const loader = new THREE.TextureLoader();
    const loaded = loader.load(imageUrl);
    loaded.colorSpace = THREE.SRGBColorSpace;
    loaded.minFilter = THREE.LinearMipmapLinearFilter;
    loaded.magFilter = THREE.LinearFilter;
    return loaded;
  }, [imageUrl]);

  useFrame(({ clock }) => {
    const group = groupRef.current;
    if (!group) return;

    const targetX = hoverTilt.y * 0.22;
    const targetY = hoverTilt.x * 0.28;
    group.rotation.x = THREE.MathUtils.lerp(group.rotation.x, targetX, 0.12);
    group.rotation.y = THREE.MathUtils.lerp(group.rotation.y, targetY, 0.12);
    group.position.z = THREE.MathUtils.lerp(group.position.z, hovered ? 0.08 : 0, 0.12);

    if (rarity === "unique" && shimmerRef.current) {
      const t = clock.getElapsedTime();
      shimmerRef.current.color.setHSL(0.56 + Math.sin(t * 1.2) * 0.08, 0.8, 0.58 + Math.sin(t * 1.6) * 0.08);
      shimmerRef.current.opacity = 0.42 + Math.sin(t * 2.2) * 0.12;
    }
  });

  return (
    <>
      <ambientLight intensity={0.62} />
      <directionalLight position={[2.4, 3.1, 3.3]} intensity={1.25} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <spotLight position={[-2.2, 2.1, 2.6]} intensity={0.68} angle={0.5} penumbra={0.7} />

      <group ref={groupRef}>
        <RoundedBox args={config.bodyScale} radius={config.radius} smoothness={5} castShadow receiveShadow>
          <meshPhysicalMaterial color={config.bodyColor} metalness={0.9} roughness={0.32} clearcoat={0.82} clearcoatRoughness={0.22} />
        </RoundedBox>

        <RoundedBox args={[config.bodyScale[0] * 0.98, config.bodyScale[1] * 0.98, config.bodyScale[2] * 0.96]} radius={config.radius * 0.9} smoothness={4} position={[0, 0, -0.01]}>
          <meshStandardMaterial color={config.sideColor} metalness={0.82} roughness={0.4} />
        </RoundedBox>

        <RoundedBox args={config.frameScale} radius={config.radius * 0.72} smoothness={4} position={[0, 0.06, config.bodyScale[2] * 0.5 - 0.04]} castShadow>
          <meshPhysicalMaterial color={config.frameColor} metalness={0.95} roughness={0.2} clearcoat={1} clearcoatRoughness={0.08} />
        </RoundedBox>

        <RoundedBox args={config.chamberScale} radius={0.08} smoothness={4} position={[0, 0.32, config.bodyScale[2] * 0.5 - 0.08]}>
          <meshStandardMaterial color={config.chamberColor} metalness={0.45} roughness={0.58} />
        </RoundedBox>

        <mesh position={[0, 0.34, config.bodyScale[2] * 0.5 - 0.05]}>
          <planeGeometry args={[config.chamberScale[0] * 0.93, config.chamberScale[1] * 0.90]} />
          <meshStandardMaterial color="#ffffff" map={texture || undefined} roughness={0.62} metalness={0.05} />
        </mesh>

        <mesh position={[0, 0.34, config.bodyScale[2] * 0.5 - 0.048]}>
          <planeGeometry args={[config.chamberScale[0] * 0.93, config.chamberScale[1] * 0.90]} />
          <meshStandardMaterial color="#ffffff" transparent opacity={0.14} emissive="#ffffff" emissiveIntensity={0.05} />
        </mesh>

        <RoundedBox args={config.plateScale} radius={0.08} smoothness={4} position={[0, -1.04, config.bodyScale[2] * 0.5 - 0.01]} castShadow>
          <meshPhysicalMaterial color={config.plateColor} metalness={0.85} roughness={0.28} clearcoat={0.75} clearcoatRoughness={0.22} />
        </RoundedBox>

        {config.crownTop ? (
          <group position={[0, 1.54, config.bodyScale[2] * 0.5 - 0.02]}>
            {[-0.58, -0.29, 0, 0.29, 0.58].map((x, idx) => (
              <mesh key={`crown-${idx}`} position={[x, 0, 0]} castShadow>
                <cylinderGeometry args={[0, 0.08, idx % 2 === 0 ? 0.24 : 0.19, 5]} />
                <meshStandardMaterial color="#f1c060" metalness={0.8} roughness={0.28} />
              </mesh>
            ))}
          </group>
        ) : null}

        {config.uniqueEdge ? (
          <RoundedBox args={[config.bodyScale[0] * 1.01, config.bodyScale[1] * 1.01, 0.018]} radius={config.radius * 1.04} smoothness={4} position={[0, 0, config.bodyScale[2] * 0.5 + 0.002]}>
            <meshStandardMaterial
              ref={shimmerRef}
              color="#76d9ff"
              transparent
              opacity={0.45}
              emissive="#7ee6ff"
              emissiveIntensity={0.35}
              blending={THREE.AdditiveBlending}
            />
          </RoundedBox>
        ) : null}
      </group>

      <ContactShadows position={[0, -1.92, 0]} opacity={0.42} blur={2.5} scale={3.4} far={2.4} />
    </>
  );
}

export default function FantasyCard({ player, className = "" }: FantasyCardProps) {
  const rarity = player.rarity;
  const stats = computeStats(player);
  const imageUrl = useResolvedImage(player);

  const [hovered, setHovered] = React.useState(false);
  const [hoverTilt, setHoverTilt] = React.useState({ x: 0, y: 0 });

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const nx = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    const ny = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    setHoverTilt({ x: clamp(nx, -1, 1), y: clamp(ny, -1, 1) });
  };

  return (
    <div
      className={["group relative aspect-[2.5/3.5] w-[260px] select-none", className].join(" ")}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => {
        setHovered(false);
        setHoverTilt({ x: 0, y: 0 });
      }}
      onPointerMove={onPointerMove}
      style={{ filter: `drop-shadow(0 18px 30px ${rarityConfig[rarity].edgeGlow})` }}
    >
      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 4.6], fov: 33 }}
        gl={{ antialias: true, alpha: true }}
        className="h-full w-full"
      >
        <Slab3DScene rarity={rarity} imageUrl={imageUrl} hoverTilt={hoverTilt} hovered={hovered} />
      </Canvas>

      <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/70">{player.club || "FantasyFC"}</p>
            <p className="mt-1 text-[36px] font-black leading-none tracking-[-0.05em] text-white drop-shadow">{player.rating}</p>
          </div>
          <div className="text-right">
            <p className="text-[16px] font-black uppercase tracking-[0.09em] text-white">{player.position}</p>
            <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.16em] text-white/80">{rarity}</p>
          </div>
        </div>

        <div className="mx-auto mb-1 w-[86%] rounded-xl border border-white/15 bg-black/45 px-2.5 py-2 backdrop-blur-sm">
          <h3 className="truncate text-center text-[18px] font-black uppercase leading-none text-white">{player.name}</h3>
          <div className="mt-1 grid grid-cols-4 gap-1">
            {stats.map((stat) => (
              <div key={stat.key} className="rounded-md border border-white/10 bg-white/5 px-1 py-1 text-center">
                <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-white/60">{stat.key}</p>
                <p className="text-[11px] font-extrabold leading-tight text-white">{stat.value}</p>
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[8px] font-semibold uppercase tracking-[0.13em] text-white/60">
            <span>{player.position}</span>
            <span>#{String(player.serial || 1).padStart(3, "0")} / {player.maxSupply || 500}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
