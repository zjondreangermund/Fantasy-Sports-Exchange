import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, RoundedBox, ContactShadows, Environment } from "@react-three/drei";
import * as THREE from "three";
import { type PlayerCardWithPlayer } from "../../../shared/schema";
import { buildCardImageCandidates } from "../lib/card-image";
import { reserveFeaturedCanvasSlot } from "../lib/scene-budget";

type FeaturedCardSceneProps = {
  card: PlayerCardWithPlayer;
  className?: string;
};

function frameByRarity(rarity?: string): string {
  const r = String(rarity || "common").toLowerCase();
  if (r === "legendary") return "/frames/legendary.svg";
  if (r === "epic") return "/frames/epic.svg";
  if (r === "unique") return "/frames/unique.svg";
  if (r === "rare") return "/frames/rare.svg";
  return "/frames/common.svg";
}

function rarityEdgeColor(rarity?: string): string {
  const r = String(rarity || "common").toLowerCase();
  if (r === "legendary") return "#ff9123";
  if (r === "epic") return "#ffc246";
  if (r === "unique") return "#b154ff";
  if (r === "rare") return "#45a2ff";
  return "#a1a1aa";
}

function rarityGlowClass(rarity?: string): string {
  const r = String(rarity || "common").toLowerCase();
  if (r === "legendary") return "shadow-[0_0_40px_rgba(255,145,35,0.35)]";
  if (r === "epic") return "shadow-[0_0_34px_rgba(255,194,70,0.32)]";
  if (r === "unique") return "shadow-[0_0_30px_rgba(177,84,255,0.32)]";
  if (r === "rare") return "shadow-[0_0_28px_rgba(69,162,255,0.30)]";
  return "shadow-[0_0_18px_rgba(255,255,255,0.10)]";
}

function statValue(card: PlayerCardWithPlayer, key: string, fallback: number) {
  const stats = (card as any)?.player?.stats || (card as any)?.stats || {};
  return stats?.[key] ?? fallback;
}

function FeaturedCardMesh({ edgeColor }: { edgeColor: string }) {
  const pulseRef = useRef<THREE.Mesh>(null);
  const keyRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const pulse = 0.82 + Math.sin(t * 1.5) * 0.12;

    if (pulseRef.current) {
      const s = 1 + Math.sin(t * 1.3) * 0.035;
      pulseRef.current.scale.set(s, s, 1);
    }

    if (keyRef.current) {
      keyRef.current.intensity = 1.0 * pulse;
    }
  });

  return (
    <Float speed={1.1} rotationIntensity={0.18} floatIntensity={0.28}>
      <group>
        <pointLight
          ref={keyRef}
          position={[0, 1.1, 1.8]}
          intensity={1}
          color={edgeColor}
          distance={8}
          decay={1.6}
        />

        <mesh ref={pulseRef} position={[0, 0.05, -0.28]}>
          <planeGeometry args={[3.0, 4.0]} />
          <meshBasicMaterial
            color={edgeColor}
            transparent
            opacity={0.12}
            depthWrite={false}
          />
        </mesh>

        <RoundedBox args={[2.22, 3.14, 0.14]} radius={0.12} smoothness={6}>
          <meshStandardMaterial
            color="#0a0d14"
            emissive={edgeColor}
            emissiveIntensity={0.08}
            roughness={0.42}
            metalness={0.28}
          />
        </RoundedBox>

        <mesh position={[0, 0.82, 0.075]} rotation={[0, 0, -0.18]}>
          <planeGeometry args={[1.8, 0.55]} />
          <meshStandardMaterial
            color="#ffffff"
            transparent
            opacity={0.09}
            roughness={0.2}
            metalness={0.1}
          />
        </mesh>

        <mesh position={[0, -1.78, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[2.8, 2.8]} />
          <meshBasicMaterial
            color={edgeColor}
            transparent
            opacity={0.10}
            depthWrite={false}
          />
        </mesh>
      </group>
    </Float>
  );
}

function FeaturedCardFace({
  card,
  imageUrl,
}: {
  card: PlayerCardWithPlayer;
  imageUrl: string;
}) {
  const loosePlayer = (card.player || {}) as any;
  const rarity = String(card.rarity || "common").toLowerCase();
  const edgeColor = rarityEdgeColor(rarity);
  const frameUrl = frameByRarity(rarity);

  const playerName =
    card.player?.name ||
    `${loosePlayer?.firstName || ""} ${loosePlayer?.lastName || ""}`.trim() ||
    "Unknown Player";

  const club =
    (card.player as any)?.club?.name ||
    (card.player as any)?.club ||
    "FantasyFC";

  const rating =
    (card as any)?.overallRating ||
    (card.player as any)?.overallRating ||
    (card as any)?.rating ||
    85;

  const position =
    (card.player as any)?.position ||
    (card as any)?.position ||
    "MID";

  const pac = statValue(card, "pac", 90);
  const sho = statValue(card, "sho", 88);
  const pas = statValue(card, "pas", 82);
  const dri = statValue(card, "dri", 94);
  const def = statValue(card, "def", 75);
  const phy = statValue(card, "phy", 84);

  return (
    <div
      className={[
        "absolute inset-0 z-10 overflow-hidden rounded-[24px]",
        "pointer-events-none",
        rarityGlowClass(rarity),
      ].join(" ")}
    >
      {/* frame */}
      <img
        src={frameUrl}
        alt=""
        className="absolute inset-0 h-full w-full object-cover opacity-95"
        draggable={false}
      />

      {/* portrait zone */}
      <div className="absolute inset-x-[8%] top-[9%] bottom-[24%] overflow-hidden rounded-[20px]">
        <img
          src={imageUrl}
          alt={playerName}
          className="h-full w-full object-cover object-top"
          loading="lazy"
          decoding="async"
          draggable={false}
          style={{
            filter: "contrast(1.08) saturate(1.06) brightness(0.98)",
          }}
        />

        {/* strong stadium glow behind player */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 50% 34%, rgba(255,255,255,0.28), transparent 28%), linear-gradient(180deg, rgba(255,255,255,0.12), transparent 22%, transparent 58%, rgba(0,0,0,0.62) 84%, rgba(0,0,0,0.92) 100%)",
          }}
        />

        {/* rarity tint */}
        <div
          className="absolute inset-0 mix-blend-screen opacity-30"
          style={{
            background: `radial-gradient(circle at 50% 38%, ${edgeColor}55, transparent 55%)`,
          }}
        />

        {/* subtle particles/light streak */}
        <div
          className="absolute inset-0 opacity-45"
          style={{
            background:
              "linear-gradient(115deg, transparent 18%, rgba(255,255,255,0.14) 34%, transparent 48%), linear-gradient(250deg, transparent 62%, rgba(255,255,255,0.10) 72%, transparent 82%)",
          }}
        />
      </div>

      {/* rating / position */}
      <div className="absolute left-[9%] top-[8.5%] z-20">
        <div className="text-[54px] font-black leading-none text-white drop-shadow-[0_6px_24px_rgba(0,0,0,0.55)]">
          {rating}
        </div>
        <div
          className="mt-2 inline-flex min-w-[52px] items-center justify-center rounded-md border px-3 py-1 text-[20px] font-bold leading-none"
          style={{
            borderColor: `${edgeColor}99`,
            color: "#fff",
            background: "rgba(0,0,0,0.35)",
            boxShadow: `0 0 18px ${edgeColor}33`,
          }}
        >
          {position}
        </div>
      </div>

      {/* rarity label */}
      <div className="absolute left-1/2 top-[59%] z-20 -translate-x-1/2">
        <div
          className="rounded-full px-4 py-1 text-[11px] font-bold uppercase tracking-[0.28em]"
          style={{
            color: "#fff",
            background: "rgba(0,0,0,0.28)",
            border: `1px solid ${edgeColor}80`,
            boxShadow: `0 0 16px ${edgeColor}33`,
          }}
        >
          {rarity}
        </div>
      </div>

      {/* name / club */}
      <div className="absolute inset-x-[10%] bottom-[19%] z-20 text-center">
        <div className="text-[20px] font-semibold uppercase tracking-[0.12em] text-[#ffd88f]">
          {playerName.split(" ")[0] || playerName}
        </div>
        <div className="mt-1 text-[36px] font-black uppercase leading-none text-[#ffd88f] drop-shadow-[0_8px_24px_rgba(0,0,0,0.55)]">
          {playerName.split(" ").slice(1).join(" ") || playerName}
        </div>
        <div className="mt-2 text-[13px] font-medium uppercase tracking-[0.2em] text-white/60">
          {club}
        </div>
      </div>

      {/* stats panel */}
      <div className="absolute inset-x-[8%] bottom-[5.8%] z-20 grid grid-cols-2 gap-4">
        {[[
          [pac, "PAC"],
          [sho, "SHO"],
          [pas, "PAS"],
        ], [
          [dri, "DRI"],
          [def, "DEF"],
          [phy, "PHY"],
        ]].map((col, i) => (
          <div
            key={i}
            className="rounded-[16px] border px-4 py-3"
            style={{
              borderColor: `${edgeColor}55`,
              background:
                "linear-gradient(180deg, rgba(8,10,18,0.82), rgba(3,4,8,0.94))",
              boxShadow: `inset 0 0 18px ${edgeColor}20`,
            }}
          >
            {col.map(([value, label]) => (
              <div
                key={label}
                className="flex items-center justify-between py-[2px]"
              >
                <span className="text-[15px] font-black text-[#ffd88f]">
                  {value}
                </span>
                <span className="text-[15px] font-medium tracking-[0.18em] text-[#ffd88f]">
                  {label}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* global glow */}
      <div
        className="absolute inset-0"
        style={{
          boxShadow: `inset 0 0 40px ${edgeColor}25`,
        }}
      />
    </div>
  );
}

function FeaturedCardSceneBase({ card, className }: FeaturedCardSceneProps) {
  const [useCanvas, setUseCanvas] = useState(false);

  useEffect(() => {
    const slot = reserveFeaturedCanvasSlot();
    setUseCanvas(slot.allowed);
    return () => {
      slot.release();
    };
  }, []);

  const imageUrl = useMemo(() => {
    const candidates = buildCardImageCandidates(card, {
      thumb: false,
      width: 900,
      format: "webp",
    });
    return candidates[0] || "/images/player-1.png";
  }, [card]);

  if (!useCanvas) {
    return (
      <div className={className || "relative h-[520px] w-[360px]"}>
        <div className="absolute inset-0 rounded-[26px] bg-slate-950/90" />
        <FeaturedCardFace card={card} imageUrl={imageUrl} />
      </div>
    );
  }

  return (
    <div className={className || "relative h-[520px] w-[360px]"}>
      <div className="absolute inset-0">
        <Canvas
          dpr={[1, 1.5]}
          camera={{ position: [0, 0.18, 5], fov: 34 }}
          gl={{ antialias: true, alpha: true }}
        >
          <ambientLight intensity={0.42} />
          <directionalLight position={[3, 5, 4]} intensity={1.05} />
          <directionalLight position={[-2.5, 2, 2]} intensity={0.42} />
          <Environment preset="city" />

          <FeaturedCardMesh edgeColor={rarityEdgeColor(card.rarity)} />

          <mesh position={[0, -1.68, -0.12]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[4.8, 4.8]} />
            <meshStandardMaterial
              color="#0b1220"
              metalness={0.25}
              roughness={0.3}
              transparent
              opacity={0.34}
            />
          </mesh>

          <ContactShadows
            position={[0, -1.58, 0]}
            opacity={0.42}
            scale={8}
            blur={2.2}
            far={6}
          />
        </Canvas>
      </div>

      <FeaturedCardFace card={card} imageUrl={imageUrl} />
    </div>
  );
}

const FeaturedCardScene = memo(FeaturedCardSceneBase);

export default FeaturedCardScene;