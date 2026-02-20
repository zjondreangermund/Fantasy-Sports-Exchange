import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import Card3D from "../components/Card3D";
import { type PlayerCardWithPlayer } from "../../../shared/schema";

export default function OnboardingTunnelPage() {
  const [, setLocation] = useLocation();
  const [stage, setStage] = useState<"tunnel" | "cards" | "complete">("tunnel");

  // Fetch user's cards
  const { data: cards } = useQuery<PlayerCardWithPlayer[]>({
    queryKey: ["/api/user/cards"],
  });

  useEffect(() => {
    // Tunnel animation: 3 seconds
    const tunnelTimer = setTimeout(() => {
      setStage("cards");
    }, 3000);

    // Show cards: 4 seconds
    const cardsTimer = setTimeout(() => {
      setStage("complete");
    }, 7000);

    // Redirect to dashboard: 2 seconds after cards
    const redirectTimer = setTimeout(() => {
      setLocation("/");
    }, 9000);

    return () => {
      clearTimeout(tunnelTimer);
      clearTimeout(cardsTimer);
      clearTimeout(redirectTimer);
    };
  }, [setLocation]);

  return (
    <div className="fixed inset-0 z-50 bg-black overflow-hidden">
      <AnimatePresence mode="wait">
        {stage === "tunnel" && (
          <motion.div
            key="tunnel"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            {/* Tunnel perspective effect */}
            <div
              className="absolute inset-0"
              style={{
                background: "radial-gradient(ellipse 30% 50% at 50% 50%, rgba(100,100,100,0.3) 0%, rgba(0,0,0,1) 70%)",
              }}
            />
            
            {/* Animated tunnel lines */}
            {[...Array(12)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ 
                  scale: [0, 5, 10],
                  opacity: [0, 0.6, 0],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  delay: i * 0.15,
                  ease: "easeOut",
                }}
                className="absolute"
                style={{
                  width: "100%",
                  height: "2px",
                  background: `linear-gradient(90deg, transparent, ${i % 2 === 0 ? "#10b981" : "#3b82f6"}, transparent)`,
                  top: `${45 + Math.sin(i) * 5}%`,
                  transformOrigin: "50% 50%",
                }}
              />
            ))}

            {/* Walking silhouette */}
            <motion.div
              initial={{ y: 100, opacity: 0, scale: 0.5 }}
              animate={{ 
                y: -20,
                opacity: [0, 1, 1, 0.8],
                scale: [0.5, 1.2, 1.5, 2],
              }}
              transition={{ duration: 3, ease: "easeInOut" }}
              className="relative z-10"
            >
              <svg
                width="100"
                height="200"
                viewBox="0 0 100 200"
                className="drop-shadow-2xl"
              >
                <g fill="#1e293b" stroke="#3b82f6" strokeWidth="2">
                  {/* Head */}
                  <circle cx="50" cy="30" r="15" />
                  {/* Body */}
                  <rect x="40" y="45" width="20" height="50" rx="5" />
                  {/* Arms */}
                  <motion.rect
                    x="25"
                    y="50"
                    width="12"
                    height="40"
                    rx="6"
                    animate={{ rotate: [-10, 10, -10] }}
                    transition={{ duration: 0.6, repeat: Infinity }}
                    style={{ transformOrigin: "31px 50px" }}
                  />
                  <motion.rect
                    x="63"
                    y="50"
                    width="12"
                    height="40"
                    rx="6"
                    animate={{ rotate: [10, -10, 10] }}
                    transition={{ duration: 0.6, repeat: Infinity }}
                    style={{ transformOrigin: "69px 50px" }}
                  />
                  {/* Legs */}
                  <motion.rect
                    x="40"
                    y="95"
                    width="10"
                    height="50"
                    rx="5"
                    animate={{ rotate: [15, -15, 15] }}
                    transition={{ duration: 0.6, repeat: Infinity }}
                    style={{ transformOrigin: "45px 95px" }}
                  />
                  <motion.rect
                    x="50"
                    y="95"
                    width="10"
                    height="50"
                    rx="5"
                    animate={{ rotate: [-15, 15, -15] }}
                    transition={{ duration: 0.6, repeat: Infinity }}
                    style={{ transformOrigin: "55px 95px" }}
                  />
                </g>
              </svg>
            </motion.div>

            {/* Crowd cheering text */}
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: [0, 1, 1, 0], y: [50, 0, 0, -20] }}
              transition={{ duration: 3, times: [0, 0.3, 0.8, 1] }}
              className="absolute bottom-32 text-center w-full"
            >
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 0.5, repeat: Infinity }}
                className="text-4xl font-black text-white uppercase tracking-wider"
                style={{
                  textShadow: "0 0 20px rgba(59,130,246,0.8), 0 0 40px rgba(16,185,129,0.6)",
                }}
              >
                🎉 Crowd Cheering! 🎉
              </motion.div>
            </motion.div>
          </motion.div>
        )}

        {stage === "cards" && (
          <motion.div
            key="cards"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center gap-8 p-8"
          >
            {/* Stadium background */}
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: "linear-gradient(to bottom, rgba(0,0,0,0.7), rgba(0,0,0,0.9)), url(https://images.unsplash.com/photo-1522778119026-d647f0596c20?q=80&w=2000)",
                backgroundSize: "cover",
                backgroundPosition: "center",
                filter: "blur(4px)",
              }}
            />

            <motion.h1
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="relative z-10 text-5xl font-black text-white uppercase tracking-wide"
              style={{
                textShadow: "0 0 30px rgba(59,130,246,0.8)",
              }}
            >
              Your Starting Squad!
            </motion.h1>

            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="relative z-10 flex flex-wrap justify-center gap-6 max-w-6xl"
            >
              {cards?.slice(0, 5).map((card, i) => (
                <motion.div
                  key={card.id}
                  initial={{ opacity: 0, rotateY: 180, scale: 0 }}
                  animate={{ opacity: 1, rotateY: 0, scale: 1 }}
                  transition={{
                    delay: 0.6 + i * 0.2,
                    type: "spring",
                    stiffness: 100,
                  }}
                >
                  <Card3D card={card} size="lg" />
                </motion.div>
              ))}
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2.5 }}
              className="relative z-10 text-xl text-white/80"
            >
              Taking you to your dashboard...
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
