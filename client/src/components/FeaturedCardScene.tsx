import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, RoundedBox, ContactShadows, Environment, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { type PlayerCardWithPlayer } from "../../../shared/schema";
import { buildCardImageCandidates } from "../lib/card-image";
import { reserveFeaturedCanvasSlot } from "../lib/scene-budget";

type FeaturedCardSceneProps = {
  card: PlayerCardWithPlayer;
  className?: string;
};

function FeaturedCardMesh({ imageUrl, edgeColor }: { imageUrl: string; edgeColor: string }) {
  const texture = useTexture(imageUrl);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;

  const frameTexture = useTexture(frameByEdgeColor(edgeColor));
  frameTexture.colorSpace = THREE.SRGBColorSpace;
  frameTexture.anisotropy = 8;

  const pulseRef = useRef<THREE.Mesh>(null);
  const keyRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const pulse = 0.75 + Math.sin(t * 1.5) * 0.15;
    if (pulseRef.current) {
      pulseRef.current.scale.setScalar(1 + Math.sin(t * 1.3) * 0.04);
    }
    if (keyRef.current) {
      keyRef.current.intensity = 1.05 * pulse;
    }
  });

  return (
    <Float speed={1.2} rotationIntensity={0.25} floatIntensity={0.35}>
      <group>
        <pointLight ref={keyRef} position={[0, 1.2, 1.8]} intensity={1.05} color={edgeColor} distance={8} decay={1.6} />

        <mesh ref={pulseRef} position={[0, 0.1, -0.32]}>
          <planeGeometry args={[3.2, 4.2]} />
          <meshBasicMaterial color={edgeColor} transparent opacity={0.14} depthWrite={false} />
        </mesh>

        <RoundedBox args={[2.15, 3.05, 0.12]} radius={0.11} smoothness={6}>
          <meshStandardMaterial color={edgeColor} roughness={0.4} metalness={0.3} />
        </RoundedBox>

        <mesh position={[0, 0, 0.064]}>
          <planeGeometry args={[2.0, 2.9]} />
          <meshStandardMaterial map={texture} roughness={0.35} metalness={0.1} />
        </mesh>

        <mesh position={[0, 0, 0.072]}>
          <planeGeometry args={[2.15, 3.05]} />
          <meshStandardMaterial map={frameTexture} transparent opacity={0.96} roughness={0.25} metalness={0.35} />
        </mesh>

        <mesh position={[0, 0.65, 0.066]} rotation={[0, 0, -0.2]}>
          <planeGeometry args={[1.85, 0.65]} />
          <meshStandardMaterial transparent opacity={0.12} color="#ffffff" />
        </mesh>

        <mesh position={[0, -1.75, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[2.7, 2.7]} />
          <meshBasicMaterial color={edgeColor} transparent opacity={0.12} depthWrite={false} />
        </mesh>
      </group>
    </Float>
  );
}

function frameByEdgeColor(edgeColor: string): string {
  if (edgeColor === "#ff9123") return "/frames/legendary.svg";
  if (edgeColor === "#ffc246") return "/frames/epic.svg";
  if (edgeColor === "#b154ff") return "/frames/unique.svg";
  if (edgeColor === "#45a2ff") return "/frames/rare.svg";
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
    const candidates = buildCardImageCandidates(card, { thumb: false, width: 768, format: "webp" });
    return candidates[0] || "/images/player-1.png";
  }, [card]);

  if (!useCanvas) {
    return (
      <div className={className || "h-[360px] w-[260px]"}>
        <div className="h-full w-full overflow-hidden rounded-xl border border-white/15 bg-slate-950/90">
          <img src={imageUrl} alt={card.player?.name || "Featured player"} className="h-full w-full object-cover" loading="lazy" decoding="async" />
        </div>
      </div>
    );
  }

  return (
    <div className={className || "h-[360px] w-[260px]"}>
      <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0.25, 5], fov: 36 }} gl={{ antialias: true, alpha: true }}>
        <ambientLight intensity={0.45} />
        <directionalLight position={[3, 5, 4]} intensity={1.1} />
        <directionalLight position={[-2.5, 2, 2]} intensity={0.45} />
        <Environment preset="city" />

        <FeaturedCardMesh imageUrl={imageUrl} edgeColor={rarityEdgeColor(card.rarity)} />

        <mesh position={[0, -1.6, -0.12]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[4.5, 4.5]} />
          <meshStandardMaterial color="#0b1220" metalness={0.25} roughness={0.3} transparent opacity={0.35} />
        </mesh>

        <ContactShadows position={[0, -1.55, 0]} opacity={0.45} scale={8} blur={2.2} far={6} />
      </Canvas>
    </div>
  );
}

const FeaturedCardScene = memo(FeaturedCardSceneBase);

export default FeaturedCardScene;
