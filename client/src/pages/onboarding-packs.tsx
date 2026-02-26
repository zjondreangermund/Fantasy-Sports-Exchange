
function OnboardingPacks() {
  const [packs, setPacks] = useState<Pack[]>([]);
  const [activePack, setActivePack] = useState<number | null>(null);
  const [openedPacks, setOpenedPacks] = useState<Record<number, boolean>>({});

  useEffect(() => {
    // Fetch tonight's players
    fetch("/api/epl/players?today=1")
      .then((res) => res.json())
      .then((players) => {
        // Split into packs of 3
        const packs: Pack[] = [];
        for (let i = 0; i < players.length; i += 3) {
          packs.push({
            title: `PACK ${packs.length + 1}`,
            cards: players.slice(i, i + 3).map((p: any) => ({
              id: p.id,
              playerId: p.id,
              ownerId: null,
              rarity: "common",
              serialId: null,
              serialNumber: null,
              maxSupply: 0,
              level: 1,
              xp: 0,
              decisiveScore: 35,
              last5Scores: [0, 0, 0, 0, 0],
              forSale: false,
              price: 0,
              acquiredAt: new Date() as any,
              player: p,
            })),
          });
        }
        setPacks(packs);
      });
  }, []);

  return (
    <div className="min-h-screen bg-[#070a10] text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold">Open Your Packs</h1>
          <p className="text-white/70">Open each pack to reveal 3 cards.</p>
        </div>

        {/* Pack table */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {packs.map((p, i) => {
            const opened = !!openedPacks[i];
            return (
              <motion.button
                key={i}
                onClick={() => setActivePack(i)}
                className="relative rounded-2xl border border-white/10 bg-white/5 p-6 text-left overflow-hidden"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-white/60">ONBOARDING</div>
                    <div className="text-xl font-black">{p.title}</div>
                  </div>
                  <div className={`text-xs font-bold ${opened ? "text-green-300" : "text-white/60"}`}>
                    {opened ? "OPENED" : "SEALED"}
                  </div>
                </div>

                {/* Fake “pack glow” */}
                <div className="mt-5 h-28 rounded-xl bg-gradient-to-br from-white/10 to-black/30 border border-white/10" />
              </motion.button>
            );
          })}
        </div>

        {/* Overlay animation modal */}
        <AnimatePresence>
          {activePack !== null && (
            <motion.div
              className="fixed inset-0 bg-black/70 flex items-center justify-center p-6 z-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActivePack(null)}
            >
              <motion.div
                className="w-full max-w-4xl rounded-3xl bg-[#0b0f1a] border border-white/10 p-6"
                initial={{ scale: 0.92, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.92, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-xs text-white/60">REVEAL</div>
                    <div className="text-2xl font-black">{packs[activePack].title}</div>
                  </div>

                  <button
                    className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15"
                    onClick={() => setActivePack(null)}
                  >
                    Close
                  </button>
                </div>

                {/* Pack opening animation */}
                <PackOpenAnimation
                  opened={!!openedPacks[activePack]}
                  onOpen={() =>
                    setOpenedPacks((prev) => ({ ...prev, [activePack]: true }))
                  }
                />

                {/* Cards reveal tray */}
                <div className="mt-6">
                  <div className="text-sm font-bold text-white/80 mb-3">Cards ({packs[activePack]?.cards.length || 0})</div>
                  <div className="flex flex-wrap gap-4">
                    {packs[activePack]?.cards.map((card, idx) => (
                      <PlayerCard key={card.id} card={card} size="md" />
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


function PackOpenAnimation({ opened, onOpen }: { opened: boolean; onOpen: () => void }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 overflow-hidden relative">
      {/* glow pulse */}
      <motion.div
        className="absolute -inset-24 bg-gradient-to-r from-purple-500/20 via-cyan-400/20 to-yellow-300/20"
        animate={{ rotate: opened ? 0 : 360 }}
        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
      />

      <div className="relative flex items-center justify-between">
        <div>
          <div className="text-xs text-white/60">PACK STATUS</div>
          <div className="text-lg font-black">{opened ? "OPENED" : "SEALED"}</div>
        </div>

        {!opened ? (
          <motion.button
            onClick={onOpen}
            className="px-4 py-2 rounded-xl bg-primary text-white font-extrabold"
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
          >
            Open Pack
          </motion.button>
        ) : (
          <div className="text-green-300 font-bold">✅ Revealed</div>
        )}
      </div>

      {/* pack flip */}
      <div className="mt-6 flex justify-center">
        <motion.div
          className="w-[220px] h-[300px] rounded-2xl border border-white/10 bg-gradient-to-b from-white/10 to-black/40"
          initial={false}
          animate={
            opened
              ? { rotateY: 180, scale: 1.04, filter: "brightness(1.2)" }
              : { rotateY: 0, scale: 1, filter: "brightness(1)" }
          }
          transition={{ type: "spring", stiffness: 120, damping: 16 }}
          style={{ transformStyle: "preserve-3d" }}
        />
      </div>
    </div>
  );

export default OnboardingPacks;
