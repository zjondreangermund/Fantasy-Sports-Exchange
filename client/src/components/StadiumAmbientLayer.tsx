import { useEffect, useRef, useState } from "react";

type StadiumAmbientLayerProps = {
  teamName: string;
};

export default function StadiumAmbientLayer({ teamName }: StadiumAmbientLayerProps) {
  const [flash, setFlash] = useState(false);
  const [muted, setMuted] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const audio = new Audio("/audio/gaming-ambient-loop.mp3");
    audio.loop = true;
    audio.volume = 0;
    audio.muted = true;
    audioRef.current = audio;
    audio.play().catch(() => undefined);

    return () => {
      if (fadeTimerRef.current) {
        window.clearInterval(fadeTimerRef.current);
        fadeTimerRef.current = null;
      }
      audio.pause();
      audio.currentTime = 0;
      audioRef.current = null;
    };
  }, []);

  const fadeInAudio = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (fadeTimerRef.current) {
      window.clearInterval(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }

    const targetVolume = 0.18;
    const step = targetVolume / 18;
    audio.volume = 0;

    fadeTimerRef.current = window.setInterval(() => {
      if (!audioRef.current) return;
      const next = Math.min(targetVolume, Number((audio.volume + step).toFixed(3)));
      audio.volume = next;

      if (next >= targetVolume && fadeTimerRef.current) {
        window.clearInterval(fadeTimerRef.current);
        fadeTimerRef.current = null;
      }
    }, 120);
  };

  const toggleAudio = async () => {
    if (!audioRef.current) return;

    const nextMuted = !muted;
    audioRef.current.muted = nextMuted;
    setMuted(nextMuted);

    if (!nextMuted) {
      try {
        await audioRef.current.play();
      } catch {
        return;
      }
      fadeInAudio();
    }
  };

  useEffect(() => {
    const id = window.setInterval(() => {
      setFlash(true);
      window.setTimeout(() => setFlash(false), 180);
    }, 10000 + Math.random() * 7000);

    return () => window.clearInterval(id);
  }, []);

  return (
    <>
      <div className="absolute right-4 top-4 z-20 pointer-events-auto">
        <button
          type="button"
          onClick={toggleAudio}
          className="rounded-full border border-white/20 bg-black/50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/90 backdrop-blur-sm transition hover:bg-black/65"
        >
          {muted ? "Unmute Theme" : "Mute Theme"}
        </button>
      </div>

      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          backgroundImage:
            "linear-gradient(to bottom, rgba(15, 23, 42, 0.82), rgba(15, 23, 42, 0.95)), url(https://images.unsplash.com/photo-1522778119026-d647f0596c20?q=80&w=2000)",
          backgroundSize: "cover",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center center",
          opacity: 0.45,
        }}
      />

      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -left-24 top-0 h-full w-56 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[stadium-beam_16s_linear_infinite]" />
        <div className="absolute -right-24 top-0 h-full w-56 bg-gradient-to-l from-transparent via-white/10 to-transparent animate-[stadium-beam-reverse_20s_linear_infinite]" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/20 to-black/40" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-slate-900/40 to-transparent animate-[fog-drift_18s_ease-in-out_infinite]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(148,163,184,0.22),transparent_60%)]" />
      </div>

      {flash && <div className="absolute inset-0 z-0 pointer-events-none bg-white/10 animate-pulse" />}

      <div
        className="absolute inset-x-0 top-1/2 -translate-y-1/2 pointer-events-none z-0 text-center"
        style={{ opacity: 0.08 }}
      >
        <div
          style={{
            fontSize: "clamp(3rem, 12vw, 10rem)",
            fontWeight: 900,
            color: "white",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            lineHeight: 1,
            textShadow: "0 0 60px rgba(255,255,255,0.5)",
          }}
        >
          {teamName}
        </div>
      </div>

      <style>{`
        @keyframes stadium-beam {
          0% { transform: translateX(-140%) rotate(-6deg); opacity: 0.14; }
          50% { opacity: 0.28; }
          100% { transform: translateX(140%) rotate(-4deg); opacity: 0.1; }
        }
        @keyframes stadium-beam-reverse {
          0% { transform: translateX(140%) rotate(6deg); opacity: 0.12; }
          50% { opacity: 0.24; }
          100% { transform: translateX(-140%) rotate(4deg); opacity: 0.1; }
        }
        @keyframes fog-drift {
          0% { transform: translateX(-1.5%) translateY(0); opacity: 0.4; }
          50% { transform: translateX(1.5%) translateY(-2%); opacity: 0.55; }
          100% { transform: translateX(-1.5%) translateY(0); opacity: 0.4; }
        }
      `}</style>
    </>
  );
}
