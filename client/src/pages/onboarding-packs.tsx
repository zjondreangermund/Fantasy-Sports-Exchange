import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import CardThumbnail from "../components/CardThumbnail";
import RevealFrame from "../components/RevealFrame";
import type { PlayerCardWithPlayer } from "../../../shared/schema";

type Pack = {
  title: string;
  subtitle: string;
  highlight: string;
  rarityMix: string[];
  cards: PlayerCardWithPlayer[];
};

const PACK_TITLES = [
  ["Kickoff Pack", "Likely starters tonight"],
  ["Derby Pack", "High-voltage matchups"],
  ["Captain Pack", "Strong form candidates"],
  ["Underdog Pack", "Sneaky upside picks"],
  ["Spotlight Pack", "Prime-time names"],
] as const;

const RARITY_ORDER = ["common", "rare", "epic", "legendary"] as const;

function getPackTint(index: number) {
  const tints = [
    "from-cyan-400/20 via-blue-500/10 to-transparent",
    "from-purple-400/20 via-fuchsia-500/10 to-transparent",
    "from-yellow-300/20 via-orange-500/10 to-transparent",
    "from-emerald-300/20 via-teal-500/10 to-transparent",
    "from-rose-300/20 via-pink-500/10 to-transparent",
  ];
  return tints[index % tints.length];
}

function rarityForPack(packIndex: number, cardIndex: number): "common" | "rare" | "epic" | "legendary" {
  if (packIndex === 0) return cardIndex === 2 ? "rare" : "common";
  if (packIndex === 1) return cardIndex === 1 ? "rare" : "common";
  if (packIndex === 2) return cardIndex === 2 ? "epic" : cardIndex === 1 ? "rare" : "common";
  if (packIndex === 3) return cardIndex === 2 ? "rare" : "common";
  return cardIndex === 2 ? "legendary" : cardIndex === 1 ? "epic" : "rare";
}

export default function OnboardingPacksScene() {
  const [packs, setPacks] = useState<Pack[]>([]);
  const [activePack, setActivePack] = useState<number | null>(null);
  const [openedPacks, setOpenedPacks] = useState<Record<number, boolean>>({});
  const openedCount = Object.values(openedPacks).filter(Boolean).length;

  useEffect(() => {
    fetch("/api/epl/players?today=1&limit=30")
      .then((res) => res.json())
      .then((payload) => {
        const players = Array.isArray(payload?.response) ? payload.response : Array.isArray(payload) ? payload : [];
        const nextPacks: Pack[] = [];
        for (let i = 0; i < players.length; i += 3) {
          const packIndex = nextPacks.length;
          const cards: PlayerCardWithPlayer[] = players.slice(i, i + 3).map((player: any, cardIndex: number) => {
            const rarity = rarityForPack(packIndex, cardIndex);
            return {
              id: Number(player.id) * 10 + cardIndex + 1,
              playerId: Number(player.id),
              ownerId: null,
              rarity,
              serialId: null,
              serialNumber: null,
              maxSupply: 0,
              level: 1,
              xp: 0,
              decisiveScore: rarity === "legendary" ? 70 : rarity === "epic" ? 55 : rarity === "rare" ? 42 : 35,
              last5Scores: [0, 0, 0, 0, 0],
              forSale: false,
              price: 0,
              acquiredAt: new Date() as any,
              player,
            } as PlayerCardWithPlayer;
          });
          if (cards.length < 3) continue;
          const [title, subtitle] = PACK_TITLES[packIndex % PACK_TITLES.length];
          const rarityMix = cards.map((card) => String(card.rarity));
          nextPacks.push({
            title,
            subtitle,
            highlight: rarityMix.includes("legendary") ? "Guaranteed headline pull" : rarityMix.includes("epic") ? "Boosted premium odds" : "Starter foundation",
            rarityMix,
            cards,
          });
          if (nextPacks.length === 5) break;
        }
        setPacks(nextPacks);
      })
      .catch((err) => {
        console.error("Failed to load players for packs:", err);
        setPacks([]);
      });
  }, []);

  const collectionPreview = useMemo(() => packs.flatMap((pack) => pack.cards).slice(0, 8), [packs]);

  return (
    <div className="min-h-screen bg-[#070a10] text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid xl:grid-cols-[1.3fr_0.7fr] gap-6 mb-8">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.12),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.12),transparent_38%)]" />
            <div className="relative z-10">
              <div className="text-xs uppercase tracking-[0.35em] text-white/50 mb-3">Starter Drop</div>
              <h1 className="text-4xl font-black leading-tight">Open your first packs and build instant rarity hype.</h1>
              <p className="text-white/70 mt-3 max-w-2xl">Each pack is pre-staged for a real reveal moment: commons to build lineups, rares to create momentum, and premium pulls to make the collection feel alive from day one.</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <StatChip label="Packs" value={`${packs.length || 0}`} />
                <StatChip label="Opened" value={`${openedCount}/${packs.length || 0}`} />
                <StatChip label="Premium Odds" value="Rare+ in every pack" />
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <div className="text-xs uppercase tracking-[0.35em] text-white/50 mb-3">Preview Tray</div>
            <div className="grid grid-cols-2 gap-3">
              {collectionPreview.map((card) => (
                <div key={card.id} className="rounded-2xl border border-white/10 bg-black/20 p-2">
                  <RevealFrame rarity={String(card.rarity)} reveal>
                    <CardThumbnail card={card} size="sm" />
                  </RevealFrame>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {packs.map((pack, index) => {
            const opened = !!openedPacks[index];
            const premium = pack.rarityMix.filter((rarity) => rarity !== "common").length;
            return (
              <motion.button
                key={index}
                onClick={() => setActivePack(index)}
                className="relative rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-left overflow-hidden"
                whileHover={{ scale: 1.015, y: -2 }}
                whileTap={{ scale: 0.99 }}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${getPackTint(index)}`} />
                <div className="relative z-10">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs text-white/60 uppercase tracking-[0.25em]">Pack {index + 1}</div>
                      <div className="text-2xl font-black leading-tight">{pack.title}</div>
                      <div className="text-sm text-white/65 mt-1">{pack.subtitle}</div>
                    </div>
                    <div className={`text-xs font-bold rounded-full px-3 py-1 border ${opened ? "text-emerald-300 border-emerald-400/30 bg-emerald-500/10" : "text-white/75 border-white/15 bg-white/5"}`}>{opened ? "OPENED" : "SEALED"}</div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {RARITY_ORDER.filter((rarity) => pack.rarityMix.includes(rarity)).map((rarity) => (
                      <span key={rarity} className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-white/75">{rarity}</span>
                    ))}
                  </div>

                  <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="text-sm font-semibold text-white/85">{pack.highlight}</div>
                    <div className="text-xs text-white/55 mt-1">{premium} premium pull{premium === 1 ? "" : "s"} staged in this reveal.</div>
                    <div className="mt-4 h-28 rounded-xl border border-white/10 bg-gradient-to-b from-white/10 to-black/40" />
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>

        <AnimatePresence>
          {activePack !== null && packs[activePack] && (
            <motion.div className="fixed inset-0 bg-black/75 flex items-center justify-center p-6 z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setActivePack(null)}>
              <motion.div className="w-full max-w-5xl rounded-3xl bg-[#0b0f1a] border border-white/10 p-6" initial={{ scale: 0.94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.94, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4 gap-3">
                  <div>
                    <div className="text-xs text-white/60 uppercase tracking-[0.25em]">Reveal Chamber</div>
                    <div className="text-3xl font-black">{packs[activePack].title}</div>
                    <div className="text-sm text-white/65 mt-1">{packs[activePack].subtitle}</div>
                  </div>
                  <button className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15" onClick={() => setActivePack(null)}>Close</button>
                </div>

                <PackOpenAnimation opened={!!openedPacks[activePack]} rarityMix={packs[activePack].rarityMix} onOpen={() => setOpenedPacks((prev) => ({ ...prev, [activePack]: true }))} />

                <div className="mt-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-bold text-white/80">Cards ({packs[activePack].cards.length})</div>
                    <div className="text-xs text-white/55">Premium pulls reveal with extra glow and depth.</div>
                  </div>
                  <div className="flex flex-wrap gap-4">
                    {packs[activePack].cards.map((card, index) => (
                      <motion.div key={card.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.08 }}>
                        <RevealFrame rarity={card.rarity} reveal={!!openedPacks[activePack]}>
                          <CardThumbnail card={card} size="md" />
                        </RevealFrame>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 min-w-[120px]">
      <div className="text-[11px] uppercase tracking-[0.25em] text-white/45">{label}</div>
      <div className="text-sm font-bold mt-1 text-white/90">{value}</div>
    </div>
  );
}

function PackOpenAnimation({ opened, rarityMix, onOpen }: { opened: boolean; rarityMix: string[]; onOpen: () => void }) {
  const premium = rarityMix.includes("legendary") ? "legendary" : rarityMix.includes("epic") ? "epic" : rarityMix.includes("rare") ? "rare" : "common";

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 overflow-hidden relative">
      <motion.div className="absolute -inset-20 bg-gradient-to-r from-cyan-500/15 via-purple-500/15 to-yellow-300/15" animate={{ rotate: opened ? 0 : 360 }} transition={{ duration: 10, repeat: Infinity, ease: "linear" }} />
      <div className="relative z-10 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs text-white/60 uppercase tracking-[0.25em]">Pack Status</div>
          <div className="text-lg font-black">{opened ? "OPENED" : "SEALED"}</div>
          <div className="text-sm text-white/60 mt-1">Premium pulse: {premium.toUpperCase()}</div>
        </div>
        {!opened ? (
          <motion.button onClick={onOpen} className="px-5 py-3 rounded-2xl bg-primary text-white font-extrabold" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
            Open Pack
          </motion.button>
        ) : (
          <div className="text-emerald-300 font-bold">✅ Reveal complete</div>
        )}
      </div>

      <div className="mt-6 flex justify-center">
        <motion.div
          className="w-[240px] h-[320px] rounded-[28px] border border-white/10 bg-gradient-to-b from-white/10 to-black/40 shadow-[0_25px_80px_rgba(0,0,0,0.45)]"
          initial={false}
          animate={opened ? { rotateY: 180, scale: 1.06, y: -6, filter: "brightness(1.22)" } : { rotateY: 0, scale: 1, y: 0, filter: "brightness(1)" }}
          transition={{ type: "spring", stiffness: 120, damping: 16 }}
          style={{ transformStyle: "preserve-3d" }}
        />
      </div>
    </div>
  );
}
