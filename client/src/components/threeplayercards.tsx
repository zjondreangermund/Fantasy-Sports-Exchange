import React, { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, PerspectiveCamera, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { type PlayerCardWithPlayer } from "../../../shared/schema";

type Rarity = "common" | "rare" | "unique" | "legendary";

function toRarity(v: any): Rarity {
  const r = String(v ?? "common").toLowerCase();
  if (r === "legendary") return "legendary";
  if (r === "unique") return "unique";
  if (r === "rare") return "rare";
  return "common";
}

function rarityPalette(r: Rarity) {
  if (r === "legendary") return { metal: "#d4af37", accentA: "#fff2b3", accentB: "#f59e0b" };
  if (r === "unique") return { metal: "#6d28d9", accentA: "#c4b5fd", accentB: "#22d3ee" };
  if (r === "rare") return { metal: "#dc2626", accentA: "#fecaca", accentB: "#fb7185" };
  return { metal: "#c0c0c0", accentA: "#f5f5f5", accentB: "#94a3b8" };
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ✅ Dynamic rarity patterns (no image files)
function drawRarityPattern(ctx: CanvasRenderingContext2D, w: number, h: number, rarity: Rarity) {
  const p = rarityPalette(rarity);

  // base gradient
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, p.accentA);
  g.addColorStop(1, p.accentB);
  ctx.globalAlpha = rarity === "common" ? 0.22 : 0.30;
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 1;

  // polygon shards
  const count = rarity === "legendary" ? 140 : rarity === "unique" ? 160 : rarity === "rare" ? 130 : 110;
  for (let i = 0; i < count; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const s = 60 + Math.random() * 160;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + s, y + Math.random() * 50);
    ctx.lineTo(x + Math.random() * 50, y + s);
    ctx.closePath();

    ctx.fillStyle = `rgba(255,255,255,${Math.random() * (rarity === "unique" ? 0.10 : 0.07)})`;
    ctx.fill();
  }

  // subtle diagonal lines for “foil”
  ctx.globalAlpha = rarity === "unique" ? 0.14 : 0.09;
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 2;
  for (let i = -h; i < w; i += 80) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + h, h);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

async function buildCardFaceTexture(opts: {
  rarity: Rarity;
  photoUrl?: string | null;
  clubLogoUrl?: string | null;
  leagueLogoUrl?: string | null;
  playerName: string;
  clubName?: string;
  position?: string;
  serialNumber: number;
  maxSupply: number;
}) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1536;
  const ctx = canvas.getContext("2d")!;

  // base
  ctx.fillStyle = "#070a10";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // dynamic rarity pattern
  drawRarityPattern(ctx, canvas.width, canvas.height, opts.rarity);

  // vignette
  const vig = ctx.createRadialGradient(512, 580, 250, 512, 900, 950);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(0,0,0,0.78)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // top bar
  const pal = rarityPalette(opts.rarity);
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = pal.metal;
  ctx.fillRect(0, 0, canvas.width, 150);
  ctx.globalAlpha = 1;

  // league logo (optional)
  if (opts.leagueLogoUrl) {
    try {
      const league = await loadImage(opts.leagueLogoUrl);
      ctx.drawImage(league, 40, 28, 72, 72);
    } catch {}
  }

  // rarity label (top-right)
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = "#0b0f1a";
  drawRoundedRect(ctx, canvas.width - 300, 28, 260, 72, 18);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.fillStyle = "#fff";
  ctx.font = "900 34px Arial";
  ctx.textAlign = "right";
  ctx.fillText(opts.rarity.toUpperCase(), canvas.width - 60, 76);
  ctx.textAlign = "left";

  // photo frame
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = pal.accentA;
  drawRoundedRect(ctx, 70, 190, 884, 720, 28);
  ctx.fill();
  ctx.globalAlpha = 1;

  // player photo
  if (opts.photoUrl) {
    try {
      const img = await loadImage(opts.photoUrl);
      const box = { x: 70, y: 190, w: 884, h: 720 };
      const r = Math.max(box.w / img.width, box.h / img.height);
      const nw = img.width * r;
      const nh = img.height * r;
      const nx = box.x + (box.w - nw) / 2;
      const ny = box.y + (box.h - nh) / 2;

      ctx.save();
      drawRoundedRect(ctx, 70, 190, 884, 720, 28);
      ctx.clip();
      ctx.drawImage(img, nx, ny, nw, nh);

      // fade for text readability
      const fade = ctx.createLinearGradient(0, 740, 0, 920);
      fade.addColorStop(0, "rgba(0,0,0,0)");
      fade.addColorStop(1, "rgba(0,0,0,0.82)");
      ctx.fillStyle = fade;
      ctx.fillRect(70, 720, 884, 190);

      ctx.restore();
    } catch {}
  }

  // club logo (top-right on photo)
  if (opts.clubLogoUrl) {
    try {
      const logo = await loadImage(opts.clubLogoUrl);
      ctx.globalAlpha = 0.95;
      ctx.drawImage(logo, 870, 210, 72, 72);
      ctx.globalAlpha = 1;
    } catch {}
  }

  // name block
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = "#0b0f1a";
  drawRoundedRect(ctx, 70, 930, 884, 170, 26);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.fillStyle = "#fff";
  ctx.font = "900 62px Arial";
  ctx.fillText(String(opts.playerName ?? "PLAYER").toUpperCase(), 95, 1010);

  ctx.fillStyle = pal.accentA;
  ctx.font = "800 36px Arial";
  const line2 = `${String(opts.position ?? "").toUpperCase()}${
    opts.clubName ? " • " + String(opts.clubName).toUpperCase() : ""
  }`.trim();
  ctx.fillText(line2, 95, 1065);

  // serial (1/100)
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = "900 40px Arial";
  ctx.fillText(`${opts.serialNumber}/${opts.maxSupply}`, 930, 1065);
  ctx.textAlign = "left";

  // bottom engraved strip (placeholder for stats; you can expand later)
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = "#0b0f1a";
  drawRoundedRect(ctx, 70, 1140, 884, 300, 26);
  ctx.fill();
  ctx.globalAlpha = 1;

  // engraved border feel
  ctx.strokeStyle = "rgba(255,255,255,0.10)";
  ctx.lineWidth = 6;
  drawRoundedRect(ctx, 78, 1148, 868, 284, 22);
  ctx.stroke();
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 6;
  drawRoundedRect(ctx, 84, 1154, 856, 272, 20);
  ctx.stroke();

  ctx.fillStyle = "#fff";
  ctx.font = "900 44px Arial";
  ctx.fillText("STATS", 95, 1210);
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = "700 34px Arial";
  ctx.fillText("Engraved stats next…", 95, 1270);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

// ✅ Animated rainbow foil shader (strongest on UNIQUE)
function FoilMaterial({ strength = 0.18 }: { strength?: number }) {
  const ref = useRef<THREE.ShaderMaterial>(null);

  useFrame((state) => {
    if (!ref.current) return;
    ref.current.uniforms.uTime.value = state.clock.elapsedTime;
  });

  const mat = useMemo(() => {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uStrength: { value: strength },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform float uTime;
        uniform float uStrength;

        // cheap rainbow
        vec3 hsv2rgb(vec3 c){
          vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
          vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
          return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
        }

        void main() {
          float t = uTime * 0.35;
          float sweep = smoothstep(0.0, 1.0, fract(vUv.x + vUv.y*0.35 + t));
          float band = exp(-pow((sweep-0.55)*7.0, 2.0));

          float hue = fract(vUv.x*0.9 + vUv.y*0.6 + t*0.35);
          vec3 rainbow = hsv2rgb(vec3(hue, 0.85, 1.0));

          float alpha = band * uStrength;
          gl_FragColor = vec4(rainbow, alpha);
        }
      `,
    });
  }, [strength]);

  return <primitive ref={ref} object={mat} attach="material" />;
}

// ✅ Shine sweep (all rarities)
function ShineMaterial({ strength = 0.22 }: { strength?: number }) {
  const ref = useRef<THREE.ShaderMaterial>(null);

  useFrame((state) => {
    if (!ref.current) return;
    ref.current.uniforms.uTime.value = state.clock.elapsedTime;
  });

  const mat = useMemo(() => {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uStrength: { value: strength },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform float uTime;
        uniform float uStrength;

        void main() {
          float t = uTime * 0.55;
          float x = fract(vUv.x + t);
          float band = exp(-pow((x-0.55)*10.0, 2.0)); // sharp bright band
          float alpha = band * uStrength;
          gl_FragColor = vec4(1.0, 1.0, 1.0, alpha);
        }
      `,
    });
  }, [strength]);

  return <primitive ref={ref} object={mat} attach="material" />;
}

function Scene({
  card,
  imageUrl,
}: {
  card: PlayerCardWithPlayer;
  imageUrl?: string | null;
}) {
  const player: any = (card as any)?.player ?? {};
  const rarity = toRarity((card as any)?.rarity);

  const serialNumber = (card as any)?.serialNumber ?? (card as any)?.serial_number ?? 1;
  const maxSupply = (card as any)?.maxSupply ?? (card as any)?.max_supply ?? 100;

  const clubLogoUrl = player.clubLogo || player.club_logo || player.teamLogo || player.team_logo || null;
  const clubName = player.club || player.team || "";

  const pal = rarityPalette(rarity);

  const [faceTex, setFaceTex] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const tex = await buildCardFaceTexture({
        rarity,
        photoUrl: imageUrl ?? player.photo ?? player.photoUrl ?? player.imageUrl ?? player.image_url ?? null,
        clubLogoUrl,
        leagueLogoUrl: null, // add if you have one
        playerName: player.name ?? "PLAYER",
        clubName,
        position: player.position ?? "",
        serialNumber,
        maxSupply,
      });
      if (!alive) return;
      setFaceTex(tex);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rarity, imageUrl, player?.name, player?.position, clubLogoUrl, clubName, serialNumber, maxSupply]);

  // rounded 3D shape
  const cardShape = useMemo(() => {
    const shape = new THREE.Shape();
    const w = 2, h = 3, r = 0.22;

    shape.moveTo(-w / 2 + r, -h / 2);
    shape.lineTo(w / 2 - r, -h / 2);
    shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
    shape.lineTo(w / 2, h / 2 - r);
    shape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
    shape.lineTo(-w / 2 + r, h / 2);
    shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
    shape.lineTo(-w / 2, -h / 2 + r);
    shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
    return shape;
  }, []);

  // metal material per rarity
  const metalMat = useMemo(() => {
    return new THREE.MeshPhysicalMaterial({
      color: pal.metal,
      metalness: 1,
      roughness: rarity === "common" ? 0.35 : 0.22,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      reflectivity: 1,
      // legendary subtle glow
      emissive: rarity === "legendary" ? new THREE.Color("#7c5c12") : new THREE.Color("#000000"),
      emissiveIntensity: rarity === "legendary" ? 0.25 : 0,
    });
  }, [pal.metal, rarity]);

  // showroom “tilt animation” (NO zoom, just gentle rotate)
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    const g = groupRef.current;
    if (!g) return;
    const t = state.clock.elapsedTime;

    // base tilt: -5° (x), +12° (y)
    const baseX = THREE.MathUtils.degToRad(-5);
    const baseY = THREE.MathUtils.degToRad(12);

    // gentle showroom motion
    g.rotation.x = baseX + Math.sin(t * 0.6) * THREE.MathUtils.degToRad(1.2);
    g.rotation.y = baseY + Math.sin(t * 0.45) * THREE.MathUtils.degToRad(2.0);
    g.rotation.z = Math.sin(t * 0.35) * THREE.MathUtils.degToRad(0.6);
  });

  const foilStrength =
    rarity === "unique" ? 0.34 : rarity === "legendary" ? 0.22 : rarity === "rare" ? 0.16 : 0.10;

  const shineStrength =
    rarity === "legendary" ? 0.28 : rarity === "unique" ? 0.22 : rarity === "rare" ? 0.18 : 0.14;

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0, 5]} />
      <Environment preset="city" />
      <ambientLight intensity={0.75} />
      <spotLight position={[10, 12, 10]} angle={0.22} penumbra={1} intensity={1.6} castShadow />
      <directionalLight position={[-6, 4, 6]} intensity={0.6} />

      <group ref={groupRef}>
        {/* 3D body */}
        <mesh castShadow receiveShadow>
          <extrudeGeometry
            args={[
              cardShape,
              {
                depth: 0.14,
                bevelEnabled: true,
                bevelThickness: 0.05,
                bevelSize: 0.05,
                bevelSegments: 3,
              },
            ]}
          />
          <primitive object={metalMat} attach="material" />
        </mesh>

        {/* face texture */}
        <mesh position={[0, 0, 0.105]}>
          <planeGeometry args={[1.82, 2.72]} />
          <meshStandardMaterial map={faceTex ?? undefined} color={"#ffffff"} roughness={0.92} metalness={0.0} />
        </mesh>

        {/* animated shine sweep */}
        <mesh position={[0, 0, 0.115]}>
          <planeGeometry args={[1.84, 2.74]} />
          <ShineMaterial strength={shineStrength} />
        </mesh>

        {/* animated rainbow foil (unique strongest) */}
        <mesh position={[0, 0, 0.12]}>
          <planeGeometry args={[1.86, 2.76]} />
          <FoilMaterial strength={foilStrength} />
        </mesh>
      </group>

      <ContactShadows position={[0, -2.1, 0]} opacity={0.45} scale={10} blur={2.7} far={4} />
    </>
  );
}

export default function ThreeDPlayerCard({
  card,
  imageUrl,
}: {
  card: PlayerCardWithPlayer;
  imageUrl?: string | null;
}) {
  return (
    <div className="w-full h-full min-h-[340px]">
      <Canvas
        shadows
        dpr={[1, 1.5]}
        frameloop="always" // animations need frames (only runs for selected card because your PlayerCard gates it)
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      >
        <Scene card={card} imageUrl={imageUrl} />
      </Canvas>
    </div>
  );
}

// ✅ Keep this export because premier-league.tsx imports it
export const eplPlayerToCard = (player: any) => {
  return {
    id: player.id,
    rarity: "common",
    serialNumber: 1,
    maxSupply: 100,
    player: {
      name: player.name,
      position: player.position,
      club: player.team ?? player.club ?? "",
      // Use your own images if you store them, otherwise fallback:
      photo: player.photo ?? player.photoUrl ?? player.imageUrl ?? player.image_url ?? null,
      // Optional club logo if available:
      clubLogo: player.clubLogo ?? player.club_logo ?? player.teamLogo ?? player.team_logo ?? null,
      // Optional if you later add:
      stats: player.stats ?? undefined,
    },
  };
};
