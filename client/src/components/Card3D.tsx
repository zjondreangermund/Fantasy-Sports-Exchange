import { useRef, useState, useMemo, Suspense, Component, type ReactNode } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { type PlayerCardWithPlayer, type EplPlayer } from "@shared/schema";

// ... (Keep your rarityStyles and epl helper functions exactly as they are)

export function PlayerCard({ player }: { player: EplPlayer }) {
  const cardData = useMemo(() => eplPlayerToCard(player), [player]);
  const [hovered, setHovered] = useState(false);
  const mouse = useRef({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mouse.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  };

  return (
    <div 
      className="relative w-full h-[500px] cursor-pointer"
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Canvas shadows camera={{ position: [0, 0, 5], fov: 45 }}>
        <ambientLight intensity={0.5} />
        <Suspense fallback={null}>
          <CardMesh 
            rarity={cardData.rarity as RarityKey} 
            playerImageUrl={cardData.player.imageUrl} 
            hovered={hovered} 
            mouse={mouse} 
          />
        </Suspense>
      </Canvas>

      {/* HTML Overlay for Stats */}
      <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-end pb-8">
        <h2 className="text-white text-2xl font-bold uppercase tracking-widest">
            {cardData.player.name}
        </h2>
        <div className="flex gap-4 mt-2">
            <span className="text-yellow-500 font-bold">OVR {cardData.player.overall}</span>
            <span className="text-gray-400">{cardData.player.position}</span>
        </div>
      </div>
    </div>
  );
}
