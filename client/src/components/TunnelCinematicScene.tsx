import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

type TunnelCinematicSceneProps = {
  phaseIntensity: number;
  flicker: boolean;
  showBeam: boolean;
};

function TunnelMesh({ phaseIntensity, flicker, showBeam }: TunnelCinematicSceneProps) {
  const tunnelRef = useRef<THREE.Mesh>(null);
  const beamRef = useRef<THREE.Mesh>(null);

  const particlePositions = useMemo(() => {
    const data = new Float32Array(320 * 3);
    for (let i = 0; i < 320; i += 1) {
      data[i * 3] = (Math.random() - 0.5) * 7;
      data[i * 3 + 1] = (Math.random() - 0.5) * 3.8;
      data[i * 3 + 2] = -Math.random() * 30;
    }
    return data;
  }, []);

  const particlesRef = useRef<THREE.Points>(null);

  useFrame((state, delta) => {
    const elapsed = state.clock.elapsedTime;

    state.camera.position.x = Math.sin(elapsed * 0.18) * 0.22;
    state.camera.position.y = 0.28 + Math.cos(elapsed * 0.14) * 0.06;
    state.camera.lookAt(0, 0, -12);

    if (tunnelRef.current) {
      tunnelRef.current.rotation.z = Math.sin(elapsed * 0.12) * 0.02;
    }

    if (beamRef.current) {
      const flickerStrength = flicker ? (0.75 + Math.sin(elapsed * 35) * 0.22) : 1;
      const beamOpacity = showBeam ? (0.18 + phaseIntensity * 0.3) * flickerStrength : 0;
      const mat = beamRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = THREE.MathUtils.lerp(mat.opacity, beamOpacity, 0.14);
      beamRef.current.scale.x = 1 + Math.sin(elapsed * 0.8) * 0.03;
    }

    if (particlesRef.current) {
      const arr = particlesRef.current.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < arr.length; i += 3) {
        arr[i + 2] += delta * (2.6 + phaseIntensity * 1.6);
        if (arr[i + 2] > 2.2) {
          arr[i + 2] = -30;
        }
      }
      particlesRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  return (
    <>
      <mesh ref={tunnelRef} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -8]}>
        <cylinderGeometry args={[4.2, 4.2, 28, 28, 1, true]} />
        <meshStandardMaterial color="#05060c" side={THREE.BackSide} roughness={0.95} metalness={0.05} />
      </mesh>

      <mesh ref={beamRef} position={[0, 0, -20]}>
        <planeGeometry args={[3.8, 14]} />
        <meshBasicMaterial color="#dbeafe" transparent opacity={0.25} blending={THREE.AdditiveBlending} />
      </mesh>

      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={particlePositions.length / 3}
            itemSize={3}
            array={particlePositions}
          />
        </bufferGeometry>
        <pointsMaterial color="#cbd5e1" size={0.04} opacity={0.22} transparent depthWrite={false} />
      </points>

      <ambientLight intensity={0.22 + phaseIntensity * 0.32} />
      <pointLight position={[0, 1.2, -18]} intensity={1.8 + phaseIntensity * 2.2} color="#e2e8f0" distance={20} />
      <pointLight position={[0, -1.2, -10]} intensity={0.5 + phaseIntensity * 0.4} color="#60a5fa" distance={8} />
    </>
  );
}

export default function TunnelCinematicScene({
  phaseIntensity,
  flicker,
  showBeam,
}: TunnelCinematicSceneProps) {
  return (
    <div className="absolute inset-0 z-0">
      <Canvas camera={{ position: [0, 0.35, 2], fov: 46 }} dpr={[1, 1.5]} gl={{ alpha: true, antialias: true }}>
        <fog attach="fog" args={["#02030a", 4, 26]} />
        <TunnelMesh phaseIntensity={phaseIntensity} flicker={flicker} showBeam={showBeam} />
      </Canvas>
    </div>
  );
}
