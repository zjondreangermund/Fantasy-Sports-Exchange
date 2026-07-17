// Converts FPL photo field (e.g. "23105.jpg") to Premier League CDN headshot URL
function fplPhotoToPlCdn(photo?: string | null): string {
  if (!photo) return "/images/player-1.png";
  // Extract numeric ID from "23105.jpg"
  const match = String(photo).match(/(\d+)/);
  if (!match) return "/images/player-1.png";
  const id = match[1];
  // Build CDN URL
  const cdnUrl = `https://resources.premierleague.com/premierleague/photos/players/250x250/p${id}.png`;
return toSafeImageUrl(cdnUrl);
}
import { useRef, useState, useMemo, useCallback, Suspense, Component, type ReactNode, useEffect, type RefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { type PlayerCardWithPlayer } from "../../../shared/schema";
type EplPlayer = any;
import { Shield } from "lucide-react";
import { toApiUrl } from "../lib/api-base";

type RarityKey = "common" | "rare" | "unique" | "epic" | "legendary";

function normalizeImageUrl(url?: string | null): string | null {
  if (!url) return null;
  const value = String(url).trim();
  if (!value) return null;
  if (/^(https?:)?\/\//i.test(value) || value.startsWith("data:")) return value;
  return value.startsWith("/") ? value : `/${value}`;
}

function lowercaseFilenamePath(url: string): string {
  const [pathOnly, search = ""] = url.split("?");
  const parts = pathOnly.split("/");
  const fileName = parts.pop() || "";
  const lowerFileName = fileName.toLowerCase();
  const rebuilt = `${parts.join("/")}/${lowerFileName}`.replace(/\/+/g, "/");
  return search ? `${rebuilt}?${search}` : rebuilt;
}

function toSafeImageUrl(url: string): string {
  if (/^(https?:)?\/\//i.test(url)) {
    const absolute = url.startsWith("//") ? `https:${url}` : url;
    return toApiUrl(`/api/image-proxy?url=${encodeURIComponent(absolute)}`);
  }
  return url;
}

function buildImageCandidates(primaryUrl: string, playerId?: number): string[] {
  const candidates: string[] = [];
  // 1) Try local API photo first (fast + consistent if your backend serves real image bytes)
  if (playerId && Number.isFinite(playerId)) {
    candidates.push(toApiUrl(`/api/players/${playerId}/photo`));
  }
  // 2) Try the provided imageUrl (normalized + lowercase filename variant)
  const normalized = normalizeImageUrl(primaryUrl);
  if (normalized) {
    const safe = toSafeImageUrl(normalized);
    candidates.push(safe);
    // some servers are case-sensitive; try lowercase filename variant too
    if (!safe.startsWith("data:")) {
      candidates.push(toSafeImageUrl(lowercaseFilenamePath(normalized)));
    }
  }
  // remove empties + duplicates
  return Array.from(new Set(candidates.filter(Boolean)));
}

function EngravedPortrait({ urls, hovered }: { urls: string[]; hovered: boolean }) {
  const fallbackTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (ctx) {
      ctx.clearRect(0, 0, 32, 32);
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
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.referrerPolicy = "no-referrer";
    let activeIndex = 0;
    img.onload = () => {
      if (cancelled) return;
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || img.width || 512;
      canvas.height = img.naturalHeight || img.height || 512;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        setProcessedTexture(fallbackTexture);
        return;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const width = canvas.width;
      const height = canvas.height;
      const sourceWidth = img.naturalWidth || img.width || 512;
      const sourceHeight = img.naturalHeight || img.height || 512;
      const pad = Math.round(Math.min(width, height) * 0.02);
      const availableWidth = Math.max(1, width - pad * 2);
      const availableHeight = Math.max(1, height - pad * 2);
      const scale = Math.min(availableWidth / sourceWidth, availableHeight / sourceHeight);
      const drawWidth = Math.max(1, Math.round(sourceWidth * scale));
      const drawHeight = Math.max(1, Math.round(sourceHeight * scale));
      const drawX = Math.round((width - drawWidth) * 0.5);
      const drawY = Math.round(height - drawHeight - pad * 0.5);
      ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
      try {
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;
        const source = new Uint8ClampedArray(data);
        let removed = 0;
        const totalPixels = data.length / 4;
        for (let i = 0; i < data.length; i += 4) {
          const r = source[i];
          const g = source[i + 1];
          const b = source[i + 2];
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const sat = max === 0 ? 0 : (max - min) / max;
          const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          const likelyWhiteBg = luminance > 232 && sat < 0.22;
          const isGrey = (r > 100 && r < 200) && Math.abs(r - g) < 10 && Math.abs(r - b) < 10 && Math.abs(g - b) < 10;
          if (likelyWhiteBg || isGrey) {
            data[i + 3] = 0;
            removed += 1;
          }
        }
        const shouldApplyBgRemoval = removed / totalPixels <= 0.65;
        const smoothstep = (edge0: number, edge1: number, value: number) => {
          const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
          return t * t * (3 - 2 * t);
        };
        let visiblePixels = 0;
        for (let i = 0; i < data.length; i += 4) {
          const pixel = i / 4;
          const x = pixel % width;
          const y = Math.floor(pixel / width);
          const u = (x - drawX) / Math.max(1, drawWidth);
          const v = (y - drawY) / Math.max(1, drawHeight);
          if (u < 0 || u > 1 || v < 0 || v > 1) {
            data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 0;
            continue;
          }
          const radialX = (u - 0.5) / 0.75;
          const radialY = (v - 1.18) / 0.95;
          const radialDist = Math.sqrt(radialX * radialX + radialY * radialY);
          const radialMask = 1 - smoothstep(0.6, 0.92, radialDist);
          const alphaMask = Math.max(0, Math.min(1, radialMask));
          const origAlpha = shouldApplyBgRemoval ? data[i + 3] : source[i + 3];
          const nextAlpha = Math.round(origAlpha * alphaMask);
          // Full color — keep original RGB, just apply fade mask
          data[i] = source[i];
          data[i + 1] = source[i + 1];
          data[i + 2] = source[i + 2];
          data[i + 3] = nextAlpha;
          if (nextAlpha >= 24) visiblePixels += 1;
        }
        const portraitArea = Math.max(1, drawWidth * drawHeight);
        if (visiblePixels / portraitArea < 0.08) {
          ctx.clearRect(0, 0, width, height);
          ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
        } else {
          ctx.putImageData(imgData, 0, 0);
        }
      } catch {
        // If canvas pixel reads are blocked (CORS/tainted image), keep the drawn photo so it still renders.
      }
      const out = new THREE.CanvasTexture(canvas);
      out.needsUpdate = true;
      out.wrapS = THREE.ClampToEdgeWrapping;
      out.wrapT = THREE.ClampToEdgeWrapping;
      out.colorSpace = THREE.SRGBColorSpace;
      out.premultiplyAlpha = true;
      out.generateMipmaps = false;
      out.minFilter = THREE.LinearFilter;
      out.magFilter = THREE.LinearFilter;
      setProcessedTexture(out);
    };
    const loadNext = () => {
      if (cancelled) return;
      if (activeIndex >= urls.length) {
        setProcessedTexture(fallbackTexture);
        return;
      }
      const nextUrl = urls[activeIndex];
      activeIndex += 1;
      img.src = nextUrl;
    };
    img.onerror = () => {
      loadNext();
    };
    loadNext();
    return () => {
      cancelled = true;
    };
  }, [urls, fallbackTexture]);
  const ref = useRef<THREE.Mesh>(null);
  const portraitMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        map: processedTexture,
        alphaMap: processedTexture,
        bumpMap: processedTexture,
        bumpScale: 0.2,
        transparent: true,
        opacity: 0.98,
        metalness: 0.18,
        roughness: 0.38,
        reflectivity: 0.18,
        clearcoat: 0.12,
        clearcoatRoughness: 0.18,
        color: 0xffffff,
        emissive: 0x222222,
        emissiveIntensity: hovered ? 0.12 : 0.08,
        depthWrite: false,
      }),
    [processedTexture, hovered],
  );
  return (
    <mesh ref={ref} position={[0, 0.18, 0.36]} scale={[1.08, 1.08, 1.08]}>
      <planeGeometry args={[1, 1]} />
      <meshPhysicalMaterial
        map={processedTexture}
        alphaMap={processedTexture}
        bumpMap={processedTexture}
        bumpScale={0.2}
        transparent={true}
        opacity={0.98}
        metalness={0.18}
        roughness={0.38}
        reflectivity={0.18}
        clearcoat={0.12}
        clearcoatRoughness={0.18}
        color={0xffffff}
        emissive={0x222222}
        emissiveIntensity={hovered ? 0.12 : 0.08}
        depthWrite={false}
        alphaTest={0.5}
      />
    </mesh>
  );
}

const MAX_ACTIVE_CANVASES = 8;
let activeCanvasCount = 0;



const rarityStyles: Record<
  RarityKey,
  {
    base: number;
    label: string;
    glow: string;
    accentColor: string;
    labelBg: string;
    outerGlow: string;
    editionLabel: string;
  }
> = {
  common: {
    base: 0x9aaec2,
    label: "COMMON",
    editionLabel: "STANDARD EDITION",
    glow: "0 8px 36px rgba(154,174,194,0.45), 0 0 70px rgba(154,174,194,0.20)",
    outerGlow: "0 0 38px rgba(154,174,194,0.40), 0 0 70px rgba(154,174,194,0.16), 0 16px 40px rgba(0,0,0,0.65)",
    accentColor: "#dde8f4",
    labelBg: "linear-gradient(135deg,rgba(110,140,170,0.95),rgba(190,210,230,0.95))",
  },
  rare: {
    base: 0x1c50c8,
    label: "RARE",
    editionLabel: "RARE EDITION",
    glow: "0 8px 42px rgba(28,80,200,0.55), 0 0 80px rgba(60,120,255,0.25)",
    outerGlow: "0 0 42px rgba(28,80,200,0.55), 0 0 80px rgba(60,120,255,0.22), 0 16px 40px rgba(0,0,0,0.65)",
    accentColor: "#a0c8ff",
    labelBg: "linear-gradient(135deg,rgba(16,48,160,0.95),rgba(60,120,255,0.95))",
  },
  unique: {
    base: 0x7820d0,
    label: "UNIQUE",
    editionLabel: "UNIQUE EDITION",
    glow: "0 8px 42px rgba(120,32,208,0.55), 0 0 80px rgba(180,80,255,0.25)",
    outerGlow: "0 0 42px rgba(120,32,208,0.55), 0 0 80px rgba(180,80,255,0.22), 0 16px 40px rgba(0,0,0,0.65)",
    accentColor: "#d090ff",
    labelBg: "linear-gradient(135deg,rgba(90,16,180,0.95),rgba(180,80,255,0.95))",
  },
  epic: {
    base: 0x180830,
    label: "EPIC",
    editionLabel: "EPIC EDITION",
    glow: "0 8px 42px rgba(80,50,200,0.50), 0 0 80px rgba(100,70,230,0.22)",
    outerGlow: "0 0 42px rgba(80,50,200,0.50), 0 0 80px rgba(100,70,230,0.20), 0 16px 40px rgba(0,0,0,0.65)",
    accentColor: "#b0a0ff",
    labelBg: "linear-gradient(135deg,rgba(20,10,60,0.95),rgba(80,50,200,0.95))",
  },
  legendary: {
    base: 0xc89010,
    label: "LEGENDARY",
    editionLabel: "LAUNCH EDITION",
    glow: "0 8px 56px rgba(220,158,16,0.65), 0 0 100px rgba(255,200,30,0.30)",
    outerGlow: "0 0 52px rgba(220,158,16,0.65), 0 0 100px rgba(255,200,30,0.28), 0 16px 40px rgba(0,0,0,0.65)",
    accentColor: "#ffe060",
    labelBg: "linear-gradient(135deg,rgba(140,90,8,0.95),rgba(240,180,20,0.95))",
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

// ...existing code...

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
  hovered,
  mouse,
}: {
  rarity: RarityKey;
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

  const baseColor = useMemo(() => new THREE.Color(colors.base), [colors.base]);

  const baseMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: baseColor,
        metalness: 0.95,
        roughness: 0.05,
        clearcoat: 1.0,
        clearcoatRoughness: 0.01,
        reflectivity: 1.0,
        envMapIntensity: 3.2,
        emissive: baseColor.clone().multiplyScalar(0.18),
        emissiveIntensity: 0.50,
        sheen: 0.6,
        sheenRoughness: 0.2,
        sheenColor: baseColor.clone().lerp(new THREE.Color(0xffffff), 0.4),
      }),
    [baseColor],
  );

  const frameMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: baseColor.clone().multiplyScalar(0.5).lerp(new THREE.Color(0xffffff), 0.15),
        metalness: 0.98,
        roughness: 0.04,
        clearcoat: 1.0,
        clearcoatRoughness: 0.01,
        reflectivity: 1.0,
        emissive: baseColor.clone().multiplyScalar(0.22),
        emissiveIntensity: 0.45,
      }),
    [baseColor],
  );

  const crystalMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        uniforms: { uColor: { value: baseColor } },
        vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
        fragmentShader: `
      uniform vec3 uColor;
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
        vec2 v=voronoi(vUv*14.0);
        float facet=v.y*0.45+0.55;
        float edge=smoothstep(0.01,0.07,v.x);
        float sparkle=pow(max(0.0,hash(vUv*37.0+0.5)-0.82)/0.18,2.0)*0.6;
        float ef=smoothstep(0.0,0.07,vUv.x)*smoothstep(0.0,0.07,vUv.y)*smoothstep(1.0,0.93,vUv.x)*smoothstep(1.0,0.93,vUv.y);
        vec3 tinted=mix(uColor*2.2,vec3(1.0),facet*0.55);
        vec3 c=(tinted*edge+vec3(sparkle))*ef;
        gl_FragColor=vec4(c,clamp((0.35*facet*edge+sparkle)*ef,0.0,0.85));
      }`,
      }),
    [baseColor],
  );

  const epoxyCoatMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.24,
        metalness: 0.05,
        roughness: 0.02,
        clearcoat: 1,
        clearcoatRoughness: 0,
        reflectivity: 1,
      }),
    [],
  );

  return (
    <group>
      <mesh geometry={geometry} scale={[1.03, 1.03, 1.03]} material={frameMat} />
      <mesh geometry={geometry} material={baseMat} />
      <mesh geometry={geometry} renderOrder={1}>
        <primitive object={crystalMat} attach="material" />
      </mesh>
      <mesh geometry={geometry} scale={[1.004, 1.004, 1.004]} renderOrder={2}>
        <primitive object={epoxyCoatMat} attach="material" />
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
      imageUrl: fplPhotoToPlCdn(player.photo),
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
  const [useCanvas, setUseCanvas] = useState(false);
  const rafRef = useRef<number>(0);

  const rarity = (card.rarity as RarityKey) || "common";
  const rs = rarityStyles[rarity];

  const sizeMap = { sm: { w: 170, h: 250 }, md: { w: 220, h: 320 }, lg: { w: 270, h: 390 } };
  const s = sizeMap[size];
  const pad = size === "sm" ? "10px 12px 8px" : size === "lg" ? "16px 18px 14px" : "12px 14px 10px";

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
    if (activeCanvasCount < MAX_ACTIVE_CANVASES) {
      activeCanvasCount += 1;
      setUseCanvas(true);
      return () => {
        activeCanvasCount = Math.max(0, activeCanvasCount - 1);
      };
    }
    setUseCanvas(false);
    return;
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
        filter: `drop-shadow(0 0 18px ${rarity === "legendary" ? "rgba(220,158,16,0.55)" : rarity === "epic" ? "rgba(80,50,200,0.45)" : rarity === "unique" ? "rgba(120,32,208,0.45)" : rarity === "rare" ? "rgba(28,80,200,0.45)" : "rgba(154,174,194,0.35)"})`,
        transition: "filter 200ms ease",
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
        {useCanvas ? (
          <CanvasErrorBoundary fallback={null}>
            <Canvas
              camera={{ position: [0, 0, 4.5], fov: 45 }}
              dpr={[1, 1]}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                borderRadius: 14,
                pointerEvents: "none",
              }}
              gl={{ antialias: false, alpha: true, powerPreference: "low-power" }}
              onCreated={({ gl }) => {
                gl.setClearColor(0x000000, 0);
              }}
            >
              <ambientLight intensity={0.75} />
              <directionalLight position={[5, 5, 5]} intensity={3} />
              <directionalLight position={[-3, 2, 4]} intensity={1} />
              <pointLight position={[0, 0, 4]} intensity={0.5} />
              <pointLight position={[0, 2, 3]} intensity={0.45} color="#dbeafe" />
              <CardMesh rarity={rarity} hovered={hovered} mouse={mouseRef} />
              {/* Use FPL CDN photo directly for best transparency */}
              <EngravedPortrait
                hovered={hovered}
                urls={card.player?.photo ? [fplPhotoToPlCdn(card.player.photo)] : card.player?.imageUrl ? [card.player.imageUrl] : []}
              />

            </Canvas>
          </CanvasErrorBoundary>
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 14,
              background: "transparent",
              opacity: 0.9,
              pointerEvents: "none",
            }}
          />
        )}

        {/* Chrome shine overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 14,
            pointerEvents: "none",
            zIndex: 8,
            background:
              "radial-gradient(ellipse 80% 55% at 50% 18%, rgba(255,255,255,0.30), rgba(255,255,255,0.08) 45%, rgba(255,255,255,0) 72%)",
            mixBlendMode: "screen",
            opacity: hovered ? 0.9 : 0.55,
            transition: "opacity 180ms ease",
          }}
        />

        {/* Edge rim glow */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 14,
            pointerEvents: "none",
            zIndex: 7,
            boxShadow: `inset 0 0 0 1.5px rgba(255,255,255,0.30), inset 0 2px 8px rgba(255,255,255,0.15)`,
          }}
        />

        {/* Top info bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 12,
            pointerEvents: "none",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            padding: size === "sm" ? "8px 10px 0" : size === "lg" ? "14px 16px 0" : "10px 13px 0",
          }}
        >
          {/* Top-left: overall + position */}
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <div
              style={{
                fontSize: size === "sm" ? 22 : size === "lg" ? 30 : 26,
                fontWeight: 900,
                color: "#fff",
                lineHeight: 1,
                textShadow: `0 2px 8px rgba(0,0,0,0.85), 0 0 16px ${rs.accentColor}66`,
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
                letterSpacing: "0.14em",
                textShadow: "0 1px 4px rgba(0,0,0,0.7)",
                textTransform: "uppercase",
              }}
            >
              {card.player?.position || "N/A"}
            </div>
          </div>

          {/* Top-right: serial + rarity badge */}
          <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
            {serialText && (
              <div
                style={{
                  fontSize: size === "sm" ? 6 : size === "lg" ? 9 : 7,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.55)",
                  letterSpacing: "0.10em",
                  textShadow: "0 1px 3px rgba(0,0,0,0.7)",
                }}
              >
                {serialText}
              </div>
            )}
            <div
              style={{
                fontSize: size === "sm" ? 6 : size === "lg" ? 8 : 7,
                fontWeight: 900,
                color: "#fff",
                letterSpacing: "0.16em",
                background: rs.labelBg,
                borderRadius: 4,
                padding: size === "sm" ? "1px 5px" : "2px 7px",
                textShadow: "0 1px 3px rgba(0,0,0,0.5)",
                boxShadow: "0 2px 6px rgba(0,0,0,0.35)",
              }}
            >
              {rs.label}
            </div>
          </div>
        </div>

        {/* Bottom info panel — dark gradient overlay with player name */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 12,
            pointerEvents: "none",
            background: "linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.68) 55%, rgba(0,0,0,0) 100%)",
            borderBottomLeftRadius: 14,
            borderBottomRightRadius: 14,
            padding: size === "sm" ? "22px 10px 8px" : size === "lg" ? "38px 16px 14px" : "30px 13px 10px",
          }}
        >
          {/* Player name */}
          <div
            style={{
              fontSize: size === "sm" ? 10 : size === "lg" ? 15 : 12,
              fontWeight: 900,
              color: "#fff",
              letterSpacing: "0.08em",
              textShadow: "0 2px 8px rgba(0,0,0,0.9)",
              textTransform: "uppercase",
              fontFamily: "'Inter','Arial Black',system-ui,sans-serif",
              lineHeight: 1.1,
              marginBottom: size === "sm" ? 2 : 3,
            }}
          >
            {(card.player?.name || "Unknown").substring(0, size === "sm" ? 13 : 16)}
          </div>

          {/* Position + team row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: size === "sm" ? 4 : 6,
              marginBottom: size === "sm" ? 3 : 5,
            }}
          >
            <span
              style={{
                fontSize: size === "sm" ? 6 : size === "lg" ? 9 : 7,
                fontWeight: 800,
                color: rs.accentColor,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                textShadow: "0 1px 4px rgba(0,0,0,0.8)",
              }}
            >
              {card.player?.position || "N/A"}
            </span>
            <span style={{ color: "rgba(255,255,255,0.3)", fontSize: size === "sm" ? 6 : 7 }}>·</span>
            <span
              style={{
                fontSize: size === "sm" ? 6 : size === "lg" ? 9 : 7,
                fontWeight: 700,
                color: "rgba(255,255,255,0.55)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                textShadow: "0 1px 3px rgba(0,0,0,0.7)",
              }}
            >
              {(card.player?.nationality || card.player?.team || "FC").substring(0, 10)}
            </span>
          </div>

          {/* Edition bar */}
          <div
            style={{
              borderTop: `1px solid ${rs.accentColor}40`,
              paddingTop: size === "sm" ? 3 : 5,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span
              style={{
                fontSize: size === "sm" ? 5 : size === "lg" ? 8 : 6,
                fontWeight: 900,
                color: rs.accentColor,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                textShadow: `0 0 8px ${rs.accentColor}88`,
              }}
            >
              {rs.editionLabel}
            </span>
            {/* Stats mini row */}
            <div style={{ display: "flex", gap: size === "sm" ? 4 : 6, alignItems: "center" }}>
              <StatBadge label="LV" value={String(card.level || 1)} color={rs.accentColor} size={size} />
              <StatBadge label="DS" value={String(card.decisiveScore || 35)} color={dsColor} size={size} />
            </div>
          </div>
        </div>

        {/* Price badge */}
        {(showPrice || card.forSale) && card.price != null && card.price > 0 && (
          <div
            style={{
              position: "absolute",
              top: size === "sm" ? 8 : 10,
              left: "50%",
              transform: "translateX(-50%)",
              background: "linear-gradient(135deg, rgba(0,0,0,0.80), rgba(0,0,0,0.65))",
              backdropFilter: "blur(8px)",
              borderRadius: 8,
              padding: size === "sm" ? "2px 8px" : "3px 12px",
              zIndex: 20,
              pointerEvents: "none",
              border: "1px solid rgba(74,222,128,0.35)",
              boxShadow: "0 2px 10px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.07)",
            }}
          >
            <span
              style={{
                color: "#4ade80",
                fontSize: size === "sm" ? 10 : size === "lg" ? 14 : 12,
                fontWeight: 900,
                fontFamily: "'Inter','Arial Black',system-ui,sans-serif",
                textShadow: "0 0 10px rgba(74,222,128,0.5)",
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
