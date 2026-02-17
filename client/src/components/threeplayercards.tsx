import React, { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Environment, PerspectiveCamera, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { type PlayerCardWithPlayer } from "../../../shared/schema";

// This is your Holographic Shader translated for React
const HoloMaterial = () => {
  const materialRef = useRef<any>();
  
  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.time.value = state.clock.elapsedTime * 0.5;
    }
  });

  const shaderData = useMemo(() => ({
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
      }`
  }), []);

  return <shaderMaterial ref={materialRef} args={[shaderData]} transparent />;
};

export default function ThreeDPlayerCard({ card }: { card: PlayerCardWithPlayer }) {
  // Create the rounded card shape once
  const cardShape = useMemo(() => {
    const shape = new THREE.Shape();
    const w = 2, h = 3, r = 0.2;
    shape.moveTo(-w/2 + r, -h/2);
    shape.lineTo(w/2 - r, -h/2);
    shape.quadraticCurveTo(w/2, -h/2, w/2, -h/2 + r);
    shape.lineTo(w/2, h/2 - r);
    shape.quadraticCurveTo(w/2, h/2, w/2 - r, h/2);
    shape.lineTo(-w/2 + r, h/2);
    shape.quadraticCurveTo(-w/2, h/2, -w/2, h/2 - r);
    shape.lineTo(-w/2, -h/2 + r);
    shape.quadraticCurveTo(-w/2, -h/2, -w/2 + r, -h/2);
    return shape;
  }, []);

  return (
    <div className="w-full h-full min-h-[300px] cursor-pointer">
      <Canvas castShadow>
        <PerspectiveCamera makeDefault position={[0, 0, 5]} />
        <Environment preset="city" />
        <ambientLight intensity={0.5} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} />

        <Float speed={2} rotationIntensity={0.5} floatIntensity={1}>
          <group>
            {/* The Main Card Body */}
            <mesh castShadow>
              <extrudeGeometry args={[cardShape, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.05 }]} />
              <meshPhysicalMaterial 
                color={card.rarity === 'legendary' ? '#ffd700' : '#1a1f2e'} 
                metalness={1} 
                roughness={0.2} 
                clearcoat={1} 
              />
            </mesh>
            {/* The Holographic Overlay */}
            <mesh position={[0, 0, 0.06]}>
              <extrudeGeometry args={[cardShape, { depth: 0.01, bevelEnabled: false }]} />
              <HoloMaterial />
            </mesh>
          </group>
        </Float>
        
        <ContactShadows position={[0, -2, 0]} opacity={0.5} scale={10} blur={2.5} far={4} />
      </Canvas>
    </div>
  );
}
export const eplPlayerToCard = (player: any): any => {
  return {
    id: player.id,
    rarity: "common", // or logic to determine rarity
    player: {
      name: player.name,
      position: player.position,
      image: player.photo
    }
  };
}
