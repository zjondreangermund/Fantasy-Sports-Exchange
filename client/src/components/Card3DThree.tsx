import React, { useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, RoundedBox, useTexture, ContactShadows, Float } from "@react-three/drei";

type Card3DProps = {
  /** Front face image (png/jpg/webp). Transparent PNG looks great. */
  frontImageUrl: string;

  /** Optional "side" color (rarity color). */
  edgeColor?: string;

  /** Width in 3D units (default fits nicely in UI). */
  width?: number;

  /** Height in 3D units. */
  height?: number;

  /** Thickness in 3D units. */
  depth?: number;

  /** Rounds the corners (0.06–0.12 feels like your reference). */
  radius?: number;

  /** Auto rotate slowly (like pack display). */
  autoRotate?: boolean;

  /** Slightly tilt toward cursor (recommended). */
  interactiveTilt?: boolean;

  className?: string;
};

function CardMesh({
  frontImageUrl,
  edgeColor = "#3b82f6",
  width = 2.2,
  height = 3.1,
  depth = 0.14,
  radius = 0.12,
  autoRotate = true,
  interactiveTilt = true,
}: Omit<Card3DProps, "className">) {
  const group = useRef<THREE.Group>(null);

  // Load front texture
  const frontTex = useTexture(frontImageUrl);
  frontTex.colorSpace = THREE.SRGBColorSpace;
  frontTex.anisotropy = 8;

  // Materials:
  // - Front: texture + slight gloss
  // - Back: subtle dark material (you can swap for back texture later)
  // - Sides: colored edge (rarity)
  const materials = useMemo(() => {
    const front = new THREE.MeshStandardMaterial({
      map: frontTex,
      roughness: 0.45,
      metalness: 0.15,
    });

    const back = new THREE.MeshStandardMaterial({
      color: "#0b0b10",
      roughness: 0.8,
      metalness: 0.05,
    });

    const sides = new THREE.MeshStandardMaterial({
      color: new THREE.Color(edgeColor),
      roughness: 0.55,
      metalness: 0.25,
    });

    return { front, back, sides };
  }, [frontTex, edgeColor]);

  // Mouse-driven tilt
  const mouse = useRef({ x: 0, y: 0 });
  const targetRot = useRef({ x: 0, y: 0 });

  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;

    if (autoRotate) g.rotation.y += delta * 0.25;

    if (interactiveTilt) {
      // state.pointer is -1..1
      const px = state.pointer.x;
      const py = state.pointer.y;

      targetRot.current.y = px * 0.35;
      targetRot.current.x = -py * 0.25;

      g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, targetRot.current.y, 0.08);
      g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, targetRot.current.x, 0.08);
    }
  });

  // RoundedBox allows multiple materials via material array (by face groups)
  // In drei, RoundedBox creates a single geometry; we'll use a trick:
  // Use MeshStandardMaterial on the mesh, then overlay the front plane for the texture.
  // This gives clean edge color + perfect front print.

  return (
    <group ref={group} position={[0, 0.2, 0]}>
      {/* Base card body (edges + back) */}
      <RoundedBox args={[width, height, depth]} radius={radius} smoothness={8}>
        <meshStandardMaterial color={edgeColor} roughness={0.55} metalness={0.25} />
      </RoundedBox>

      {/* Back face overlay */}
      <mesh position={[0, 0, -depth / 2 - 0.001]}>
        <planeGeometry args={[width - 0.08, height - 0.08]} />
        <primitive object={materials.back} attach="material" />
      </mesh>

      {/* Front face overlay (texture) */}
      <mesh position={[0, 0, depth / 2 + 0.001]}>
        <planeGeometry args={[width - 0.06, height - 0.06]} />
        <primitive object={materials.front} attach="material" />
      </mesh>

      {/* Subtle front gloss highlight (like your reference) */}
      <mesh position={[0, 0.25, depth / 2 + 0.002]} rotation={[0, 0, -0.15]}>
        <planeGeometry args={[width * 0.95, height * 0.35]} />
        <meshStandardMaterial
          transparent
          opacity={0.12}
          roughness={0.2}
          metalness={0.0}
          color="#ffffff"
        />
      </mesh>
    </group>
  );
}

export default function Card3DThree(props: Card3DProps) {
  const {
    className,
    frontImageUrl,
    edgeColor = "#3b82f6",
    width = 2.2,
    height = 3.1,
    depth = 0.14,
    radius = 0.12,
    autoRotate = true,
    interactiveTilt = true,
  } = props;

  return (
    <div className={className ?? ""} style={{ width: "100%", height: "100%" }}>
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0.6, 5.2], fov: 35 }}
        gl={{ antialias: true, alpha: true }}
      >
        {/* Studio lighting similar to your reference */}
        <ambientLight intensity={0.45} />
        <directionalLight position={[3.5, 5, 4]} intensity={1.25} castShadow />
        <directionalLight position={[-3, 2.5, 2]} intensity={0.55} />

        {/* Nice reflections */}
        <Environment preset="studio" />

        <Float speed={1.2} rotationIntensity={0.2} floatIntensity={0.25}>
          <CardMesh
            frontImageUrl={frontImageUrl}
            edgeColor={edgeColor}
            width={width}
            height={height}
            depth={depth}
            radius={radius}
            autoRotate={autoRotate}
            interactiveTilt={interactiveTilt}
          />
        </Float>

        {/* Ground shadow like the screenshot */}
        <ContactShadows
          position={[0, -1.35, 0]}
          opacity={0.55}
          scale={8}
          blur={2.8}
          far={8}
        />
      </Canvas>
    </div>
  );
}
