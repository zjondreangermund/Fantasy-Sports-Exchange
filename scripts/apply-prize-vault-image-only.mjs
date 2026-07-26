#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const file = path.join(root, "client/src/pages/prize-vault.tsx");
let source = fs.readFileSync(file, "utf8");

if (source.includes("data-vault-image-card")) {
  console.log("Prize Vault image-only cards already applied.");
  process.exit(0);
}

const oldRail = `          <div className="relative rounded-[1.8rem] border border-white/10 p-3 sm:p-5" style={{ background: \`radial-gradient(circle at 50% 100%,\${theme[rarity].glow},transparent 58%),rgba(0,0,0,.28)\` }}>
            <button onClick={() => scroll(-1)} className="absolute left-3 top-1/2 z-30 hidden -translate-y-1/2 rounded-full border border-white/15 bg-black/80 p-3 xl:block"><ArrowLeft className="h-5 w-5" /></button>
            <div ref={rail} className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:flex xl:snap-x xl:overflow-x-auto xl:px-14 xl:pb-8 xl:pt-7">
              {cards.map((item, index) => <PrizeSlab key={item.id} item={item} index={index} total={cards.length} selected={selected?.id === item.id} onSelect={() => setSelectedId(item.id)} />)}
              {!cards.length && <Card className="border-white/10 bg-white/[.04] p-8 text-center text-white/45 sm:col-span-2">{isLoading ? "Loading vault…" : "No prizes available."}</Card>}
            </div>
            <button onClick={() => scroll(1)} className="absolute right-3 top-1/2 z-30 hidden -translate-y-1/2 rounded-full border border-white/15 bg-black/80 p-3 xl:block"><ArrowRight className="h-5 w-5" /></button>
          </div>`;

const newRail = `          <div className="relative">
            <button onClick={() => scroll(-1)} className="absolute -left-1 top-1/2 z-30 hidden -translate-y-1/2 rounded-full border border-white/15 bg-black/80 p-3 shadow-xl xl:block"><ArrowLeft className="h-5 w-5" /></button>
            <div ref={rail} className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:flex xl:snap-x xl:overflow-x-auto xl:px-12 xl:py-4">
              {cards.map((item, index) => <PrizeSlab key={item.id} item={item} index={index} total={cards.length} selected={selected?.id === item.id} onSelect={() => setSelectedId(item.id)} />)}
              {!cards.length && <Card className="border-white/10 bg-white/[.04] p-8 text-center text-white/45 sm:col-span-2">{isLoading ? "Loading vault…" : "No prizes available."}</Card>}
            </div>
            <button onClick={() => scroll(1)} className="absolute -right-1 top-1/2 z-30 hidden -translate-y-1/2 rounded-full border border-white/15 bg-black/80 p-3 shadow-xl xl:block"><ArrowRight className="h-5 w-5" /></button>
          </div>`;

if (!source.includes(oldRail)) throw new Error("Prize Vault rail wrapper block not found");
source = source.replace(oldRail, newRail);

const slabStart = source.indexOf("function PrizeSlab(");
const artStart = source.indexOf("function PrizeArt(");
if (slabStart < 0 || artStart < 0 || artStart <= slabStart) throw new Error("PrizeSlab boundaries not found");

const newSlab = `function PrizeSlab({ item, index, total, selected, onSelect }: { item: VaultItem; index: number; total: number; selected: boolean; onSelect: () => void }) {
  const t = theme[item.rarity] || theme.common;
  const progress = pct(item);
  const open = Boolean(item.currentPrize || item.unlocked);
  const remaining = Math.max(0, Number(item.targetEntries || item.requiredEntrants || 0) - Number(item.currentEntries || 0));

  return (
    <button
      type="button"
      onClick={onSelect}
      data-vault-image-card
      aria-label={\`View \${item.title} unlock details\`}
      className="group relative mx-auto aspect-[4/5] w-full max-w-[340px] overflow-hidden rounded-[1.6rem] text-left transition duration-300 hover:-translate-y-2 focus:outline-none focus-visible:ring-2 xl:min-w-[286px] xl:max-w-[286px] xl:snap-start"
      style={{
        boxShadow: selected ? \`0 0 0 2px \${t.accent},0 0 38px \${t.glow},0 24px 44px rgba(0,0,0,.58)\` : \`0 18px 38px rgba(0,0,0,.52),0 0 24px \${t.glow}\`,
        transitionDelay: \`\${Math.min(index, 8) * 25}ms\`,
      }}
    >
      <div className={\`absolute inset-0 transition duration-300 \${open ? "" : "brightness-[.68] saturate-[.78]"}\`}>
        <PrizeArt item={item} />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-black/95" />
      <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/20" />

      <div className="absolute inset-x-3 top-3 z-10 flex items-center justify-between gap-2">
        <span className="rounded-full border border-white/20 bg-black/65 px-2.5 py-1 text-[9px] font-black uppercase tracking-[.14em] backdrop-blur-md" style={{ color: t.accent }}>{item.rarity} prize</span>
        <span className="rounded-full border border-white/20 bg-black/65 px-2.5 py-1 text-[9px] font-black backdrop-blur-md">#{String(item.tierIndex).padStart(2, "0")} / {String(total).padStart(2, "0")}</span>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-10 p-4 pt-20">
        <h3 className="line-clamp-2 text-xl font-black leading-tight text-white drop-shadow-lg">{item.title}</h3>
        <div className="mt-1 text-xs font-bold text-white/70">Approx. value {money(item.value)}</div>

        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <VaultImageStat label="Entries" value={\`\${item.currentEntries}/\${item.targetEntries}\`} />
          <VaultImageStat label="Remaining" value={String(remaining)} />
          <VaultImageStat label="Status" value={open ? "Unlocked" : \`\${progress}%\`} />
        </div>

        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/15">
          <div className="h-full rounded-full transition-[width] duration-500" style={{ width: \`\${progress}%\`, background: open ? "#34d399" : t.accent, boxShadow: \`0 0 16px \${open ? "rgba(52,211,153,.62)" : t.glow}\` }} />
        </div>
        <div className="mt-2 flex items-center justify-between text-[10px] font-black uppercase tracking-[.08em]">
          <span className="text-white/60">Unlock progress</span>
          <span className="inline-flex items-center gap-1" style={{ color: open ? "#6ee7b7" : t.accent }}>
            {open ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
            {open ? "Unlocked" : \`Need \${remaining}\`}
          </span>
        </div>
      </div>
    </button>
  );
}

function VaultImageStat({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 rounded-lg bg-black/55 px-2 py-2 backdrop-blur-md"><div className="text-[8px] font-black uppercase tracking-[.11em] text-white/45">{label}</div><div className="mt-0.5 truncate text-[11px] font-black text-white">{value}</div></div>;
}

`;

source = source.slice(0, slabStart) + newSlab + source.slice(artStart);

const compactLockStart = source.indexOf("function CompactLock()");
const spotlightStart = source.indexOf("function Spotlight(");
if (compactLockStart >= 0 && spotlightStart > compactLockStart) {
  source = source.slice(0, compactLockStart) + source.slice(spotlightStart);
}

fs.writeFileSync(file, source);

for (const relative of [
  "client/src/main.tsx",
  "client/public/sw.js",
  "scripts/verify-card-data-integrity.mjs",
  "scripts/verify-unified-scroll-architecture.mjs",
]) {
  const target = path.join(root, relative);
  if (!fs.existsSync(target)) continue;
  const current = fs.readFileSync(target, "utf8");
  fs.writeFileSync(target, current.replaceAll("fantasy-site-v10", "fantasy-site-v11"));
}

console.log("Prize Vault wrapper blocks removed; image cards now carry unlock stats directly.");
