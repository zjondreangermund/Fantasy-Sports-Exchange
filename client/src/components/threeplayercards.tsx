// @ts-nocheck
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
  // Enhanced metal slab colors - iPhone titanium-inspired
  if (r === "legendary") return { 
    metal: "#d4af37",     // rich gold
    a: "#fff9e6",         // cream white highlight
    b: "#f59e0b",         // deep amber
    glow: "#ffd700"       // pure gold glow
  };
  if (r === "unique") return { 
    metal: "#7c3aed",     // vivid purple
    a: "#ddd6fe",         // light lavender
    b: "#06b6d4",         // cyan accent
    glow: "#a78bfa"       // purple glow
  };
  if (r === "rare") return { 
    metal: "#dc2626",     // crimson red
    a: "#fee2e2",         // light rose
    b: "#f43f5e",         // pink accent
    glow: "#fb7185"       // rose glow
  };
  // Common - brushed aluminum/titanium look
  return { 
    metal: "#94a3b8",     // slate metallic
    a: "#f8fafc",         // nearly white
    b: "#64748b",         // darker slate
    glow: "#cbd5e1"       // soft steel glow
  };
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

function normalizeImageUrl(url?: string | null): string | null {
  if (!url) return null;
  const value = String(url).trim();
  if (!value) return null;
  if (/^(https?:)?\/\//i.test(value) || value.startsWith("data:")) return value;
  return value.startsWith("/") ? value : `/${value}`;
}

async function loadFirstImage(urls: Array<string | null | undefined>): Promise<HTMLImageElement | null> {
  const candidates = urls
    .map((url) => normalizeImageUrl(url))
    .filter((url): url is string => Boolean(url));

  for (const url of candidates) {
    try {
      const image = await loadImage(url);
      return image;
    } catch {
      continue;
    }
  }

  return null;
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

// ✅ Dynamic rarity pattern (no files)
function drawRarityPattern(ctx: CanvasRenderingContext2D, w: number, h: number, rarity: Rarity) {
  const p = rarityPalette(rarity);

  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, p.a);
  g.addColorStop(1, p.b);

  ctx.globalAlpha = rarity === "common" ? 0.22 : 0.30;
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 1;

  // shards
  const count = rarity === "unique" ? 170 : rarity === "legendary" ? 150 : 130;
  for (let i = 0; i < count; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const s = 60 + Math.random() * 160;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + s, y + Math.random() * 50);
    ctx.lineTo(x + Math.random() * 50, y + s);
    ctx.closePath();

    ctx.fillStyle = `rgba(255,255,255,${Math.random() * (rarity === "unique" ? 0.11 : 0.07)})`;
    ctx.fill();
  }

  // diagonal foil lines
  ctx.globalAlpha = rarity === "unique" ? 0.16 : 0.10;
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

async function buildFaceTexture(opts: {
  rarity: Rarity;
  photoUrls?: Array<string | null | undefined>;
  clubLogoUrl?: string | null;
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

  // rarity pattern
  drawRarityPattern(ctx, canvas.width, canvas.height, opts.rarity);

  // vignette
  const vig = ctx.createRadialGradient(512, 580, 250, 512, 920, 980);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(0,0,0,0.78)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const pal = rarityPalette(opts.rarity);

  // top bar
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = pal.metal;
  ctx.fillRect(0, 0, canvas.width, 150);
  ctx.globalAlpha = 1;

  // rarity label
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

  // photo
  if (Array.isArray(opts.photoUrls) && opts.photoUrls.length > 0) {
    try {
      const img = await loadFirstImage(opts.photoUrls);
      if (!img) throw new Error("No valid photo source");
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

      const fade = ctx.createLinearGradient(0, 740, 0, 920);
      fade.addColorStop(0, "rgba(0,0,0,0)");
      fade.addColorStop(1, "rgba(0,0,0,0.85)");
      ctx.fillStyle = fade;
      ctx.fillRect(70, 720, 884, 190);

      ctx.restore();
    } catch {}
  }

  // club logo
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

  ctx.fillStyle = pal.a;
  ctx.font = "800 36px Arial";
  const line2 = `${String(opts.position ?? "").toUpperCase()}${opts.clubName ? " • " + String(opts.clubName).toUpperCase() : ""}`.trim();
  ctx.fillText(line2, 95, 1065);

  // serial
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = "900 40px Arial";
  ctx.fillText(`${opts.serialNumber}/${opts.maxSupply}`, 930, 1065);
  ctx.textAlign = "left";

  // engraved stats panel
  ctx.globalAlpha = 0.94;
  ctx.fillStyle = "#0b0f1a";
  drawRoundedRect(ctx, 70, 1140, 884, 300, 26);
  ctx.fill();
  ctx.globalAlpha = 1;

  // engraving lines
  ctx.globalAlpha = 0.16;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  for (let y = 1160; y < 1430; y += 16) {
    ctx.beginPath();
    ctx.moveTo(90, y);
    ctx.lineTo(934, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // engraved borders
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
  ctx.fillText("Engraved style panel", 95, 1270);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

async function buildBackTexture(opts: { rarity: Rarity; serialNumber: number; maxSupply: number }) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1536;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#070a10";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawRarityPattern(ctx, canvas.width, canvas.height, opts.rarity);

  // dark wash
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalAlpha = 1;

  // center badge
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = "#fff";
  drawRoundedRect(ctx, 190, 610, 644, 320, 44);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.fillStyle = "#fff";
  ctx.font = "900 66px Arial";
  ctx.textAlign = "center";
  ctx.fillText("FANTASY ARENA", 512, 745);

  ctx.globalAlpha = 0.85;
  ctx.font = "900 44px Arial";
  ctx.fillText(`${opts.rarity.toUpperCase()} • ${opts.serialNumber}/${opts.maxSupply}`, 512, 820);
  ctx.globalAlpha = 1;

  ctx.textAlign = "left";

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

// ✅ Enhanced shine shader with rarity glow - creates premium metal look
function ShineMaterial({ strength = 0.2 }: { strength?: number }) {
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
          // horizontal specular highlight with subtle movement
          float highlight = exp(-pow((vUv.y - 0.3 - sin(uTime * 0.3) * 0.05) * 8.0, 2.0));
          highlight += exp(-pow((vUv.y - 0.7 + cos(uTime * 0.25) * 0.04) * 6.0, 2.0)) * 0.6;
          
          // vertical edge highlights
          float edge = (1.0 - abs(vUv.x - 0.5) * 2.0);
          edge *= edge;
          highlight += edge * 0.3;
          
          float alpha = highlight * uStrength;
          gl_FragColor = vec4(1.0, 1.0, 1.0, alpha);
        }
      `,
    });
  }, [strength]);

  return <primitive ref={ref} object={mat} attach="material" />;
}

// ✅ Rainbow foil shader - rarity-specific holographic effect
function FoilMaterial({ strength = 0.18, rarity = "common" }: { strength?: number; rarity?: Rarity }) {
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
          
          // Rarity-specific foil colors
          ${
            rarity === "legendary"
              ? `hue = mod(hue + 0.15, 1.0); // gold-cyan shift`
              : rarity === "unique"
              ? `hue = mod(hue + 0.5, 1.0); // purple-cyan shift`
              : rarity === "rare"
              ? `hue = mod(hue + 0.8, 1.0); // red-magenta shift`
              : `hue = mod(hue + 0.3, 1.0); // neutral shift`
          }
          
          vec3 rainbow = hsv2rgb(vec3(hue, 0.88, 1.0));
          float alpha = band * uStrength;
          gl_FragColor = vec4(rainbow, alpha);
        }
      `,
    });
  }, [strength, rarity]);

  return <primitive ref={ref} object={mat} attach="material" />;
}


function Scene({ card, imageUrl }: { card: PlayerCardWithPlayer; imageUrl?: string | null }) {
  const player: any = (card as any)?.player ?? {};
  const rarity = toRarity((card as any)?.rarity);
  const pal = rarityPalette(rarity);

  const serialNumber = (card as any)?.serialNumber ?? (card as any)?.serial_number ?? 1;
  const maxSupply = (card as any)?.maxSupply ?? (card as any)?.max_supply ?? 100;

  const clubLogoUrl = player.clubLogo || player.club_logo || player.teamLogo || player.team_logo || null;
  const clubName = player.club || player.team || "";

  const [faceTex, setFaceTex] = useState<THREE.Texture | null>(null);
  const [backTex, setBackTex] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const tex = await buildFaceTexture({
        rarity,
        photoUrls: [
          imageUrl,
          Number.isFinite(Number((card as any)?.playerId ?? player?.id))
            ? `/api/players/${Number((card as any)?.playerId ?? player?.id)}/photo`
            : null,
          player?.imageUrl,
          player?.image_url,
          player?.photo,
          player?.photoUrl,
          player?.avatarImageUrl,
          player?.pictureUrl,
          "/images/player-1.png",
        ],
        clubLogoUrl,
        playerName: player.name ?? "PLAYER",
        clubName,
        position: player.position ?? "",
        serialNumber,
        maxSupply,
      });
      const b = await buildBackTexture({ rarity, serialNumber, maxSupply });

      if (!alive) return;
      setFaceTex(tex);
      setBackTex(b);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rarity, imageUrl, player?.name, player?.position, clubLogoUrl, clubName, serialNumber, maxSupply]);

  // card shape with iPhone-inspired rounded corners
  const cardShape = useMemo(() => {
    const shape = new THREE.Shape();
    const w = 2, h = 3, r = 0.24; // slightly larger radius for premium look
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

  // Premium metal slab thickness (iPhone-inspired)
  const depth = 0.35;

  // metal material for front/back base - enhanced metal slab look
  const baseMat = useMemo(() => {
    return new THREE.MeshPhysicalMaterial({
      color: pal.metal,
      metalness: 0.98,
      roughness: rarity === "common" ? 0.32 : rarity === "rare" ? 0.20 : rarity === "epic" ? 0.18 : rarity === "unique" ? 0.16 : 0.14,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
      reflectivity: 1,
      ior: 2.5,
      emissive: 
        rarity === "legendary" ? new THREE.Color("#8b6914") 
        : rarity === "unique" ? new THREE.Color("#4c2d9f")
        : rarity === "rare" ? new THREE.Color("#5a1010")
        : new THREE.Color("#000000"),
      emissiveIntensity: 
        rarity === "legendary" ? 0.35 
        : rarity === "unique" ? 0.25
        : rarity === "rare" ? 0.15
        : 0.05,
      side: THREE.FrontSide,
      envMapIntensity: 1.8,
    });
  }, [pal.metal, rarity]);

  // showroom motion (no zoom)
  const groupRef = useRef<THREE.Group>(null);
  useFrame((state) => {
    const g = groupRef.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    
    // iPhone-style -5 degree base tilt with subtle float animation
    const baseX = THREE.MathUtils.degToRad(3);   // slight downward tilt
    const baseY = THREE.MathUtils.degToRad(8);   // slight right rotation
    const baseZ = THREE.MathUtils.degToRad(-5);  // iPhone signature -5° tilt
    
    // Gentle floating/breathing animation
    g.rotation.x = baseX + Math.sin(t * 0.5) * THREE.MathUtils.degToRad(1.5);
    g.rotation.y = baseY + Math.sin(t * 0.4) * THREE.MathUtils.degToRad(2.5);
    g.rotation.z = baseZ + Math.sin(t * 0.3) * THREE.MathUtils.degToRad(0.8);
    
    // Subtle vertical float
    g.position.y = Math.sin(t * 0.6) * 0.08;
  });

  const foilStrength =
    rarity === "unique" ? 0.38 : rarity === "legendary" ? 0.26 : rarity === "rare" ? 0.18 : 0.12;
  const shineStrength =
    rarity === "legendary" ? 0.30 : rarity === "unique" ? 0.24 : rarity === "rare" ? 0.19 : 0.14;

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0.3, 4.8]} fov={50} />
      <Environment preset="warehouse" blur={0.8} />
      
      {/* Enhanced metal slab lighting */}
      <ambientLight intensity={0.5} color="#aabbff" />
      
      {/* Key light - top front right, creates highlight on metal */}
      <spotLight 
        position={[8, 10, 8]} 
        angle={0.25} 
        penumbra={0.8} 
        intensity={2.2} 
        castShadow 
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0001}
      />
      
      {/* Fill light - from back left, creates rim lighting */}
      <directionalLight 
        position={[-8, 6, 5]} 
        intensity={0.9}
        color="#ffccaa"
      />
      
      {/* Subtle light for depth */}
      <pointLight 
        position={[0, -3, 3]} 
        intensity={0.4}
        color="#ccddff"
      />

      <group ref={groupRef}>
        {/* Main body (thick + bevel) */}
        <mesh castShadow receiveShadow>
          <extrudeGeometry
            args={[
              cardShape,
              {
                depth,
                bevelEnabled: true,
                bevelThickness: 0.08,
                bevelSize: 0.08,
                bevelSegments: 4,
              },
            ]}
          />
          <primitive object={baseMat} attach="material" />
        </mesh>

        {/* Front face */}
        <mesh position={[0, 0, depth / 2 + 0.06]}>
          <planeGeometry args={[1.82, 2.72]} />
          <meshStandardMaterial map={faceTex ?? undefined} color={"#ffffff"} roughness={0.92} metalness={0.0} />
        </mesh>

        {/* Shine */}
        <mesh position={[0, 0, depth / 2 + 0.07]}>
          <planeGeometry args={[1.84, 2.74]} />
          <ShineMaterial strength={shineStrength} />
        </mesh>

        {/* Rainbow foil */}
        <mesh position={[0, 0, depth / 2 + 0.075]}>
          <planeGeometry args={[1.86, 2.76]} />
          <FoilMaterial strength={foilStrength} rarity={rarity} />
        </mesh>

        {/* Back face (reflective style) */}
        <mesh position={[0, 0, -(depth / 2 + 0.06)]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[1.82, 2.72]} />
          <meshStandardMaterial map={backTex ?? undefined} color={"#ffffff"} roughness={0.85} metalness={0.0} />
        </mesh>

      </group>

      <ContactShadows position={[0, -2.25, 0]} opacity={0.45} scale={10} blur={2.8} far={4} />
    </>
  );
}

export default function ThreeDPlayerCard({ card, imageUrl }: { card: PlayerCardWithPlayer; imageUrl?: string | null }) {
  return (
    <div 
      className="w-full h-full"
      style={{
        perspective: "1200px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transformStyle: "preserve-3d",
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          transformStyle: "preserve-3d",
          transform: "rotateX(8deg) rotateZ(-5deg) rotateY(-2deg)",
          transition: "transform 0.3s ease-out",
        }}
      >
        <Canvas
          shadows
          dpr={[1, 1.5]}
          frameloop="always"
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
          style={{ width: "100%", height: "100%" }}
        >
          <Scene card={card} imageUrl={imageUrl} />
        </Canvas>
      </div>
    </div>
  );
}

// ✅ keep this export for premier-league page builds
export const eplPlayerToCard = (player: any) => {
  return {
    id: player.id,
    playerId: player.id,
    rarity: "common",
    serialNumber: 1,
    maxSupply: 100,
    player: {
      id: player.id,
      name: player.name,
      position: player.position,
      club: player.team ?? player.club ?? "",
      photo: Number.isFinite(Number(player.id)) ? `/api/players/${Number(player.id)}/photo` : null,
      clubLogo: player.clubLogo ?? player.club_logo ?? player.teamLogo ?? player.team_logo ?? null,
      stats: player.stats ?? undefined,
    },
  };
};
