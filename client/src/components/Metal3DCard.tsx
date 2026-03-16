import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import SimpleCard from "./SimpleCard";
import { useIsMobile } from "../hooks/use-mobile";

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
  team?: string;
  nationality?: string;
  level?: number;
  xp?: number;
  xpMax?: number;
  form?: number;
  last5Scores?: number[];
};

type Metal3DCardProps = {
  player: PlayerCardData;
  className?: string;
};

type RarityMetal = {
  metalColor: THREE.Color;
  rimColor: THREE.Color;
  glossiness: number;
  patternColor: THREE.Color;
};

const rarityMetals: Record<Rarity, RarityMetal> = {
  common: {
    metalColor: new THREE.Color(0x8b8b8b),
    rimColor: new THREE.Color(0x505050),
    glossiness: 0.6,
    patternColor: new THREE.Color(0x404040),
  },
  rare: {
    metalColor: new THREE.Color(0x4a90e2),
    rimColor: new THREE.Color(0x2c5aa0),
    glossiness: 0.82,
    patternColor: new THREE.Color(0x1e3a5f),
  },
  unique: {
    metalColor: new THREE.Color(0x9b59ff),
    rimColor: new THREE.Color(0x5d2ea8),
    glossiness: 0.9,
    patternColor: new THREE.Color(0x3f2570),
  },
  epic: {
    metalColor: new THREE.Color(0xff4fd8),
    rimColor: new THREE.Color(0xa3267c),
    glossiness: 0.9,
    patternColor: new THREE.Color(0x5c1846),
  },
  legendary: {
    metalColor: new THREE.Color(0xffd700),
    rimColor: new THREE.Color(0xb8860b),
    glossiness: 0.95,
    patternColor: new THREE.Color(0xffed4e),
  },
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function createRoundedRectShape(width: number, height: number, radius: number) {
  const x = -width / 2;
  const y = -height / 2;
  const shape = new THREE.Shape();
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + height - radius);
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  shape.lineTo(x + radius, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  return shape;
}

function createEngravedPatternTexture(
  width: number,
  height: number,
  color: THREE.Color,
  opacity = 0.22,
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  ctx.clearRect(0, 0, width, height);

  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);

  const cell = 34;

  for (let y = 0; y < height + cell; y += cell) {
    for (let x = 0; x < width + cell; x += cell) {
      const x0 = x;
      const y0 = y;
      const x1 = x + cell * 0.5;
      const y1 = y + cell * 0.3;
      const x2 = x + cell;
      const y2 = y + cell * 0.6;
      const x3 = x + cell * 0.45;
      const y3 = y + cell;

      ctx.beginPath();
      ctx.moveTo(x0, y0 + cell * 0.35);
      ctx.lineTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x3, y3);
      ctx.closePath();

      ctx.fillStyle = `rgba(${r},${g},${b},${opacity * 0.5})`;
      ctx.fill();

      ctx.strokeStyle = `rgba(${r},${g},${b},${opacity})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  const gradient = ctx.createRadialGradient(width / 2, height * 0.42, 40, width / 2, height * 0.42, 220);
  gradient.addColorStop(0, "rgba(0,0,0,0.92)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");

  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(width / 2, height * 0.42, 170, 135, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.needsUpdate = true;
  return texture;
}

async function createPortraitTexture(player: PlayerCardData): Promise<THREE.CanvasTexture> {
  const canvas = document.createElement("canvas");
  canvas.width = 700;
  canvas.height = 760;
  const ctx = canvas.getContext("2d")!;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
  bg.addColorStop(0, "rgba(8,12,22,0.00)");
  bg.addColorStop(0.35, "rgba(8,12,22,0.05)");
  bg.addColorStop(1, "rgba(8,12,22,0.10)");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const imageSources = [player.image, ...(player.imageCandidates || [])]
    .map((entry) => String(entry || "").trim())
    .filter((entry) => entry.length > 0);

  let selectedImage: HTMLImageElement | null = null;
  for (const src of imageSources) {
    try {
      selectedImage = await loadImage(src);
      break;
    } catch {
      continue;
    }
  }

  if (selectedImage) {
    try {
      const img = selectedImage;
      const maxW = canvas.width * 0.66;
      const maxH = canvas.height * 0.70;
      const scale = Math.min(maxW / img.width, maxH / img.height);
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      const dx = (canvas.width - drawW) / 2;
      const dy = canvas.height * 0.13;

      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.35)";
      ctx.shadowBlur = 24;
      ctx.shadowOffsetY = 12;
      ctx.drawImage(img, dx, dy, drawW, drawH);
      ctx.restore();
    } catch {
      ctx.fillStyle = "#2a2f38";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  const radial = ctx.createRadialGradient(
    canvas.width * 0.5,
    canvas.height * 0.52,
    10,
    canvas.width * 0.5,
    canvas.height * 0.52,
    240,
  );
  radial.addColorStop(0, "rgba(255,255,255,0.16)");
  radial.addColorStop(0.3, "rgba(255,255,255,0.06)");
  radial.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = radial;
  ctx.beginPath();
  ctx.ellipse(canvas.width * 0.5, canvas.height * 0.54, 220, 180, 0, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function createFaceOverlayTexture(player: PlayerCardData): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1430;
  const ctx = canvas.getContext("2d")!;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  const rating = Math.max(45, Math.min(99, Number(player.rating) || 70));
  const position = String(player.position || "").toUpperCase();
  const name = fitName(player.name, 20);
  const club = String(player.club || player.team || "FantasyFC").toUpperCase();
  const level = Math.max(1, Number(player.level) || 1);
  const xp = Math.max(0, Number(player.xp) || 0);
  const xpMax = Math.max(100, Number(player.xpMax) || 1000);
  const last5 = getLast5(player);
  const badge = getRarityBadgeColors(player.rarity);
  const rarityLabel = getRarityLabel(player.rarity);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 112px Arial";
  ctx.fillText(String(rating), 106, 150);

  ctx.fillStyle = "rgba(255,255,255,0.90)";
  ctx.font = "bold 46px Arial";
  ctx.fillText(position, 110, 206);

  const pillX = 690;
  const pillY = 84;
  const pillW = 210;
  const pillH = 70;
  const pillR = 34;

  ctx.save();
  ctx.shadowColor = badge.glow;
  ctx.shadowBlur = 20;
  ctx.fillStyle = badge.bg;
  ctx.strokeStyle = badge.border;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pillX + pillR, pillY);
  ctx.lineTo(pillX + pillW - pillR, pillY);
  ctx.quadraticCurveTo(pillX + pillW, pillY, pillX + pillW, pillY + pillR);
  ctx.lineTo(pillX + pillW, pillY + pillH - pillR);
  ctx.quadraticCurveTo(pillX + pillW, pillY + pillH, pillX + pillW - pillR, pillY + pillH);
  ctx.lineTo(pillX + pillR, pillY + pillH);
  ctx.quadraticCurveTo(pillX, pillY + pillH, pillX, pillY + pillH - pillR);
  ctx.lineTo(pillX, pillY + pillR);
  ctx.quadraticCurveTo(pillX, pillY, pillX + pillR, pillY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 28px Arial";
  ctx.textAlign = "center";
  ctx.fillText(rarityLabel, pillX + pillW / 2, pillY + 46);

  ctx.save();
  const orbs = [
    { x: 308, y: 116, r: 16 },
    { x: 500, y: 408, r: 34 },
    { x: 500, y: 502, r: 22 },
  ];
  for (const orb of orbs) {
    const g = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, orb.r);
    g.addColorStop(0, "rgba(255,255,255,0.98)");
    g.addColorStop(0.32, "rgba(255,255,255,0.32)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(orb.x, orb.y, orb.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 54px Arial";
  ctx.fillText(name, 512, 1172);

  ctx.fillStyle = "rgba(220,226,235,0.78)";
  ctx.font = "30px Arial";
  ctx.fillText(club, 512, 1220);

  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = "bold 34px Arial";
  ctx.fillText(`LV ${level}`, 108, 1330);
  ctx.fillStyle = "rgba(255,255,255,0.88)";
  ctx.fillText(`XP ${xp}/${xpMax}`, 366, 1330);
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.fillText("L5", 108, 1386);

  const dotColors = ["#84cc16", "#22c55e", "#f59e0b", "#fb923c", "#a3e635"];
  let startX = 220;
  for (let i = 0; i < 5; i += 1) {
    const x = startX + i * 118;
    const value = last5[i] ?? 0;
    ctx.fillStyle = dotColors[i % dotColors.length];
    ctx.beginPath();
    ctx.arc(x - 28, 1377, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.font = "bold 30px Arial";
    ctx.fillText(String(value), x, 1386);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function getRarityLabel(rarity: Rarity) {
  return String(rarity || "common").toUpperCase();
}

function getRarityBadgeColors(rarity: Rarity) {
  switch (rarity) {
    case "rare":
      return {
        bg: "rgba(74,144,226,0.22)",
        border: "rgba(144,190,255,0.50)",
        glow: "rgba(74,144,226,0.35)",
      };
    case "unique":
      return {
        bg: "rgba(155,89,255,0.24)",
        border: "rgba(208,176,255,0.54)",
        glow: "rgba(155,89,255,0.35)",
      };
    case "epic":
      return {
        bg: "rgba(255,79,216,0.24)",
        border: "rgba(255,176,232,0.52)",
        glow: "rgba(255,79,216,0.32)",
      };
    case "legendary":
      return {
        bg: "rgba(255,190,40,0.26)",
        border: "rgba(255,225,140,0.58)",
        glow: "rgba(255,190,40,0.36)",
      };
    default:
      return {
        bg: "rgba(210,220,240,0.14)",
        border: "rgba(255,255,255,0.28)",
        glow: "rgba(255,255,255,0.14)",
      };
  }
}

function fitName(name: string, max = 20) {
  const clean = String(name || "").trim().toUpperCase();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1)}...`;
}

function getLast5(player: PlayerCardData) {
  const last5 = Array.isArray(player.last5Scores) ? player.last5Scores.slice(0, 5) : [];
  while (last5.length < 5) last5.push(0);
  return last5;
}

export default function Metal3DCard({ player, className = "" }: Metal3DCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const slabRef = useRef<THREE.Group | null>(null);
  const mousePosRef = useRef({ x: 0, y: 0 });
  const isMobile = useIsMobile();

  useEffect(() => {
    const candidates = player.imageCandidates || [];
    console.info("[Metal3DCard] render debug", {
      id: player.id,
      name: player.name,
      isMobile,
      image: player.image,
      hasImage: Boolean(player.image),
      candidateCount: candidates.length,
      firstCandidate: candidates[0],
      zOrder: {
        shellPattern: 0.196,
        portrait: 0.225,
        overlay: 0.235,
      },
    });
  }, [isMobile, player.id, player.name, player.image, player.imageCandidates]);

  useEffect(() => {
    if (isMobile || !containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);
    camera.position.set(0, 0, 4.9);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height, false);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.background = "transparent";
    containerRef.current.appendChild(renderer.domElement);

    const slab = new THREE.Group();
    slabRef.current = slab;
    scene.add(slab);

    const metalConfig = rarityMetals[player.rarity];

    const bodyShape = createRoundedRectShape(1.98, 2.82, 0.16);
    const bodyGeometry = new THREE.ExtrudeGeometry(bodyShape, {
      depth: 0.42,
      bevelEnabled: true,
      bevelSegments: 6,
      steps: 1,
      bevelSize: 0.045,
      bevelThickness: 0.055,
      curveSegments: 24,
    });
    bodyGeometry.center();

    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: metalConfig.rimColor.clone().multiplyScalar(0.72),
      metalness: 0.98,
      roughness: 0.18,
      envMapIntensity: 1.9,
    });
    const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    slab.add(bodyMesh);

    const faceGeometry = new THREE.BoxGeometry(1.76, 2.56, 0.09);
    const faceMaterial = new THREE.MeshStandardMaterial({
      color: metalConfig.metalColor.clone().multiplyScalar(0.95),
      metalness: 0.9,
      roughness: 1 - metalConfig.glossiness + 0.05,
      envMapIntensity: 2.0,
    });
    const faceMesh = new THREE.Mesh(faceGeometry, faceMaterial);
    faceMesh.position.z = 0.155;
    faceMesh.castShadow = true;
    faceMesh.receiveShadow = true;
    slab.add(faceMesh);

    const portraitFrameGeometry = new THREE.BoxGeometry(1.78, 1.58, 0.05);
    const portraitFrameMaterial = new THREE.MeshStandardMaterial({
      color: metalConfig.rimColor.clone().multiplyScalar(0.82),
      metalness: 0.96,
      roughness: 0.14,
    });
    const portraitFrameMesh = new THREE.Mesh(portraitFrameGeometry, portraitFrameMaterial);
    portraitFrameMesh.position.set(0, 0.36, 0.19);
    portraitFrameMesh.castShadow = true;
    portraitFrameMesh.receiveShadow = true;
    slab.add(portraitFrameMesh);

    const engravedTexture = createEngravedPatternTexture(
      1024,
      1024,
      metalConfig.patternColor,
      player.rarity === "legendary" ? 0.28 : player.rarity === "unique" ? 0.24 : 0.18,
    );
    const shellPatternMaterial = new THREE.MeshStandardMaterial({
      map: engravedTexture,
      transparent: true,
      opacity: 0.62,
      metalness: 0.25,
      roughness: 0.45,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const shellPatternGeometry = new THREE.PlaneGeometry(1.76, 2.56);
    const shellPatternMesh = new THREE.Mesh(shellPatternGeometry, shellPatternMaterial);
    shellPatternMesh.position.set(0, 0, 0.18);
    shellPatternMesh.renderOrder = 5;
    slab.add(shellPatternMesh);

    const grooveMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x111111),
      metalness: 0.7,
      roughness: 0.2,
    });
    const groove1 = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.018, 0.025), grooveMaterial);
    groove1.position.set(0, -0.78, 0.205);
    slab.add(groove1);

    const groove2 = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.018, 0.025), grooveMaterial);
    groove2.position.set(0, -0.84, 0.205);
    slab.add(groove2);

    const chevronMaterial = new THREE.MeshStandardMaterial({
      color: metalConfig.rimColor.clone().multiplyScalar(0.58),
      metalness: 0.95,
      roughness: 0.12,
    });

    const leftChevron = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.03, 0.03), chevronMaterial);
    leftChevron.position.set(-0.22, 0.98, 0.205);
    leftChevron.rotation.z = -0.5;
    slab.add(leftChevron);

    const rightChevron = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.03, 0.03), chevronMaterial);
    rightChevron.position.set(0.22, 0.98, 0.205);
    rightChevron.rotation.z = 0.5;
    slab.add(rightChevron);

    const shineMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xffffff),
      transparent: true,
      opacity: player.rarity === "common" ? 0.08 : 0.16,
      metalness: 0.1,
      roughness: 0.05,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const shineGeometry = new THREE.PlaneGeometry(0.42, 2.3);
    const shineMesh = new THREE.Mesh(shineGeometry, shineMaterial);
    shineMesh.position.set(-0.32, 0, 0.24);
    shineMesh.renderOrder = 10;
    shineMesh.rotation.z = -0.28;
    slab.add(shineMesh);

    let portraitTex: THREE.CanvasTexture | null = null;
    let overlayTex: THREE.CanvasTexture | null = null;
    let portraitMaterial: THREE.MeshBasicMaterial | null = null;
    let overlayMaterial: THREE.MeshBasicMaterial | null = null;
    let portraitPlaneGeometry: THREE.PlaneGeometry | null = null;
    let overlayGeometry: THREE.PlaneGeometry | null = null;
    let portraitMesh: THREE.Mesh | null = null;
    let overlayMesh: THREE.Mesh | null = null;
    let cancelled = false;

    overlayTex = createFaceOverlayTexture(player);
    overlayMaterial = new THREE.MeshBasicMaterial({
      map: overlayTex,
      transparent: true,
      depthWrite: false,
    });
    overlayGeometry = new THREE.PlaneGeometry(1.76, 2.56);
    overlayMesh = new THREE.Mesh(overlayGeometry, overlayMaterial);
    overlayMesh.position.set(0, 0, 0.34);
    overlayMesh.renderOrder = 30;
    slab.add(overlayMesh);
    console.log("[Metal3DCard] overlay added", player.name);

    createPortraitTexture(player)
      .then((pTex) => {
        if (cancelled) {
          pTex.dispose();
          return;
        }

        portraitTex = pTex;
        portraitMaterial = new THREE.MeshBasicMaterial({
          map: portraitTex,
          transparent: true,
          depthWrite: false,
        });
        portraitPlaneGeometry = new THREE.PlaneGeometry(1.46, 1.62);
        portraitMesh = new THREE.Mesh(portraitPlaneGeometry, portraitMaterial);
        portraitMesh.position.set(0, 0.18, 0.29);
        portraitMesh.renderOrder = 20;
        slab.add(portraitMesh);
        console.log("[Metal3DCard] portrait added", player.name, player.image);
      })
      .catch((err) => {
        console.error("[Metal3DCard] portrait load failed", player.name, err);
      });

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(4, 5, 6);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.far = 20;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x7fd6ff, 1.2);
    rimLight.position.set(-5, 3, 4);
    scene.add(rimLight);

    const fillLight = new THREE.PointLight(0xffd27a, 0.8, 15);
    fillLight.position.set(0, -2, 5);
    scene.add(fillLight);

    const backLight = new THREE.DirectionalLight(0x4a90e2, 0.6);
    backLight.position.set(0, 0, -6);
    scene.add(backLight);

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      mousePosRef.current = { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) };
    };

    containerRef.current.addEventListener("mousemove", handleMouseMove);

    let rafId = 0;
    const animate = () => {
      rafId = requestAnimationFrame(animate);
      if (slabRef.current) {
        slabRef.current.rotation.x += (mousePosRef.current.y * 0.08 - slabRef.current.rotation.x) * 0.08;
        slabRef.current.rotation.y += (mousePosRef.current.x * 0.1 - slabRef.current.rotation.y) * 0.08;
      }
      shineMesh.position.x = -0.32 + Math.sin(performance.now() * 0.0012) * 0.08;
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      const newWidth = containerRef.current?.clientWidth || width;
      const newHeight = containerRef.current?.clientHeight || height;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight, false);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      if (containerRef.current) {
        containerRef.current.removeEventListener("mousemove", handleMouseMove);
        if (renderer.domElement.parentElement === containerRef.current) {
          containerRef.current.removeChild(renderer.domElement);
        }
      }
      window.removeEventListener("resize", handleResize);

      if (portraitMesh && portraitMesh.parent) portraitMesh.parent.remove(portraitMesh);
      if (overlayMesh && overlayMesh.parent) overlayMesh.parent.remove(overlayMesh);

      bodyGeometry.dispose();
      faceGeometry.dispose();
      portraitFrameGeometry.dispose();
      shellPatternGeometry.dispose();
      groove1.geometry.dispose();
      groove2.geometry.dispose();
      leftChevron.geometry.dispose();
      rightChevron.geometry.dispose();
      shineGeometry.dispose();
      portraitPlaneGeometry?.dispose();
      overlayGeometry?.dispose();

      bodyMaterial.dispose();
      faceMaterial.dispose();
      portraitFrameMaterial.dispose();
      shellPatternMaterial.dispose();
      grooveMaterial.dispose();
      chevronMaterial.dispose();
      shineMaterial.dispose();
      portraitMaterial?.dispose();
      overlayMaterial?.dispose();

      engravedTexture.dispose();
      portraitTex?.dispose();
      overlayTex?.dispose();
      renderer.dispose();
    };
  }, [
    isMobile,
    player.id,
    player.name,
    player.rating,
    player.position,
    player.club,
    player.image,
    player.rarity,
    player.serial,
    player.maxSupply,
  ]);

  useEffect(() => {
    mousePosRef.current = { x: 0, y: 0 };
  }, [player.id]);

  if (isMobile) {
    return <SimpleCard player={player} className={className} />;
  }

  return (
    <div
      ref={containerRef}
      className={`relative h-[364px] w-[260px] overflow-visible ${className}`}
      style={{ perspective: "1000px" }}
    />
  );
}
