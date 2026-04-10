import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, RoundedBox } from "@react-three/drei";
import { Bloom, ChromaticAberration, EffectComposer, Noise, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { type PlayerCardWithPlayer } from "../../../shared/schema";

export type RevealRarity = "common" | "rare" | "epic" | "legendary";

type RevealEngineProps = {
  cardData: PlayerCardWithPlayer;
  rarity: RevealRarity;
  duration?: number;
  replayKey?: number;
  onComplete?: () => void;
};

type Preset = {
  duration: number;
  bloom: number;
  vignette: number;
  aberration: number;
  grain: number;
  keyColor: string;
  rimColor: string;
  fillColor: string;
  particleColor: string;
  particleCount: number;
  particleSpeed: number;
  slamTime: number;
  cameraShake: number;
};

const PRESETS: Record<RevealRarity, Preset> = {
  common: {
    duration: 5,
    bloom: 0.35,
    vignette: 0.18,
    aberration: 0.0008,
    grain: 0.06,
    keyColor: "#a7d4ff",
    rimColor: "#d7efff",
    fillColor: "#92b7d6",
    particleColor: "#cce8ff",
    particleCount: 80,
    particleSpeed: 0.7,
    slamTime: 0.8,
    cameraShake: 0.04,
  },
  rare: {
    duration: 8,
    bloom: 0.55,
    vignette: 0.22,
    aberration: 0.0012,
    grain: 0.07,
    keyColor: "#55b1ff",
    rimColor: "#8ed1ff",
    fillColor: "#5f90bf",
    particleColor: "#5fb7ff",
    particleCount: 140,
    particleSpeed: 1,
    slamTime: 0.68,
    cameraShake: 0.08,
  },
  epic: {
    duration: 12,
    bloom: 0.85,
    vignette: 0.32,
    aberration: 0.0019,
    grain: 0.09,
    keyColor: "#b06bff",
    rimColor: "#d5aaff",
    fillColor: "#7d5f9e",
    particleColor: "#b66fff",
    particleCount: 220,
    particleSpeed: 1.3,
    slamTime: 0.62,
    cameraShake: 0.14,
  },
  legendary: {
    duration: 16,
    bloom: 1.25,
    vignette: 0.42,
    aberration: 0.0023,
    grain: 0.11,
    keyColor: "#ffc84a",
    rimColor: "#ffe8a8",
    fillColor: "#b88a2d",
    particleColor: "#ffd56a",
    particleCount: 340,
    particleSpeed: 1.55,
    slamTime: 0.56,
    cameraShake: 0.24,
  },
};

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function smoothInOut(value: number) {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

function getPlayerImage(player?: PlayerCardWithPlayer["player"]): string {
  const raw = String(player?.imageUrl || "").trim();
  if (!raw) return "/images/player-1.png";
  if (/^https?:\/\//i.test(raw)) {
    return `/api/image-proxy?url=${encodeURIComponent(raw)}`;
  }
  return raw.startsWith("/") ? raw : `/${raw}`;
}

function makeTextTexture(card: PlayerCardWithPlayer): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(9, 14, 24, 0.82)";
  ctx.fillRect(0, 340, canvas.width, 172);

  const player = card.player;
  ctx.fillStyle = "#f8fafc";
  ctx.font = "700 62px Inter, system-ui, sans-serif";
  ctx.fillText(String(player?.name || "Unknown Player"), 40, 420);

  ctx.fillStyle = "#cbd5e1";
  ctx.font = "500 34px Inter, system-ui, sans-serif";
  ctx.fillText(`${String(player?.team || "Unknown Team")} • ${String(player?.position || "MID")}`, 40, 468);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function makeBadgeTexture(rarity: RevealRarity, overall?: number | null): THREE.CanvasTexture {
  const colorByRarity: Record<RevealRarity, string> = {
    common: "#93c5fd",
    rare: "#3b82f6",
    epic: "#a855f7",
    legendary: "#f59e0b",
  };
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(10, 15, 30, 0.88)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = colorByRarity[rarity];
  ctx.lineWidth = 8;
  ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);

  ctx.fillStyle = colorByRarity[rarity];
  ctx.font = "700 58px Inter, system-ui, sans-serif";
  ctx.fillText(rarity.toUpperCase(), 28, 92);

  ctx.fillStyle = "#f8fafc";
  ctx.font = "800 120px Inter, system-ui, sans-serif";
  ctx.fillText(String(Math.max(0, Number(overall || 0))), 26, 212);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function CardBody({
  card,
  rarity,
  groupRef,
  slamPulseRef,
}: {
  card: PlayerCardWithPlayer;
  rarity: RevealRarity;
  groupRef: MutableRefObject<THREE.Group | null>;
  slamPulseRef: MutableRefObject<number>;
}) {
  const foilRef = useRef<THREE.Mesh>(null);

  const playerTexture = useMemo(() => {
    const loader = new THREE.TextureLoader();
    const texture = loader.load(getPlayerImage(card.player));
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, [card.player]);

  const textTexture = useMemo(() => makeTextTexture(card), [card]);
  const badgeTexture = useMemo(() => makeBadgeTexture(rarity, card.player?.overall), [rarity, card.player?.overall]);

  const foilTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (!ctx) return new THREE.CanvasTexture(canvas);
    const gradient = ctx.createLinearGradient(0, 0, 512, 512);
    gradient.addColorStop(0, "rgba(255,255,255,0)");
    gradient.addColorStop(0.48, "rgba(255,255,255,0.26)");
    gradient.addColorStop(0.52, "rgba(255,255,255,0.04)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.needsUpdate = true;
    return texture;
  }, []);

  useFrame((_state, delta) => {
    if (foilRef.current) {
      const material = foilRef.current.material as THREE.MeshBasicMaterial;
      if (material.map) {
        material.map.offset.x = (material.map.offset.x + delta * 0.18) % 1;
      }
      material.opacity = 0.22 + slamPulseRef.current * 0.35;
    }
  });

  return (
    <group ref={groupRef}>
      <RoundedBox args={[2.24, 3.34, 0.12]} radius={0.12} smoothness={8}>
        <meshPhysicalMaterial color="#0f172a" roughness={0.22} metalness={0.7} clearcoat={1} reflectivity={1} />
      </RoundedBox>

      <mesh position={[0, 0.26, 0.07]}>
        <planeGeometry args={[2.05, 2.22]} />
        <meshBasicMaterial map={playerTexture} toneMapped={false} />
      </mesh>

      <mesh position={[0, -0.82, 0.074]}>
        <planeGeometry args={[2.08, 1.06]} />
        <meshBasicMaterial map={textTexture} transparent toneMapped={false} />
      </mesh>

      <mesh position={[0.72, 1.1, 0.076]}>
        <planeGeometry args={[0.6, 0.54]} />
        <meshBasicMaterial map={badgeTexture} transparent toneMapped={false} />
      </mesh>

      <mesh ref={foilRef} position={[0, 0, 0.079]}>
        <planeGeometry args={[2.1, 3.2]} />
        <meshBasicMaterial map={foilTexture} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

function ParticleField({ rarity, mobile }: { rarity: RevealRarity; mobile: boolean }) {
  const preset = PRESETS[rarity];
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const count = Math.max(28, Math.floor(preset.particleCount * (mobile ? 0.42 : 1)));

  const particles = useMemo(
    () =>
      Array.from({ length: count }, (_, index) => ({
        radius: 1.4 + Math.random() * 3.2,
        angle: (index / count) * Math.PI * 2,
        y: -1.2 + Math.random() * 3.4,
        speed: (0.18 + Math.random() * 0.6) * preset.particleSpeed,
        phase: Math.random() * Math.PI * 2,
      })),
    [count, preset.particleSpeed],
  );

  useEffect(() => {
    if (!meshRef.current) return;
    const color = new THREE.Color(preset.particleColor);
    for (let i = 0; i < particles.length; i += 1) {
      meshRef.current.setColorAt(i, color);
    }
    meshRef.current.instanceColor!.needsUpdate = true;
  }, [particles.length, preset.particleColor]);

  useFrame((_state, delta) => {
    if (!meshRef.current) return;
    for (let i = 0; i < particles.length; i += 1) {
      const p = particles[i];
      p.angle += delta * p.speed * (rarity === "epic" || rarity === "legendary" ? 1.6 : 0.9);
      p.y += delta * p.speed * 0.55;
      if (p.y > 2.4) p.y = -1.2;
      const vortex = rarity === "epic" || rarity === "legendary";
      const r = vortex ? Math.max(0.35, p.radius - (p.y + 1.2) * 0.22) : p.radius;
      dummy.position.set(Math.cos(p.angle + p.phase) * r, p.y, Math.sin(p.angle + p.phase) * r - 1.9);
      const s = 0.015 + (rarity === "legendary" ? 0.018 : 0.012) + Math.sin(p.angle * 2) * 0.003;
      dummy.scale.setScalar(Math.max(0.005, s));
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial transparent opacity={0.88} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
    </instancedMesh>
  );
}

function RevealSceneContent({ cardData, rarity, duration, onComplete }: RevealEngineProps) {
  const preset = PRESETS[rarity];
  const runtimeDuration = duration ?? preset.duration;
  const startedAtRef = useRef<number | null>(null);
  const completedRef = useRef(false);
  const keyLightRef = useRef<THREE.SpotLight>(null);
  const rimLightRef = useRef<THREE.PointLight>(null);
  const shockwaveRef = useRef<THREE.Mesh>(null);
  const floorRef = useRef<THREE.Mesh>(null);
  const lionRef = useRef<THREE.Mesh>(null);
  const confettiRef = useRef<THREE.Points>(null);
  const cardGroupRef = useRef<THREE.Group>(null);
  const energyLineRef = useRef<THREE.Mesh>(null);
  const slamPulseRef = useRef(0);
  const progressRef = useRef(0);
  const bassPlayedRef = useRef(false);

  const mobile = typeof window !== "undefined" && window.innerWidth < 768;
  const reducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const confettiPositions = useMemo(() => {
    const count = mobile ? 120 : 260;
    const data = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      data[i * 3] = (Math.random() - 0.5) * 7;
      data[i * 3 + 1] = 3 + Math.random() * 3;
      data[i * 3 + 2] = -1.4 + (Math.random() - 0.5) * 2;
    }
    return data;
  }, [mobile]);

  const bassHitRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    bassHitRef.current = new Audio("/sfx/pack_open.wav");
    if (bassHitRef.current) bassHitRef.current.volume = 0.7;
    return () => {
      bassHitRef.current?.pause();
      bassHitRef.current = null;
    };
  }, []);

  useFrame((state, delta) => {
    if (startedAtRef.current === null) startedAtRef.current = state.clock.elapsedTime;
    const elapsed = state.clock.elapsedTime - startedAtRef.current;
    const progress = clamp01(elapsed / runtimeDuration);
    progressRef.current = progress;

    const dolly = smoothInOut(progress < 0.35 ? progress / 0.35 : 1);
    const orbitPhase = progress * Math.PI * (rarity === "legendary" ? 1.5 : 1);
    const orbitX = Math.sin(orbitPhase) * (rarity === "common" ? 0.45 : 0.68);
    const orbitY = 0.95 + Math.sin(orbitPhase * 0.6) * 0.08;

    const hitDistance = Math.abs(progress - preset.slamTime);
    const slamPulse = Math.exp(-hitDistance * 90);
    slamPulseRef.current = slamPulse;
    const shake = reducedMotion ? 0 : slamPulse * preset.cameraShake;

    state.camera.position.x = THREE.MathUtils.lerp(state.camera.position.x, orbitX + (Math.random() - 0.5) * shake, 0.1);
    state.camera.position.y = THREE.MathUtils.lerp(state.camera.position.y, orbitY + (Math.random() - 0.5) * shake, 0.1);
    state.camera.position.z = THREE.MathUtils.lerp(state.camera.position.z, 4.9 - dolly * 1.25 + (Math.random() - 0.5) * shake, 0.1);
    state.camera.lookAt(0, 0.3, 0);

    if (keyLightRef.current) {
      keyLightRef.current.intensity = 2.3 + slamPulse * (rarity === "legendary" ? 8.4 : 3.2);
    }
    if (rimLightRef.current) {
      rimLightRef.current.intensity = 1.3 + slamPulse * (rarity === "legendary" ? 4.2 : 1.8);
    }

    if (floorRef.current) {
      const material = floorRef.current.material as THREE.MeshStandardMaterial;
      const base = rarity === "legendary" ? 0.85 : rarity === "epic" ? 0.45 : 0.22;
      material.emissiveIntensity = base + slamPulse * (rarity === "legendary" ? 3 : 1.1);
    }

    if (energyLineRef.current) {
      const lineMaterial = energyLineRef.current.material as THREE.MeshBasicMaterial;
      const lineProgress = clamp01((progress - 0.18) / 0.4);
      energyLineRef.current.position.z = THREE.MathUtils.lerp(3.8, 0.2, lineProgress);
      lineMaterial.opacity = rarity === "rare" ? (1 - lineProgress) * 0.9 : 0;
      energyLineRef.current.visible = rarity === "rare" && lineProgress < 1;
    }

    if (shockwaveRef.current) {
      const active = progress > preset.slamTime;
      shockwaveRef.current.visible = active;
      if (active) {
        const local = clamp01((progress - preset.slamTime) / 0.17);
        const scale = 0.5 + local * (rarity === "legendary" ? 7.5 : 4.5);
        shockwaveRef.current.scale.set(scale, scale, 1);
        const material = shockwaveRef.current.material as THREE.MeshBasicMaterial;
        material.opacity = (1 - local) * (rarity === "legendary" ? 0.92 : 0.62);
      }
    }

    if (lionRef.current) {
      lionRef.current.visible = rarity === "legendary";
      lionRef.current.rotation.y += delta * 0.5;
      lionRef.current.position.y = 1.35 + Math.sin(state.clock.elapsedTime * 2.2) * 0.08;
    }

    if (confettiRef.current) {
      confettiRef.current.visible = rarity === "legendary" && progress > preset.slamTime;
      const attr = confettiRef.current.geometry.attributes.position;
      const arr = attr.array as Float32Array;
      for (let i = 0; i < arr.length; i += 3) {
        arr[i + 1] -= delta * 0.9;
        arr[i] += Math.sin(state.clock.elapsedTime + i) * 0.001;
        if (arr[i + 1] < -1.5) arr[i + 1] = 3 + Math.random() * 2;
      }
      attr.needsUpdate = true;
    }

    if (!bassPlayedRef.current && progress >= preset.slamTime) {
      bassPlayedRef.current = true;
      bassHitRef.current?.play().catch(() => undefined);
    }

    if (!completedRef.current && progress >= 1) {
      completedRef.current = true;
      onComplete?.();
    }

    if (cardGroupRef.current) {
      if (rarity === "legendary") {
        if (progress < preset.slamTime) {
          const down = smoothInOut(progress / preset.slamTime);
          cardGroupRef.current.position.y = 3.8 - down * 4.8;
          cardGroupRef.current.rotation.x = -0.25 + (1 - down) * 0.5;
          cardGroupRef.current.rotation.y += delta * 0.7;
        } else {
          const settle = clamp01((progress - preset.slamTime) / 0.23);
          const bounce = Math.sin(settle * Math.PI * 3.2) * (1 - settle) * 0.22;
          cardGroupRef.current.position.y = -1 + settle * 1.35 + bounce;
          cardGroupRef.current.rotation.x = THREE.MathUtils.lerp(cardGroupRef.current.rotation.x, -0.04 + slamPulse * 0.05, 0.16);
          cardGroupRef.current.rotation.y = THREE.MathUtils.lerp(cardGroupRef.current.rotation.y, Math.sin(progress * Math.PI) * 0.12, 0.08);
        }
      } else if (rarity === "epic") {
        const appear = smoothInOut(clamp01((progress - 0.08) / 0.36));
        const spin = Math.sin(progress * Math.PI * 3) * 0.2;
        cardGroupRef.current.position.y = -1.4 + appear * 1.75;
        const scale = 0.64 + appear * 0.36;
        cardGroupRef.current.scale.set(scale, scale, scale);
        cardGroupRef.current.rotation.y = spin;
        cardGroupRef.current.rotation.x = -0.08;
      } else {
        const rise = smoothInOut(progress / 0.35);
        const spin = rarity === "rare" ? Math.sin(progress * Math.PI * 2.2) * 0.22 : Math.sin(progress * Math.PI) * 0.06;
        cardGroupRef.current.position.y = -1.05 + rise * 1.45;
        cardGroupRef.current.rotation.x = THREE.MathUtils.lerp(cardGroupRef.current.rotation.x, -0.05 + slamPulse * 0.03, 0.12);
        cardGroupRef.current.rotation.y = THREE.MathUtils.lerp(cardGroupRef.current.rotation.y, spin, 0.1);
      }
    }
  });

  return (
    <>
      <color attach="background" args={["#03050a"]} />
      <fog attach="fog" args={["#03050a", 4, 14]} />

      <ambientLight intensity={0.24} color="#9fb5d2" />
      <spotLight ref={keyLightRef} position={[1.8, 3.6, 4.4]} angle={0.35} penumbra={0.7} intensity={2.6} color={preset.keyColor} />
      <pointLight ref={rimLightRef} position={[-2.4, 1.8, -2.6]} intensity={1.4} color={preset.rimColor} />
      <pointLight position={[0, -0.8, 2]} intensity={0.42} color={preset.fillColor} />

      <Environment preset="city" />

      <mesh ref={floorRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.1, 0]}>
        <planeGeometry args={[12, 12]} />
        <meshStandardMaterial color="#090f1e" emissive={new THREE.Color(preset.keyColor)} emissiveIntensity={0.3} roughness={0.65} metalness={0.25} />
      </mesh>

      {(rarity === "rare" || rarity === "epic" || rarity === "legendary") && (
        <gridHelper args={[10, 28, preset.keyColor, "#1e293b"]} position={[0, -1.08, 0]} />
      )}

      {rarity === "epic" && (
        <mesh position={[0, 2.15, -0.4]} rotation={[0, 0, Math.PI / 2.6]}>
          <planeGeometry args={[0.08, 4.4]} />
          <meshBasicMaterial color="#c4b5fd" transparent opacity={0.85} blending={THREE.AdditiveBlending} />
        </mesh>
      )}

      <mesh ref={energyLineRef} position={[0, -0.35, 3.8]}>
        <planeGeometry args={[0.14, 3]} />
        <meshBasicMaterial color="#60a5fa" transparent opacity={0} blending={THREE.AdditiveBlending} />
      </mesh>

      <mesh ref={lionRef} position={[0, 1.35, -1.2]}>
        <icosahedronGeometry args={[0.46, 1]} />
        <meshBasicMaterial color="#fde68a" wireframe transparent opacity={0.5} blending={THREE.AdditiveBlending} />
      </mesh>

      <CardBody card={cardData} rarity={rarity} groupRef={cardGroupRef} slamPulseRef={slamPulseRef} />
      <ParticleField rarity={rarity} mobile={mobile} />

      <mesh ref={shockwaveRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.01, 0]} visible={false}>
        <ringGeometry args={[0.7, 0.9, 64]} />
        <meshBasicMaterial color={preset.keyColor} transparent opacity={0.6} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
      </mesh>

      <points ref={confettiRef} visible={false}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={confettiPositions.length / 3}
            itemSize={3}
            array={confettiPositions}
          />
        </bufferGeometry>
        <pointsMaterial color="#fde68a" size={0.04} transparent opacity={0.95} depthWrite={false} />
      </points>

      <EffectComposer>
        <Bloom intensity={mobile ? preset.bloom * 0.62 : preset.bloom} luminanceThreshold={0.3} mipmapBlur />
        <Vignette eskil={false} offset={0.18} darkness={preset.vignette} />
        <ChromaticAberration
          offset={new THREE.Vector2(preset.aberration, preset.aberration * 0.5)}
          radialModulation={false}
          modulationOffset={0}
        />
        <Noise opacity={preset.grain} premultiply />
      </EffectComposer>
    </>
  );
}

export default function CardRevealScene({ cardData, rarity, duration, replayKey, onComplete }: RevealEngineProps) {
  const preset = PRESETS[rarity];
  const finalDuration = duration ?? preset.duration;
  const mobile = typeof window !== "undefined" && window.innerWidth < 768;

  return (
    <div className="absolute inset-0">
      <Canvas
        key={`${rarity}-${replayKey || 0}`}
        camera={{ position: [0, 1, 5], fov: mobile ? 52 : 46 }}
        dpr={mobile ? [1, 1.2] : [1, 1.7]}
        gl={{ antialias: !mobile, alpha: false, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = rarity === "legendary" ? 1.15 : 1;
        }}
      >
        <RevealSceneContent
          cardData={cardData}
          rarity={rarity}
          duration={finalDuration}
          replayKey={replayKey}
          onComplete={onComplete}
        />
      </Canvas>
    </div>
  );
}

export function getRevealDuration(rarity: RevealRarity): number {
  return PRESETS[rarity].duration;
}
