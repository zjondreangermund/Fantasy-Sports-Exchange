import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import CinematicBackground from "../components/CinematicBackground";
import Card3D from "../components/Card3D";
import { Button } from "../components/ui/button";
import { Volume2, VolumeX } from "lucide-react";
import { type PlayerCardWithPlayer } from "../../../shared/schema";

type OnboardingPhase =
  | "start"
  | "tunnel"
  | "light"
  | "pack-appear"
  | "pack-shake"
  | "pack-open"
  | "cards-reveal"
  | "complete";

export default function OnboardingTunnelPage() {
  const [, setLocation] = useLocation();
  const [phase, setPhase] = useState<OnboardingPhase>("start");
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [cardsRevealed, setCardsRevealed] = useState(false);
  const [selectedCards, setSelectedCards] = useState<Set<number>>(new Set());
  const [videoError, setVideoError] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Audio refs
  const crowdAudioRef = useRef<HTMLAudioElement | null>(null);
  const whooshAudioRef = useRef<HTMLAudioElement | null>(null);
  const packOpenAudioRef = useRef<HTMLAudioElement | null>(null);

  // Detect if mobile/portrait for video selection
  const isMobile = window.innerWidth < 768 || window.innerHeight > window.innerWidth;
  const tunnelVideo = isMobile ? "/cinematics/tunnel_9x16.mp4" : "/cinematics/tunnel_16x9.mp4";

  // Fetch user's cards for onboarding
  const { data: cards, isLoading } = useQuery<PlayerCardWithPlayer[]>({
    queryKey: ["/api/user/cards"],
    enabled: phase !== "start",
  });

  // Initialize audio
  useEffect(() => {
    crowdAudioRef.current = new Audio("/sfx/crowd_cheer.mp3");
    whooshAudioRef.current = new Audio("/sfx/whoosh.mp3");
    packOpenAudioRef.current = new Audio("/sfx/pack_open.mp3");

    // Set volumes
    if (crowdAudioRef.current) crowdAudioRef.current.volume = 0.6;
    if (whooshAudioRef.current) whooshAudioRef.current.volume = 0.4;
    if (packOpenAudioRef.current) packOpenAudioRef.current.volume = 0.7;

    return () => {
      // Cleanup audio
      crowdAudioRef.current?.pause();
      whooshAudioRef.current?.pause();
      packOpenAudioRef.current?.pause();
    };
  }, []);

  // Play audio helper
  const playAudio = (audioRef: React.MutableRefObject<HTMLAudioElement | null>) => {
    if (audioEnabled && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch((e) => console.log("Audio play failed:", e));
    }
  };

  // Start the cinematic sequence
  const startSequence = () => {
    setAudioEnabled(true);
    setPhase("tunnel");

    // Start crowd audio
    playAudio(crowdAudioRef);

    // Try to play tunnel video
    if (videoRef.current && !videoError) {
      videoRef.current.play().catch((e) => {
        console.log("Video play failed:", e);
        setVideoError(true);
      });
    }

    // Timeline orchestration
    setTimeout(() => setPhase("light"), 2500); // 2.5s: brighten
    setTimeout(() => setPhase("pack-appear"), 3000); // 3s: pack appears
    setTimeout(() => {
      setPhase("pack-shake");
      playAudio(whooshAudioRef);
    }, 3500); // 3.5s: pack shakes
    setTimeout(() => {
      setPhase("pack-open");
      playAudio(packOpenAudioRef);
    }, 4000); // 4s: pack opens
    setTimeout(() => {
      setPhase("cards-reveal");
      setCardsRevealed(true);
    }, 4200); // 4.2s: cards fly out
    setTimeout(() => setPhase("complete"), 5000); // 5s: UI appears
  };

  // Toggle card selection
  const toggleCard = (cardId: number) => {
    if (!cardsRevealed || phase !== "complete") return;

    setSelectedCards((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else if (next.size < 5) {
        next.add(cardId);
      }
      return next;
    });
  };

  // Complete onboarding
  const completeOnboarding = () => {
    if (selectedCards.size !== 5) return;
    // Navigate to dashboard
    setLocation("/dashboard");
  };

  const displayCards = cards?.slice(0, 9) || [];
  const canProceed = selectedCards.size === 5;

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black">
      {/* Cinematic Background */}
      <CinematicBackground
        show={phase !== "start"}
        overlayOpacity={phase === "light" ? 0.2 : 0.5}
      />

      {/* Audio Toggle (top right) */}
      {phase !== "start" && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          onClick={() => setAudioEnabled(!audioEnabled)}
          className="absolute top-4 right-4 z-50 p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
        >
          {audioEnabled ? (
            <Volume2 className="w-5 h-5 text-white" />
          ) : (
            <VolumeX className="w-5 h-5 text-white" />
          )}
        </motion.button>
      )}

      {/* Start Screen */}
      {phase === "start" && (
        <motion.div
          className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-gradient-to-b from-black via-zinc-900 to-black"
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="text-center space-y-6"
          >
            <h1 className="text-4xl md:text-6xl font-black text-white mb-2">
              Welcome, Manager
            </h1>
            <p className="text-lg text-gray-400 mb-8">
              Your journey begins here
            </p>
            <Button
              size="lg"
              onClick={startSequence}
              className="px-8 py-6 text-xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            >
              Enter the Stadium
            </Button>
          </motion.div>
        </motion.div>
      )}

      {/* "Crowd Cheering" Text */}
      {phase === "tunnel" && (
        <>
          {/* Video Background (if available) */}
          {!videoError && (
            <video
              ref={videoRef}
              src={tunnelVideo}
              className="absolute inset-0 w-full h-full object-cover z-0"
              muted
              playsInline
              onError={() => setVideoError(true)}
              poster="/cinematics/tunnel.png"
            />
          )}
          
          {/* Text Overlay */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1, delay: 1 }}
            className="absolute inset-0 flex items-center justify-center z-10"
          >
            <p className="text-3xl font-bold text-white/80 tracking-wider drop-shadow-lg">
              THE CROWD ROARS...
            </p>
          </motion.div>
        </>
      )}

      {/* Bloom/Light Effect */}
      {phase === "light" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="absolute inset-0 bg-white/20 z-10 backdrop-blur-sm"
        />
      )}

      {/* Pack Appear/Shake/Open */}
      {(phase === "pack-appear" || phase === "pack-shake" || phase === "pack-open") && (
        <motion.div
          initial={{ scale: 0, opacity: 0, rotateY: 0 }}
          animate={{
            scale: phase === "pack-shake" ? [1, 1.1, 0.9, 1.05, 1] : 1,
            opacity: 1,
            rotateY: phase === "pack-shake" ? [0, -10, 10, -5, 0] : 0,
          }}
          exit={{ scale: 1.5, opacity: 0 }}
          transition={{
            duration: phase === "pack-shake" ? 0.5 : 0.6,
            ease: "easeOut",
          }}
          className="absolute inset-0 flex items-center justify-center z-20"
          style={{ perspective: "1000px" }}
        >
          {/* Pack representation (glow + border) */}
          <div className="relative">
            {/* Glow effect */}
            <div className="absolute inset-0 bg-gradient-radial from-purple-500/50 via-purple-600/30 to-transparent rounded-3xl blur-3xl scale-150" />

            {/* Pack card */}
            <div
              className="relative w-64 h-80 rounded-2xl bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-700 flex items-center justify-center shadow-2xl"
              style={{
                boxShadow: "0 0 60px rgba(147, 51, 234, 0.6)",
                transform: phase === "pack-open" ? "rotateY(180deg)" : "rotateY(0deg)",
                transition: "transform 0.4s ease-out",
              }}
            >
              <div className="text-center">
                <div className="text-6xl mb-4">🎴</div>
                <p className="text-white font-bold text-xl">STARTER PACK</p>
                <p className="text-white/60 text-sm mt-2">9 Cards</p>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Cards Reveal */}
      <AnimatePresence>
        {phase === "cards-reveal" || phase === "complete" ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex items-center justify-center z-30 p-4 overflow-y-auto"
          >
            <div className="w-full max-w-6xl my-auto">
              {/* Cards Grid */}
              {isLoading ? (
                <div className="text-white text-center text-xl">Loading cards...</div>
              ) : (
                <div className="grid grid-cols-3 md:grid-cols-3 gap-3 md:gap-6">
                  {displayCards.map((card, index) => (
                    <motion.div
                      key={card.id}
                      initial={{ 
                        opacity: 0, 
                        scale: 0, 
                        rotateY: -90,
                        y: -200,
                        x: 0,
                      }}
                      animate={{ 
                        opacity: 1, 
                        scale: 1, 
                        rotateY: 0,
                        y: 0,
                        x: 0,
                      }}
                      transition={{
                        duration: 0.6,
                        delay: index * 0.1,
                        ease: "easeOut",
                      }}
                      className="flex justify-center"
                      style={{ 
                        transformStyle: "preserve-3d",
                        perspective: "1000px",
                      }}
                    >
                      <div 
                        onClick={() => toggleCard(card.id)}
                        className={`cursor-pointer transition-all duration-200 ${
                          selectedCards.has(card.id) 
                            ? "ring-4 ring-purple-500 scale-105" 
                            : "hover:scale-105"
                        }`}
                      >
                        <Card3D
                          card={card}
                          size="sm"
                          selected={selectedCards.has(card.id)}
                          selectable={phase === "complete"}
                        />
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* UI Controls (after complete) */}
      {phase === "complete" && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="fixed bottom-8 left-0 right-0 flex flex-col items-center gap-4 z-40"
        >
          <div className="bg-black/80 backdrop-blur-sm px-6 py-4 rounded-full">
            <p className="text-white font-semibold text-center">
              {selectedCards.size === 0 
                ? "Select your top 5 cards to build your starting lineup"
                : `${selectedCards.size}/5 cards selected`}
            </p>
          </div>
          <Button
            size="lg"
            onClick={completeOnboarding}
            disabled={!canProceed}
            className="px-8 py-6 text-lg font-bold bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:opacity-50"
          >
            {canProceed ? "Complete Onboarding" : "Select 5 Cards"}
          </Button>
        </motion.div>
      )}
    </div>
  );
}
