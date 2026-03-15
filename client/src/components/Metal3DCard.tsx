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
    glossiness: 0.8,
    patternColor: new THREE.Color(0x1e3a5f),
  },
  unique: {
    metalColor: new THREE.Color(0x00d4ff),
    rimColor: new THREE.Color(0xff63cd),
    glossiness: 0.9,
    patternColor: new THREE.Color(0xff63cd),
  },
  epic: {
    metalColor: new THREE.Color(0x9b59ff),
    rimColor: new THREE.Color(0x5d2ea8),
    glossiness: 0.88,
    patternColor: new THREE.Color(0x3f2570),
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

  ctx.fillStyle = "#101216";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (player.image) {
    try {
      const img = await loadImage(player.image);

      const targetAspect = canvas.width / canvas.height;
      const sourceAspect = img.width / img.height;

      let sx = 0;
      let sy = 0;
      let sw = img.width;
      let sh = img.height;

      if (sourceAspect > targetAspect) {
        sw = img.height * targetAspect;
        sx = (img.width - sw) / 2;
      } else {
        sh = img.width / targetAspect;
        sy = img.height * 0.08;
        if (sy + sh > img.height) sy = img.height - sh;
      }

      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    } catch {
      ctx.fillStyle = "#2a2f38";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, "rgba(0,0,0,0.10)");
  grad.addColorStop(0.7, "rgba(0,0,0,0.02)");
  grad.addColorStop(1, "rgba(0,0,0,0.28)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

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
  ctx.textAlign = "center";

  const rating = Math.max(45, Math.min(99, Number(player.rating) || 70));
  const pos = String(player.position || "").toUpperCase();

  const atkBias = pos.includes("ST") || pos.includes("FW") ? 8 : pos.includes("MID") ? 4 : -2;
  const defBias = pos.includes("GK") || pos.includes("DEF") ? 9 : pos.includes("MID") ? 3 : -4;

  const stats = [
    ["ATK", Math.max(40, Math.min(99, rating + atkBias))],
    ["VIS", Math.max(38, Math.min(99, Math.round(rating * 0.9)))],
    ["CTL", Math.max(38, Math.min(99, Math.round(rating * 0.94 + 2)))],
    ["DEF", Math.max(35, Math.min(99, rating + defBias))],
    ["ENG", Math.max(40, Math.min(99, Math.round(rating * 0.82 + 12)))],
    ["FRM", Math.max(40, Math.min(99, Math.round(rating * 0.78 + 10)))],
  ];

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 82px Arial";
  ctx.fillText(String(player.rating), 180, 120);

  ctx.font = "bold 44px Arial";
  ctx.fillText(player.position, 840, 120);

  ctx.font = "bold 54px Arial";
  ctx.fillText(player.name, 512, 1015);

  ctx.fillStyle = "#c9d0da";
  ctx.font = "28px Arial";
  ctx.fillText(`${player.position} • ${player.club || "FantasyFC"}`, 512, 1065);

  const startX = 238;
  const startY = 1120;
  const gapX = 150;
  const gapY = 110;

  for (let i = 0; i < stats.length; i += 1) {
    const row = Math.floor(i / 3);
    const col = i % 3;
    const x = startX + col * gapX;
    const y = startY + row * gapY;

    ctx.fillStyle = "rgba(255,255,255,0.86)";
    ctx.font = "bold 22px Arial";
    ctx.fillText(String(stats[i][0]), x, y);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 42px Arial";
    ctx.fillText(String(stats[i][1]), x, y + 42);
  }

  ctx.fillStyle = "#9ea6b2";
  ctx.font = "24px Arial";
  ctx.fillText(
    `#${String(player.serial || 1).padStart(3, "0")} / ${player.maxSupply || 500}`,
    512,
    1370,
  );

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
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
    shellPatternMesh.position.set(0, 0, 0.196);
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
    shineMesh.position.set(-0.32, 0, 0.228);
    shineMesh.rotation.z = -0.28;
    slab.add(shineMesh);

    let portraitTex: THREE.CanvasTexture | null = null;
    let overlayTex: THREE.CanvasTexture | null = null;
    let portraitMaterial: THREE.MeshStandardMaterial | null = null;
    let overlayMaterial: THREE.MeshStandardMaterial | null = null;
    let portraitPlaneGeometry: THREE.PlaneGeometry | null = null;
    let overlayGeometry: THREE.PlaneGeometry | null = null;

    Promise.all([createPortraitTexture(player), Promise.resolve(createFaceOverlayTexture(player))]).then(([pTex, oTex]) => {
      portraitTex = pTex;
      overlayTex = oTex;

      portraitMaterial = new THREE.MeshStandardMaterial({
        map: portraitTex,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
        metalness: 0.08,
        roughness: 0.22,
      });
      portraitPlaneGeometry = new THREE.PlaneGeometry(1.72, 1.5);
      const portraitMesh = new THREE.Mesh(portraitPlaneGeometry, portraitMaterial);
      portraitMesh.position.set(0, 0.36, 0.225);
      slab.add(portraitMesh);

      overlayMaterial = new THREE.MeshStandardMaterial({
        map: overlayTex,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
        metalness: 0.15,
        roughness: 0.2,
      });
      overlayGeometry = new THREE.PlaneGeometry(1.76, 2.56);
      const overlayMesh = new THREE.Mesh(overlayGeometry, overlayMaterial);
      overlayMesh.position.set(0, 0, 0.235);
      slab.add(overlayMesh);
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
      cancelAnimationFrame(rafId);
      if (containerRef.current) {
        containerRef.current.removeEventListener("mousemove", handleMouseMove);
        if (renderer.domElement.parentElement === containerRef.current) {
          containerRef.current.removeChild(renderer.domElement);
        }
      }
      window.removeEventListener("resize", handleResize);

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
