import React, { useEffect, useMemo, useState } from "react";
import type { Pack, PlayerLike } from "../../lib/starterPacks";
import RareDropLightningOverlay from "./RareDropLightningOverlay";

type Props = {
  open: boolean;
  onClose: () => void;
  packs: Pack[];
  renderCard: (p: PlayerLike) => React.ReactNode;
  onFinishPick5: (picked: PlayerLike[]) => void;
};

type Phase = "intro" | "pack" | "reveal3" | "pick5";

export default function WalkoutTunnelSignup({
  open,
  onClose,
  packs,
  renderCard,
  onFinishPick5,
}: Props) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [packIdx, setPackIdx] = useState(0);
  const [revealIdx, setRevealIdx] = useState(0);
  const [openedPackIds, setOpenedPackIds] = useState<Set<string>>(new Set());
  const [allRevealed, setAllRevealed] = useState<PlayerLike[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [lightning, setLightning] = useState<{ show: boolean; rarity: any }>({ show: false, rarity: "common" });

  useEffect(() => {
    if (!open) return;
    setPhase("intro");
    setPackIdx(0);
    setRevealIdx(0);
    setOpenedPackIds(new Set());
    setAllRevealed([]);
    setPicked(new Set());
  }, [open]);

  const currentPack = packs[packIdx];
  const currentCard = currentPack?.cards?.[revealIdx];

  useEffect(() => {
    if (!open) return;
    if (phase !== "reveal3") return;
    if (!currentCard) return;
    const rarity = (currentCard as any).rarity ?? "common";
    if (rarity !== "common") {
      setLightning({ show: true, rarity });
      const t = window.setTimeout(() => setLightning({ show: false, rarity }), 850);
      return () => window.clearTimeout(t);
    }
  }, [open, phase, currentCard]);

  const canOpenPack = phase === "intro" || phase === "pack";
  const doneAllPacks = openedPackIds.size === packs.length;

  const openPack = () => {
    if (!currentPack) return;
    setPhase("pack");
    window.setTimeout(() => setPhase("reveal3"), 900);
    setRevealIdx(0);
    setOpenedPackIds((s) => new Set(s).add(currentPack.id));
  };

  const nextReveal = () => {
    if (!currentPack) return;
    const card = currentPack.cards[revealIdx];
    if (card) setAllRevealed((arr) => [...arr, card]);

    if (revealIdx < 2) {
      setRevealIdx((i) => i + 1);
      return;
    }

    const nextPack = packIdx + 1;
    if (nextPack < packs.length) {
      setPackIdx(nextPack);
      setPhase("pack");
      setRevealIdx(0);
    } else {
      setPhase("pick5");
    }
  };

  const togglePick = (p: PlayerLike) => {
    const id = String(p.id);
    setPicked((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else {
        if (n.size >= 5) return n;
        n.add(id);
      }
      return n;
    });
  };

  const pickedList = useMemo(() => {
    const ids = picked;
    return allRevealed.filter((p) => ids.has(String(p.id)));
  }, [allRevealed, picked]);

  const finish = () => {
    if (pickedList.length !== 5) return;
    onFinishPick5(pickedList);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90]">
      <RareDropLightningOverlay open={lightning.show} rarity={lightning.rarity} />

      <div className="absolute inset-0 overflow-hidden" style={{ background: "#03050A" }}>
        <div
          className="absolute -inset-[20%]"
          style={{
            background:
              "radial-gradient(900px 420px at 50% 15%, rgba(140,180,255,0.12), transparent 62%)," +
              "linear-gradient(180deg, rgba(0,0,0,0.1), rgba(0,0,0,0.95) 68%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-90"
          style={{
            background:
              "linear-gradient(90deg, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.45) 18%, transparent 48%, transparent 52%, rgba(0,0,0,0.45) 82%, rgba(0,0,0,0.88) 100%)",
          }}
        />
        <div
          className="absolute left-1/2 top-[10%] h-[220px] w-[900px] -translate-x-1/2 opacity-85"
          style={{
            background:
              "radial-gradient(closest-side, rgba(255,255,255,0.18), transparent 70%)," +
              "radial-gradient(600px 200px at 50% 40%, rgba(120,160,255,0.14), transparent 70%)",
            filter: "blur(0.6px)",
          }}
        />
        <div
          className="absolute inset-x-0 bottom-0 top-[45%] opacity-80"
          style={{
            background:
              "radial-gradient(900px 420px at 50% 40%, rgba(255,255,255,0.08), transparent 62%)," +
              "linear-gradient(180deg, transparent, rgba(0,0,0,0.7) 55%, rgba(0,0,0,0.95) 100%)",
            filter: "blur(1px)",
          }}
        />
        <div className="absolute -inset-[35%] tunnelSweep opacity-25" />
      </div>

      <div className="absolute left-1/2 top-6 w-[min(1100px,92vw)] -translate-x-1/2">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold text-white/90">Walkout Tunnel Reveal</div>
            <div className="text-sm text-white/55">
              Open your 5 packs (15 players), then pick your best 5.
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white/70 backdrop-blur-md hover:bg-black/55"
          >
            Close
          </button>
        </div>

        <div className="mt-4 flex items-center gap-2">
          {packs.map((p, i) => (
            <div
              key={p.id}
              className="h-2 w-10 rounded-full transition-all"
              style={{
                background: openedPackIds.has(p.id)
                  ? "rgba(120,160,255,0.85)"
                  : i === packIdx && phase !== "pick5"
                    ? "rgba(255,255,255,0.22)"
                    : "rgba(255,255,255,0.10)",
                transform: i === packIdx ? "scaleX(1.08)" : "scaleX(1)",
              }}
              title={p.label}
            />
          ))}
          <div className="ml-2 text-xs text-white/50">
            {openedPackIds.size}/{packs.length} packs opened
          </div>
        </div>
      </div>

      <div className="absolute left-1/2 top-[56%] w-[min(1100px,92vw)] -translate-x-1/2 -translate-y-1/2">
        <div className="relative mx-auto rounded-3xl border border-white/10 bg-black/25 p-5 backdrop-blur-md">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm text-white/70">
                {phase === "pick5" ? "Choose your best 5" : currentPack?.label}
              </div>
              <div className="text-xs text-white/45">
                {phase === "pick5"
                  ? `Selected ${picked.size}/5`
                  : phase === "reveal3"
                    ? `Reveal ${revealIdx + 1}/3`
                    : "The pack walks out into the light..."}
              </div>
            </div>

            {phase !== "pick5" ? (
              <button
                onClick={() => {
                  if (phase === "intro" || phase === "pack") openPack();
                }}
                disabled={!canOpenPack}
                className="rounded-xl border border-white/12 bg-white/10 px-4 py-2 text-sm font-semibold text-white/85 hover:bg-white/15 disabled:opacity-60"
              >
                OPEN PACK
              </button>
            ) : (
              <button
                onClick={finish}
                disabled={pickedList.length !== 5}
                className="rounded-xl border border-white/12 bg-white/10 px-4 py-2 text-sm font-semibold text-white/85 hover:bg-white/15 disabled:opacity-60"
              >
                Confirm Best 5
              </button>
            )}
          </div>

          {phase !== "pick5" && (
            <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/30 p-5">
                <div className="text-xs text-white/55">Tunnel Walkout</div>

                <div className="relative mt-4 h-[320px]">
                  <div className="absolute left-1/2 top-[12%] h-[120px] w-[420px] -translate-x-1/2 opacity-70"
                       style={{ background: "radial-gradient(closest-side, rgba(255,255,255,0.14), transparent 70%)" }} />

                  <div className={`absolute left-1/2 top-[48%] -translate-x-1/2 -translate-y-1/2 ${phase === "pack" ? "packWalk" : ""}`}>
                    <div
                      className="relative h-[240px] w-[190px] rounded-3xl border border-white/12 bg-gradient-to-b from-white/10 to-black/40 shadow-[0_30px_90px_rgba(0,0,0,0.65)]"
                    >
                      <div
                        className="absolute inset-0 rounded-3xl"
                        style={{
                          background:
                            "radial-gradient(260px 160px at 40% 30%, rgba(120,160,255,0.22), transparent 62%)," +
                            "radial-gradient(240px 140px at 70% 60%, rgba(255,255,255,0.12), transparent 60%)",
                        }}
                      />
                      <div className="absolute left-1/2 top-6 -translate-x-1/2 text-[11px] tracking-widest text-white/70">
                        STARTER PACK
                      </div>
                      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                        <div className="text-3xl font-bold text-white/90">★</div>
                        <div className="mt-2 text-sm text-white/60">3 Cards</div>
                      </div>
                      <div
                        className="absolute inset-x-4 bottom-5 h-[1px] opacity-60"
                        style={{
                          background:
                            "linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent)",
                        }}
                      />
                    </div>
                  </div>

                  <div className="absolute inset-x-0 bottom-0 text-center text-xs text-white/45">
                    {phase === "intro" ? "Tap OPEN PACK to start the walkout." : "Pack approaches the light..."}
                  </div>
                </div>
              </div>

              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/30 p-5">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-white/55">Card Reveal</div>
                  {phase === "reveal3" && (
                    <button
                      onClick={nextReveal}
                      className="rounded-lg border border-white/12 bg-white/10 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/15"
                    >
                      {revealIdx < 2 ? "Next Card" : "Finish Pack"}
                    </button>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-center">
                  {phase === "reveal3" && currentCard ? (
                    <div className="relative">
                      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[360px] w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-70"
                           style={{ background: "radial-gradient(closest-side, rgba(120,160,255,0.16), transparent 70%)", filter: "blur(18px)" }} />
                      <div className="revealPop">
                        {renderCard(currentCard)}
                      </div>
                      <div className="pointer-events-none mt-4 opacity-10"
                           style={{
                             transform: "scaleY(-1)",
                             filter: "blur(7px)",
                             maskImage: "linear-gradient(to bottom, rgba(0,0,0,0.9), rgba(0,0,0,0.0) 72%)",
                             WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,0.9), rgba(0,0,0,0.0) 72%)",
                           }}>
                        {renderCard(currentCard)}
                      </div>
                    </div>
                  ) : (
                    <div className="h-[360px] w-full rounded-2xl border border-white/10 bg-black/20" />
                  )}
                </div>

                <div className="mt-2 text-center text-xs text-white/45">
                  {phase === "reveal3" ? "Tap Next to reveal all 3 cards." : "Open a pack to start revealing."}
                </div>
              </div>
            </div>
          )}

          {phase === "pick5" && (
            <div className="mt-5">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
                {allRevealed.map((p) => {
                  const id = String(p.id);
                  const active = picked.has(id);
                  return (
                    <button
                      key={id}
                      onClick={() => togglePick(p)}
                      className="relative rounded-2xl border border-white/10 bg-black/25 p-2 text-left transition-transform hover:scale-[1.01]"
                    >
                      <div className="relative">
                        {renderCard(p)}
                        {active && (
                          <div className="absolute inset-0 rounded-2xl ring-2 ring-[rgba(120,160,255,0.85)]" />
                        )}
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs text-white/55">
                        <span>{(p as any).position}</span>
                        <span>{active ? "Selected" : "Select"}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 text-xs text-white/50">
                Selected: <span className="text-white/80">{picked.size}/5</span> • Choose your best 5 to continue.
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .tunnelSweep{
          background:
            radial-gradient(320px 900px at 35% 0%, rgba(200,220,255,0.10), transparent 72%),
            radial-gradient(280px 860px at 70% 0%, rgba(200,220,255,0.08), transparent 72%);
          transform: rotate(-10deg);
          filter: blur(1.1px);
          animation: sweepMove 5.8s ease-in-out infinite;
        }
        @keyframes sweepMove{
          0%,100%{ transform: translate3d(-18px,0,0) rotate(-10deg); opacity: .22; }
          50%{ transform: translate3d(18px,0,0) rotate(-10deg); opacity: .34; }
        }
        .packWalk{
          animation: packWalk 0.9s ease-out both;
        }
        @keyframes packWalk{
          0%{ transform: translate3d(-50%, -50%, 0) scale(.92); filter: blur(1px); opacity: .7; }
          60%{ transform: translate3d(-50%, -50%, 0) scale(1.02); filter: blur(0px); opacity: 1; }
          100%{ transform: translate3d(-50%, -50%, 0) scale(1); opacity: 1; }
        }
        .revealPop{
          animation: revealPop 0.55s cubic-bezier(.2,.9,.2,1) both;
        }
        @keyframes revealPop{
          0%{ transform: translate3d(0,12px,0) scale(.96); opacity: 0; }
          100%{ transform: translate3d(0,0,0) scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
