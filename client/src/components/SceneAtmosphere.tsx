import { memo, useEffect, useMemo, useState } from "react";
import { reserveSceneVideoSlot } from "../lib/scene-budget";

type SceneAtmosphereProps = {
  className?: string;
  variant?: "locker" | "cabinet" | "tunnel";
  videoSrc?: string;
  videoPoster?: string;
  fallbackImage?: string;
};

function SceneAtmosphereBase({ className, variant = "cabinet", videoSrc, videoPoster, fallbackImage }: SceneAtmosphereProps) {
  const [videoFailed, setVideoFailed] = useState(false);
  const [allowVideo, setAllowVideo] = useState(false);

  useEffect(() => {
    if (!videoSrc) {
      setAllowVideo(false);
      return;
    }

    const slot = reserveSceneVideoSlot();
    setAllowVideo(slot.allowed);
    return () => {
      slot.release();
    };
  }, [videoSrc]);

  const showVideo = useMemo(() => Boolean(videoSrc && allowVideo && !videoFailed), [videoSrc, allowVideo, videoFailed]);

  const tone =
    variant === "locker"
      ? "bg-[radial-gradient(1200px_600px_at_10%_0%,rgba(59,130,246,0.14),transparent_60%),radial-gradient(900px_520px_at_90%_15%,rgba(34,197,94,0.12),transparent_65%)]"
      : variant === "tunnel"
        ? "bg-[radial-gradient(1200px_600px_at_10%_0%,rgba(244,63,94,0.12),transparent_60%),radial-gradient(900px_500px_at_92%_12%,rgba(251,191,36,0.1),transparent_65%)]"
        : "bg-[radial-gradient(1200px_600px_at_8%_0%,rgba(14,165,233,0.12),transparent_60%),radial-gradient(900px_500px_at_92%_12%,rgba(251,191,36,0.1),transparent_65%)]";

  return (
    <div className={className || "absolute inset-0 pointer-events-none overflow-hidden"} aria-hidden>
      {showVideo ? (
        <video
          className="absolute inset-0 h-full w-full object-cover opacity-25"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={videoPoster}
          onError={() => setVideoFailed(true)}
        >
          <source src={videoSrc} type="video/mp4" />
        </video>
      ) : null}

      {(videoFailed || !showVideo) && fallbackImage ? (
        <img src={fallbackImage} alt="Scene background" className="absolute inset-0 h-full w-full object-cover opacity-25" />
      ) : null}

      <div className={`absolute inset-0 ${tone} bg-[linear-gradient(180deg,rgba(15,23,42,0.02),transparent_40%)]`} />

      <div className="absolute -left-24 top-12 h-64 w-64 rounded-full bg-cyan-300/10 blur-3xl" />
      <div className="absolute right-[-8rem] top-24 h-72 w-72 rounded-full bg-amber-300/10 blur-3xl" />

      <div className="atmo-particles absolute inset-0" />
    </div>
  );
}

const SceneAtmosphere = memo(SceneAtmosphereBase);

export default SceneAtmosphere;
