import { useEffect, useRef, useState } from "react";

interface CinematicBackgroundProps {
  /** Whether to show the video background */
  show?: boolean;
  /** Opacity of the dark overlay (0-1) */
  overlayOpacity?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Cinematic video background component
 * Automatically chooses 16:9 or 9:16 video based on screen orientation
 */
export default function CinematicBackground({
  show = true,
  overlayOpacity = 0.4,
  className = "",
}: CinematicBackgroundProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [videoError, setVideoError] = useState(false);

  useEffect(() => {
    // Detect mobile/portrait orientation
    const checkOrientation = () => {
      const isPortrait = window.innerHeight > window.innerWidth;
      const isMobileDevice = window.innerWidth < 768;
      setIsMobile(isPortrait && isMobileDevice);
    };

    checkOrientation();
    window.addEventListener("resize", checkOrientation);
    return () => window.removeEventListener("resize", checkOrientation);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Attempt to play video (may fail on some browsers without user interaction)
    const playVideo = async () => {
      try {
        await video.play();
      } catch (error) {
        console.log("Video autoplay blocked, will play after user interaction");
      }
    };

    if (show) {
      playVideo();
    }
  }, [show, isMobile]);

  const handleVideoError = () => {
    console.warn("Video failed to load, falling back to gradient background");
    setVideoError(true);
  };

  // Determine which video to use
  const videoSrc = isMobile ? "/cinematics/tunnel_9x16.mp4" : "/cinematics/tunnel_16x9.mp4";
  const posterSrc = "/cinematics/tunnel.png";

  if (!show) return null;

  return (
    <div className={`fixed inset-0 z-0 overflow-hidden ${className}`}>
      {/* Video Background */}
      {!videoError ? (
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          poster={posterSrc}
          onError={handleVideoError}
        >
          <source src={videoSrc} type="video/mp4" />
        </video>
      ) : (
        /* Fallback gradient if video fails */
        <div className="absolute inset-0 bg-gradient-to-b from-black via-zinc-900 to-black" />
      )}

      {/* Dark overlay for readability */}
      <div
        className="absolute inset-0 bg-black transition-opacity duration-1000"
        style={{ opacity: overlayOpacity }}
      />

      {/* Vignette effect */}
      <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-black opacity-60" />
    </div>
  );
}
