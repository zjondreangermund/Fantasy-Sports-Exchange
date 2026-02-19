import React, { useMemo, useRef, useEffect, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Environment, PerspectiveCamera, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { type PlayerCardWithPlayer } from "../../../shared/schema";

// Holographic shader
const HoloMaterial = () => {
  const materialRef = useRef<any>();

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.time.value = state.clock.elapsedTime * 0.5;
    }
  });

  const shaderData = useMemo(
    () => ({
      uniforms: { time: { value: 0 } },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform float time;
        varying vec2 vUv;
        void main() {
          float shine = sin((vUv.x + time) * 15.0) * 0.5 + 0.5;
          vec3 rainbow = vec3(
            sin(time + vUv.x * 5.0) * 0.5 + 0.5,
            sin(time + vUv.y * 5.0 + 2.0) * 0.5 + 0.5,
            sin(time + vUv.x * 5.0 + 4.0) * 0.5 + 0.5
          );
          gl_FragColor = vec4(rainbow * shine, 0.35);
        }`,
    }),
    [],
  );

  return <shaderMaterial ref={materialRef} args={[shaderData]} transparent />;
};

function useSafeTexture(url?: string | null) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!url) {
      setTexture(null);
      return;
    }

    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");

    loader.load(
      url,
      (tex) => {
        if (cancelled) return;
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.wrapS = THREE.ClampToEdgeWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        setTexture(tex);
      },
      undefined,
      () => {
        if (cancelled) return;
        setTexture(null);
      },
    );

    return () => {
      cancelled = true;
    };
  }, [url]);

  return texture;
}

export default function ThreeDPlayerCard({
  card,
  imageUrl,
}: {
  card: PlayerCardWithPlayer;
  imageUrl?: string | null;
}) {
  const cardShape = useMemo(() => {
    const shape = new THREE.Shape();
    const w = 2,
      h = 3,
      r = 0.2;

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

  const texture = useSafeTexture(
    imageUrl ??
      (card as any)?.player?.photoUrl ??
      (card as any)?.player?.imageUrl ??
      (card as any)?.player?.image_url ??
      (card as any)?.player?.photo ??
      null,
  );

  const baseColor = card.rarity === "legendary" ? "#ffd700" : "#1a1f2e";

  return (
    <div className="w-full h-full min-h-[300px] cursor-pointer">
      <Canvas
        shadows
        dpr={[1, 1.5]}
        frameloop="demand"
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      >
        <PerspectiveCamera makeDefault position={[0, 0, 5]} />
        <Environment preset="city" />
        <ambientLight intensity={0.6} />
        <spotLight position={[10, 10, 10]} angle={0.2} penumbra={1} intensity={1.2} castShadow />

        <Float speed={1.6} rotationIntensity={0.4} floatIntensity={0.8}>
          <group>
            {/* Card body */}
            <mesh castShadow receiveShadow>
              <extrudeGeometry
                args={[
                  cardShape,
                  {
                    depth: 0.1,
                    bevelEnabled: true,
                    bevelThickness: 0.04,
                    bevelSize: 0.04,
                    bevelSegments: 2,
                  },
                ]}
              />
              <meshPhysicalMaterial color={baseColor} metalness={1} roughness={0.25} clearcoat={1} />
            </mesh>

            {/* Player image on front */}
            <mesh position={[0, 0, 0.075]}>
              <planeGeometry args={[1.75, 2.65]} />
              <meshStandardMaterial
                map={texture ?? undefined}
                color={texture ? "#ffffff" : "#0b0f1a"}
                roughness={0.9}
                metalness={0.0}
              />
            </mesh>

            {/* Holographic overlay */}
            <mesh position={[0, 0, 0.09]}>
              <planeGeometry args={[1.78, 2.68]} />
              <HoloMaterial />
            </mesh>
          </group>
        </Float>

        <ContactShadows position={[0, -2, 0]} opacity={0.45} scale={10} blur={2.5} far={4} />
      </Canvas>
    </div>
  );
}

// Helper (kept)
export const eplPlayerToCard = (player: any): any => {
  return {
    id: player.id,
    rarity: "common",
    player: {
      name: player.name,
      position: player.position,
      image: player.photo ?? player.photoUrl ?? player.imageUrl ?? player.image_url ?? null,
    },
  };
};
