import React, { useEffect, useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  onUnlocked?: () => void;
  title?: string;
};

type Phase = "idle" | "unlocking" | "open";

export default function CardVaultUnlock({
  open,
  onClose,
  onUnlocked,
  title = "Card Vault",
}: Props) {
  const [phase, setPhase] = useState<Phase>("idle");

  useEffect(() => {
    if (!open) return;
    setPhase("idle");
  }, [open]);

  const unlock = () => {
    setPhase("unlocking");
    window.setTimeout(() => setPhase("open"), 1200);
    window.setTimeout(() => onUnlocked?.(), 1250);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[85]">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(1100px 700px at 50% 18%, rgba(120,160,255,0.10), transparent 62%)," +
            "linear-gradient(180deg, rgba(0,0,0,0.92), rgba(0,0,0,0.98))",
        }}
      />
      <div className="absolute left-1/2 top-6 w-[min(980px,92vw)] -translate-x-1/2 flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold text-white/90">{title}</div>
          <div className="text-sm text-white/55">Unlock your display cabinet to showcase your cards.</div>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white/70 backdrop-blur-md hover:bg-black/55"
        >
          Close
        </button>
      </div>

      <div className="absolute left-1/2 top-[54%] w-[min(980px,92vw)] -translate-x-1/2 -translate-y-1/2">
        <div className="relative rounded-3xl border border-white/10 bg-black/25 p-6 backdrop-blur-md overflow-hidden">
          <div className="relative mx-auto h-[420px] w-[min(700px,92%)]">
            <div className="absolute inset-0 rounded-[34px] border border-white/10 bg-gradient-to-b from-white/10 to-black/50 shadow-[0_40px_120px_rgba(0,0,0,0.75)]" />

            <div className={`absolute inset-4 rounded-[28px] border border-white/12 bg-black/40 vaultDoor ${phase}`}>
              <div className="absolute inset-0 rounded-[28px]"
                   style={{
                     background:
                       "radial-gradient(420px 220px at 40% 25%, rgba(120,160,255,0.16), transparent 70%)," +
                       "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(0,0,0,0.55))"
                   }}
              />

              <div className="absolute left-1/2 top-[56%] -translate-x-1/2 -translate-y-1/2">
                <div className="relative h-[110px] w-[180px] rounded-2xl border border-white/12 bg-black/40">
                  <div className="absolute left-4 top-3 text-[11px] tracking-widest text-white/60">SECURE LOCK</div>
                  <div className="absolute left-4 top-8 text-xs text-white/45">
                    {phase === "idle" ? "Press UNLOCK" : phase === "unlocking" ? "Authenticating..." : "Unlocked"}
                  </div>
                  <div className="absolute inset-x-4 bottom-3 h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full"
                      style={{
                        width: phase === "unlocking" ? "100%" : phase === "open" ? "100%" : "10%",
                        transition: "width 1.1s ease",
                        background: "linear-gradient(90deg, rgba(120,160,255,0.25), rgba(120,160,255,0.85))",
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="absolute inset-x-10 top-10 h-[1px] opacity-40"
                   style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)" }} />
              <div className="absolute inset-x-10 bottom-10 h-[1px] opacity-25"
                   style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.14), transparent)" }} />
            </div>

            <div className={`absolute inset-6 rounded-[28px] interiorGlow ${phase}`}>
              <div className="absolute inset-0 rounded-[28px]"
                   style={{
                     background:
                       "radial-gradient(600px 320px at 50% 45%, rgba(120,160,255,0.16), transparent 70%)," +
                       "radial-gradient(420px 240px at 50% 35%, rgba(255,255,255,0.10), transparent 70%)",
                     filter: "blur(0.6px)"
                   }}
              />
            </div>
          </div>

          <div className="mt-5 flex items-center justify-center gap-3">
            {phase === "idle" && (
              <button
                onClick={unlock}
                className="rounded-xl border border-white/12 bg-white/10 px-5 py-3 text-sm font-semibold text-white/85 hover:bg-white/15"
              >
                UNLOCK VAULT
              </button>
            )}
            {phase === "open" && (
              <button
                onClick={onClose}
                className="rounded-xl border border-white/12 bg-white/10 px-5 py-3 text-sm font-semibold text-white/85 hover:bg-white/15"
              >
                ENTER COLLECTION
              </button>
            )}
          </div>

          <div className="mt-2 text-center text-xs text-white/45">
            {phase === "idle"
              ? "Unlock once to access your cabinet."
              : phase === "unlocking"
                ? "Vault opening..."
                : "Vault unlocked."}
          </div>
        </div>
      </div>

      <style>{`
        .vaultDoor{
          transform-origin: left center;
          transition: transform 1.1s ease, opacity 0.6s ease;
          will-change: transform;
        }
        .vaultDoor.unlocking{
          transform: translate3d(0,0,0) rotateY(-12deg);
        }
        .vaultDoor.open{
          transform: translate3d(-10px,0,0) rotateY(-72deg);
          opacity: 0.92;
        }
        .interiorGlow{
          opacity: 0;
          transition: opacity 0.8s ease;
        }
        .interiorGlow.open{
          opacity: 1;
        }
      `}</style>
    </div>
  );
}
