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
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const media = window.matchMedia("(hover: none), (pointer: coarse)");
    const update = () => setIsTouchDevice(Boolean(media.matches));

    update();
    media.addEventListener("change", update);

    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!isTouchDevice && isFlipped) {
      setIsFlipped(false);
    }
  }, [isTouchDevice, isFlipped]);

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
  const appearances = statValue(card, "apps", statValue(card, "appearances", 34));
  const goals = statValue(card, "goals", 28);
  const distance = statValue(card, "distance", 312);

  const rarityShadow =
    rarity === "legendary"
      ? "0 0 30px rgba(241,196,15,0.42)"
      : rarity === "unique"
        ? "0 0 30px rgba(106,17,203,0.38)"
        : rarity === "rare"
          ? "0 0 24px rgba(58,123,213,0.34)"
          : "0 0 14px rgba(255,255,255,0.14)";

  return (
    <div className="absolute inset-0 z-10 [perspective:1200px]">
      <div
        className="group/card h-full w-full"
        role={isTouchDevice ? "button" : undefined}
        tabIndex={isTouchDevice ? 0 : undefined}
        aria-label={isTouchDevice ? "Flip featured card" : undefined}
        onClick={isTouchDevice ? () => setIsFlipped((prev) => !prev) : undefined}
        onKeyDown={
          isTouchDevice
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setIsFlipped((prev) => !prev);
                }
              }
            : undefined
        }
      >
        <div
          className={[
            "relative h-full w-full transition-transform duration-700 [transform-style:preserve-3d]",
            isTouchDevice ? (isFlipped ? "[transform:rotateY(180deg)]" : "") : "group-hover/card:[transform:rotateY(180deg)]",
          ].join(" ")}
        >
          <div
            className={[
              "absolute inset-0 overflow-hidden rounded-[20px] border-2 bg-[#111] [backface-visibility:hidden]",
              rarityGlowClass(rarity),
            ].join(" ")}
            style={{ borderColor: edgeColor, boxShadow: rarityShadow }}
          >
            <img
              src={imageUrl}
              alt={playerName}
              className="absolute inset-0 h-full w-full object-cover object-top"
              loading="lazy"
              decoding="async"
              draggable={false}
              style={{
                filter: "contrast(1.1) saturate(1.06) brightness(0.98)",
                maskImage: "linear-gradient(to bottom, black 60%, transparent 100%)",
              }}
            />

            <img src={frameUrl} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-95" loading="lazy" decoding="async" draggable={false} />

            <div
              className="pointer-events-none absolute inset-0 opacity-45 animate-[atmoFloat_4s_ease-in-out_infinite]"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 18% 24%, rgba(255,255,255,0.38) 1px, transparent 2px), radial-gradient(circle at 72% 20%, rgba(255,255,255,0.3) 1px, transparent 2px), radial-gradient(circle at 64% 78%, rgba(255,255,255,0.24) 1px, transparent 2px)",
                backgroundSize: "130px 130px, 160px 160px, 140px 140px",
              }}
            />

            <div className="absolute bottom-0 z-20 w-full bg-gradient-to-t from-black/90 via-black/65 to-transparent p-5 text-center">
              <p className="m-0 text-[48px] leading-none text-white font-black">{rating}</p>
              <p className="mt-1 text-2xl uppercase tracking-[0.12em] text-white">{playerName}</p>
              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/20 pt-3 text-sm text-zinc-200">
                <div className="font-normal"><b className="mr-1 text-white">{pac}</b>PAC</div>
                <div className="font-normal"><b className="mr-1 text-white">{dri}</b>DRI</div>
                <div className="font-normal"><b className="mr-1 text-white">{sho}</b>SHO</div>
                <div className="font-normal"><b className="mr-1 text-white">{def}</b>DEF</div>
              </div>
              {isTouchDevice && (
                <p className="mt-3 text-[10px] uppercase tracking-[0.16em] text-white/60">
                  Tap For {isFlipped ? "Front" : "Stats"}
                </p>
              )}
            </div>
          </div>

          <div className="absolute inset-0 rounded-[20px] border border-white/15 bg-[#1a1a1a] p-8 text-white [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <h2 className="text-xl font-black uppercase tracking-[0.1em]">Season Summary</h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between border-b border-zinc-700 pb-2"><span>Appearances</span><span>{appearances}</span></div>
              <div className="flex justify-between border-b border-zinc-700 pb-2"><span>Goals Scored</span><span>{goals}</span></div>
              <div className="flex justify-between border-b border-zinc-700 pb-2"><span>Distance Run</span><span>{distance} km</span></div>
              <div className="flex justify-between border-b border-zinc-700 pb-2"><span>Club</span><span>{club}</span></div>
              <div className="flex justify-between border-b border-zinc-700 pb-2"><span>Position</span><span>{position}</span></div>
              <div className="flex justify-between border-b border-zinc-700 pb-2"><span>PAS / PHY</span><span>{pas} / {phy}</span></div>
            </div>
            <p className="mt-10 text-center text-[10px] text-zinc-500 uppercase tracking-[0.14em]">{String(rarity).toUpperCase()} ITEM #{card.serialNumber || 1}</p>
          </div>
        </div>
      </div>
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