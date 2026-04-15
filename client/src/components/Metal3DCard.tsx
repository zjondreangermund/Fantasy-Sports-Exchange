import SimpleCard from "./SimpleCard";

export type Rarity = "common" | "rare" | "unique" | "epic" | "legendary";

export type PlayerCardData = {
  id: string;
  name: string;
  rating: number;
  position: string;
  club?: string;
  image?: string;
  imageUrl?: string;
  photo?: string;
  imageCandidates?: string[];
  rarity: Rarity;
  serial?: number;
  maxSupply?: number;
  team?: string;
  league?: string;
  nationality?: string;
  level?: number;
  xp?: number;
  xpMax?: number;
  form?: number;
  last5Scores?: number[];
  price?: number;
  forSale?: boolean;
};

type Metal3DCardProps = {
  player: PlayerCardData;
  className?: string;
};

/**
 * Compatibility wrapper:
 * We intentionally keep a single lightweight 2D rendering path in production.
 */
export default function Metal3DCard({ player, className = "" }: Metal3DCardProps) {
  const forceSimple2D = true;
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
    if (forceSimple2D) return;
    if (isMobile || !containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);
    camera.position.set(0, 0, 4.9);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
    engravedTexture.generateMipmaps = true;
    engravedTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    engravedTexture.magFilter = THREE.LinearFilter;
    engravedTexture.minFilter = THREE.LinearMipmapLinearFilter;
    engravedTexture.needsUpdate = true;
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

    const shineMaterial2 = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0xffffff),
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
    });
    const shineGeometry2 = new THREE.PlaneGeometry(0.24, 2.15);
    const shineMesh2 = new THREE.Mesh(shineGeometry2, shineMaterial2);
    shineMesh2.position.set(0.18, 0.04, 0.245);
    shineMesh2.rotation.z = -0.34;
    shineMesh2.renderOrder = 11;
    slab.add(shineMesh2);

    const glowTex = createGlowTexture();
    glowTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    glowTex.needsUpdate = true;
    const glowMat = new THREE.MeshBasicMaterial({
      map: glowTex,
      transparent: true,
      opacity: player.rarity === "legendary" ? 0.34 : 0.2,
      depthWrite: false,
    });
    const glowMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.95), glowMat);
    glowMesh.position.set(0, 0.18, 0.27);
    glowMesh.renderOrder = 18;
    slab.add(glowMesh);

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
    overlayTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    overlayTex.needsUpdate = true;
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
        portraitTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
        portraitTex.needsUpdate = true;
        portraitMaterial = new THREE.MeshBasicMaterial({
          map: portraitTex,
          transparent: true,
          depthWrite: false,
        });
        portraitPlaneGeometry = new THREE.PlaneGeometry(1.06, 1.22);
        portraitMesh = new THREE.Mesh(portraitPlaneGeometry, portraitMaterial);
        portraitMesh.position.set(0, 0.34, 0.29);
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

    const rarityGlow = new THREE.PointLight(getRarityGlowColor(player.rarity), 0.9, 4);
    rarityGlow.position.set(0, -0.4, 1.4);
    slab.add(rarityGlow);

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
      const t = performance.now();
      shineMesh.position.x = -0.32 + Math.sin(t * 0.0012) * 0.08;
      shineMesh2.position.x = 0.18 + Math.sin(t * 0.0014 + 0.8) * 0.06;
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
      shineGeometry2.dispose();
      glowMesh.geometry.dispose();
      portraitPlaneGeometry?.dispose();
      overlayGeometry?.dispose();

      bodyMaterial.dispose();
      faceMaterial.dispose();
      portraitFrameMaterial.dispose();
      shellPatternMaterial.dispose();
      grooveMaterial.dispose();
      chevronMaterial.dispose();
      shineMaterial.dispose();
      shineMaterial2.dispose();
      glowMat.dispose();
      portraitMaterial?.dispose();
      overlayMaterial?.dispose();

      engravedTexture.dispose();
      glowTex.dispose();
      portraitTex?.dispose();
      overlayTex?.dispose();
      renderer.dispose();
    };
  }, [
    forceSimple2D,
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

  if (forceSimple2D) {
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
