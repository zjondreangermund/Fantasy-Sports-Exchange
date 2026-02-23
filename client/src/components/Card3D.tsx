import { useRef, useState, useMemo, useCallback, Suspense, Component, type ReactNode, useEffect, type RefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { type PlayerCardWithPlayer, type EplPlayer } from "../../../shared/schema";
import { Shield } from "lucide-react";

type RarityKey = "common" | "rare" | "unique" | "epic" | "legendary";

const MAX_ACTIVE_CANVASES = 8;
let activeCanvasCount = 0;

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
  if (/^https?:\/\/resources\.premierleague\.com\//i.test(url)) {
    return url;
  }
  if (/^https?:\/\//i.test(url)) {
    return `/api/image-proxy?url=${encodeURIComponent(url)}`;
  }
  return url;
}

function buildImageCandidates(primaryUrl: string, playerId?: number): string[] {
  const candidates: string[] = [];
  if (playerId && Number.isFinite(playerId)) {
    candidates.push(`/api/players/${playerId}/photo`);
  }

  return candidates;
}

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
    const img = new Image();
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
          if (likelyWhiteBg) {
            data[i + 3] = 0;
            removed += 1;
          }
        }

        const shouldApplyBgRemoval = removed / totalPixels <= 0.65;

        const getLuma = (x: number, y: number) => {
          const cx = Math.max(0, Math.min(width - 1, x));
          const cy = Math.max(0, Math.min(height - 1, y));
          const idx = (cy * width + cx) * 4;
          return 0.2126 * source[idx] + 0.7152 * source[idx + 1] + 0.0722 * source[idx + 2];
        };

        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            const i = (y * width + x) * 4;
            const baseLuma = getLuma(x, y);
            const right = getLuma(x + 1, y);
            const left = getLuma(x - 1, y);
            const down = getLuma(x, y + 1);
            const up = getLuma(x, y - 1);
            const edge = Math.min(255, Math.abs(right - left) + Math.abs(down - up));

            const plate = Math.max(0, Math.min(255, baseLuma * 0.9 + 25));
            const engraved = Math.max(0, Math.min(255, plate * 0.72 + edge * 0.95));

            data[i] = Math.round(engraved * 0.86 + 22);
            data[i + 1] = Math.round(engraved * 0.93 + 30);
            data[i + 2] = Math.round(engraved * 1.03 + 44);

            if (shouldApplyBgRemoval && data[i + 3] === 0) {
              data[i] = 0;
              data[i + 1] = 0;
              data[i + 2] = 0;
            } else {
              data[i + 3] = Math.max(72, source[i + 3]);
            }
          }
        }

        ctx.putImageData(imgData, 0, 0);

        const cleaned = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const cleanedData = cleaned.data;
        const smoothstep = (edge0: number, edge1: number, value: number) => {
          const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
          return t * t * (3 - 2 * t);
        };

        let visiblePixels = 0;
        for (let i = 0; i < cleanedData.length; i += 4) {
          const pixel = i / 4;
          const x = pixel % width;
          const y = Math.floor(pixel / width);
          const currentAlpha = cleanedData[i + 3];

          const u = (x - drawX) / Math.max(1, drawWidth);
          const v = (y - drawY) / Math.max(1, drawHeight);

          if (u < 0 || u > 1 || v < 0 || v > 1) {
            cleanedData[i] = 0;
            cleanedData[i + 1] = 0;
            cleanedData[i + 2] = 0;
            cleanedData[i + 3] = 0;
            continue;
          }

          const radialX = (u - 0.5) / 0.75;
          const radialY = (v - 1.18) / 0.95;
          const radialDist = Math.sqrt(radialX * radialX + radialY * radialY);
          const radialMask = 1 - smoothstep(0.6, 0.92, radialDist);
          const bottomMask = 1 - smoothstep(0.68, 1.0, v);
          const alphaMask = Math.max(0, Math.min(1, radialMask * bottomMask));

          const nextAlpha = Math.round(currentAlpha * alphaMask);
          cleanedData[i + 3] = nextAlpha;

          const r = cleanedData[i];
          const g = cleanedData[i + 1];
          const b = cleanedData[i + 2];
          const avg = (r + g + b) / 3;
          cleanedData[i] = Math.max(0, Math.min(255, (r - avg) * 1.08 + avg * 1.06));
          cleanedData[i + 1] = Math.max(0, Math.min(255, (g - avg) * 1.08 + avg * 1.06));
          cleanedData[i + 2] = Math.max(0, Math.min(255, (b - avg) * 1.08 + avg * 1.06));

          if (cleanedData[i + 3] < 24) {
            cleanedData[i] = 0;
            cleanedData[i + 1] = 0;
            cleanedData[i + 2] = 0;
            cleanedData[i + 3] = 0;
          } else {
            visiblePixels += 1;
          }
        }
        const portraitArea = Math.max(1, drawWidth * drawHeight);
        const visibleRatio = visiblePixels / portraitArea;

        if (visibleRatio < 0.08) {
          ctx.clearRect(0, 0, width, height);
          ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
        } else {
          ctx.putImageData(cleaned, 0, 0);
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
        metalness: 0.82,
        roughness: 0.26,
        clearcoat: 1,
        clearcoatRoughness: 0.1,
        reflectivity: 1,
        emissive: new THREE.Color("#89a8d8"),
        emissiveIntensity: 0.08,
        transparent: true,
        alphaTest: 0.02,
        depthWrite: true,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
        opacity: 1.0,
      }),
    [processedTexture],
  );

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
    <mesh ref={ref} position={[0, 0.06, 0.345]} renderOrder={0}>
      <planeGeometry args={[1.86, 2.46, 64, 64]} />
      <primitive object={portraitMaterial} attach="material" />
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

  const baseMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: colors.base,
        metalness: 0.82,
        roughness: 0.12,
        clearcoat: 1,
        clearcoatRoughness: 0.02,
        reflectivity: 1,
        envMapIntensity: 2.4,
        emissive: new THREE.Color(colors.base).multiplyScalar(0.12),
        emissiveIntensity: 0.35,
      }),
    [colors.base],
  );

  const frameMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(colors.base).multiplyScalar(0.35),
        metalness: 0.88,
        roughness: 0.1,
        clearcoat: 1,
        clearcoatRoughness: 0.03,
        reflectivity: 1,
        emissive: new THREE.Color(colors.base).multiplyScalar(0.08),
        emissiveIntensity: 0.25,
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
  const [useCanvas, setUseCanvas] = useState(false);
  const rafRef = useRef<number>(0);

  const rarity = (card.rarity as RarityKey) || "common";
  const rs = rarityStyles[rarity];

  const sizeMap = { sm: { w: 170, h: 250 }, md: { w: 220, h: 320 }, lg: { w: 270, h: 390 } };
  const s = sizeMap[size];
  const pad = size === "sm" ? "10px 12px 8px" : size === "lg" ? "16px 18px 14px" : "12px 14px 10px";

  const imageUrl = normalizeImageUrl(sorareImageUrl) || normalizeImageUrl(card.player?.imageUrl) || "";
  const imageCandidates = useMemo(() => buildImageCandidates(imageUrl, card.playerId), [imageUrl, card.playerId]);
  const [imageCandidateIndex, setImageCandidateIndex] = useState(0);
  const [portraitLoadFailed, setPortraitLoadFailed] = useState(false);
  const portraitSrc = imageCandidates[imageCandidateIndex] || "";
  const playerName = String(card.player?.name || "Unknown");
  const nameParts = playerName.split(" ").filter(Boolean);
  const playerInitials = (nameParts[0]?.[0] || "?") + (nameParts[1]?.[0] || "");
  const showStickerFallback = !portraitSrc || portraitLoadFailed;

  useEffect(() => {
    setImageCandidateIndex(0);
    setPortraitLoadFailed(false);
  }, [imageCandidates]);

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
            </Canvas>
          </CanvasErrorBoundary>
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 14,
              background: `radial-gradient(circle at 50% 20%, rgba(255,255,255,0.14), rgba(255,255,255,0.02) 45%, rgba(0,0,0,0.08) 100%), #${rs.base
                .toString(16)
                .padStart(6, "0")}`,
              opacity: 0.9,
              pointerEvents: "none",
            }}
          />
        )}

        {!showStickerFallback && portraitSrc && (
          <div
            style={{
              position: "absolute",
              left: "10%",
              right: "10%",
              top: "18%",
              bottom: "22%",
              pointerEvents: "none",
              overflow: "hidden",
              borderRadius: 14,
              zIndex: 4,
            }}
          >
            <img
              src={portraitSrc}
              alt=""
              onError={() => {
                setImageCandidateIndex((prev) => {
                  const next = prev + 1;
                  if (next >= imageCandidates.length) {
                    setPortraitLoadFailed(true);
                  }
                  return next < imageCandidates.length ? next : prev;
                });
              }}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                objectPosition: "center bottom",
                filter: "grayscale(0.22) contrast(1.2) saturate(0.9) brightness(1.02)",
                mixBlendMode: "multiply",
                WebkitMaskImage:
                  "radial-gradient(155% 100% at 50% 120%, #000 58%, transparent 90%), linear-gradient(to bottom, #000 0%, #000 66%, transparent 100%)",
                maskImage:
                  "radial-gradient(155% 100% at 50% 120%, #000 58%, transparent 90%), linear-gradient(to bottom, #000 0%, #000 66%, transparent 100%)",
              }}
            />
          </div>
        )}

        {showStickerFallback && (
          <div
            style={{
              position: "absolute",
              left: "10%",
              right: "10%",
              top: "18%",
              bottom: "22%",
              pointerEvents: "none",
              overflow: "hidden",
              borderRadius: 14,
              zIndex: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: "76%",
                aspectRatio: "1 / 1",
                borderRadius: "50%",
                border: "2px solid rgba(255,255,255,0.28)",
                background:
                  "radial-gradient(circle at 35% 30%, rgba(255,255,255,0.32), rgba(255,255,255,0.08) 40%, rgba(255,255,255,0.02) 70%)",
                boxShadow: "inset 0 0 28px rgba(255,255,255,0.08), 0 8px 24px rgba(0,0,0,0.35)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                textShadow: "0 2px 4px rgba(0,0,0,0.45)",
              }}
            >
              <div style={{ fontSize: size === "sm" ? 26 : size === "lg" ? 38 : 32, fontWeight: 900, letterSpacing: "0.04em" }}>{playerInitials}</div>
              <div style={{ fontSize: size === "sm" ? 8 : 10, opacity: 0.8, letterSpacing: "0.1em", marginTop: 2 }}>{card.player?.position || "N/A"}</div>
              <div style={{ fontSize: size === "sm" ? 7 : 8, opacity: 0.65, marginTop: 2 }}>{(card.player?.team || "").substring(0, 12)}</div>
            </div>
          </div>
        )}

        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 14,
            pointerEvents: "none",
            zIndex: 8,
            background:
              "radial-gradient(420px 280px at 50% 20%, rgba(255,255,255,0.22), rgba(255,255,255,0.06) 38%, rgba(255,255,255,0) 70%)",
            mixBlendMode: "screen",
            opacity: hovered ? 0.8 : 0.45,
            transition: "opacity 180ms ease",
          }}
        />

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

