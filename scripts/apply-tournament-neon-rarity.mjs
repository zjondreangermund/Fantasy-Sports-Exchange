import fs from "node:fs";

const file = "client/src/pages/competitions-vault.tsx";
let source = fs.readFileSync(file, "utf8");

function replaceOnce(from, to, label) {
  if (source.includes(to)) return;
  if (!source.includes(from)) throw new Error(`[tournament-neon] ${label} anchor not found`);
  source = source.replace(from, to);
  console.log(`[tournament-neon] ${label}`);
}

function replaceAll(from, to, label) {
  const count = source.split(from).length - 1;
  if (!count) {
    if (source.includes(to)) return;
    throw new Error(`[tournament-neon] ${label} anchor not found`);
  }
  source = source.split(from).join(to);
  console.log(`[tournament-neon] ${label} (${count})`);
}

const oldTheme = `const rarityTheme: Record<TournamentRarity, { accent: string; glow: string; gradient: string }> = {
  common: { accent: "#60a5fa", glow: "rgba(59,130,246,.45)", gradient: "from-blue-500/25 via-slate-900/70 to-black" },
  rare: { accent: "#168cff", glow: "rgba(22,140,255,.48)", gradient: "from-blue-500/25 via-slate-900/70 to-black" },
  unique: { accent: "#c084fc", glow: "rgba(168,85,247,.5)", gradient: "from-purple-500/30 via-slate-900/70 to-black" },
  epic: { accent: "#fb3b4a", glow: "rgba(251,59,74,.5)", gradient: "from-rose-500/30 via-slate-900/70 to-black" },
  legendary: { accent: "#f59e0b", glow: "rgba(245,158,11,.5)", gradient: "from-amber-500/30 via-slate-900/70 to-black" },
};`;
const newTheme = `const rarityTheme: Record<TournamentRarity, { accent: string; secondary: string; glow: string; surface: string; buttonText: string }> = {
  common: { accent: "#72f7ff", secondary: "#93c5fd", glow: "rgba(34,211,238,.72)", surface: "rgba(34,211,238,.10)", buttonText: "#031116" },
  rare: { accent: "#00a8ff", secondary: "#2563eb", glow: "rgba(0,168,255,.78)", surface: "rgba(0,168,255,.11)", buttonText: "#ffffff" },
  unique: { accent: "#e03cff", secondary: "#8b5cf6", glow: "rgba(224,60,255,.78)", surface: "rgba(224,60,255,.11)", buttonText: "#ffffff" },
  epic: { accent: "#ff315f", secondary: "#dc2626", glow: "rgba(255,49,95,.80)", surface: "rgba(255,49,95,.11)", buttonText: "#ffffff" },
  legendary: { accent: "#ffd60a", secondary: "#ff8a00", glow: "rgba(255,214,10,.82)", surface: "rgba(255,214,10,.11)", buttonText: "#1a1200" },
};`;
replaceOnce(oldTheme, newTheme, "upgraded rarity palette");

const oldSelector = `className="min-h-[100px] min-w-0 rounded-2xl border px-4 py-3 text-left" style={{ borderColor: activeRarity === rarity ? t.accent : "rgba(255,255,255,.1)", background: activeRarity === rarity ? \`\${t.accent}18\` : "rgba(0,0,0,.22)", boxShadow: activeRarity === rarity ? \`0 0 28px \${t.glow}\` : undefined }}`;
const newSelector = `data-rarity-neon="selector-v2" className="min-h-[100px] min-w-0 rounded-2xl border px-4 py-3 text-left transition duration-200" style={{ borderColor: activeRarity === rarity ? t.accent : \`\${t.accent}42\`, background: activeRarity === rarity ? \`radial-gradient(circle at 88% 0%, \${t.accent}42 0%, transparent 44%), linear-gradient(145deg, \${t.secondary}28 0%, rgba(2,6,23,.92) 58%, #020309 100%)\` : \`linear-gradient(145deg, \${t.accent}12 0%, rgba(2,6,23,.78) 62%, #020309 100%)\`, boxShadow: activeRarity === rarity ? \`0 0 0 1px \${t.accent}30, 0 0 34px \${t.glow}, inset 0 1px 0 rgba(255,255,255,.10)\` : \`0 0 14px \${t.accent}18, inset 0 1px 0 rgba(255,255,255,.05)\`, transform: activeRarity === rarity ? "translateY(-2px)" : "translateY(0)" }}`;
replaceOnce(oldSelector, newSelector, "brightened rarity selector tiles");

const oldCard = `return <Card className={\`relative overflow-hidden rounded-[2rem] border bg-gradient-to-br \${t.gradient} p-5 text-white\`} style={{ borderColor: \`\${t.accent}55\`, boxShadow: \`0 0 35px \${t.glow},0 24px 60px rgba(0,0,0,.45)\` }}><div className="absolute inset-0 bg-[linear-gradient(120deg,transparent_0%,rgba(255,255,255,.12)_18%,transparent_38%)]" />`;
const newCard = `return <Card data-rarity-neon="card-v2" className="relative isolate overflow-hidden rounded-[2rem] border p-5 text-white" style={{ borderColor: \`\${t.accent}9a\`, background: \`radial-gradient(circle at 88% -8%, \${t.accent}40 0%, transparent 38%), radial-gradient(circle at -8% 105%, \${t.secondary}26 0%, transparent 42%), linear-gradient(145deg,#070b17 0%,#040713 52%,#020309 100%)\`, boxShadow: \`0 0 0 1px \${t.accent}22, 0 0 44px \${t.glow}, 0 24px 60px rgba(0,0,0,.48)\` }}><div className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: \`linear-gradient(90deg,transparent,\${t.accent},transparent)\`, boxShadow: \`0 0 24px \${t.glow}\` }} /><div className="pointer-events-none absolute -right-14 -top-14 h-40 w-40 rounded-full blur-3xl" style={{ background: \`\${t.accent}38\` }} /><div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,transparent_0%,rgba(255,255,255,.10)_18%,transparent_38%)] opacity-60" />`;
replaceOnce(oldCard, newCard, "added neon tournament card shell");

replaceOnce(
  `<Badge className="capitalize" style={{ background: \`\${t.accent}22\`, color: t.accent }}>{status}</Badge>`,
  `<Badge className="capitalize" style={{ background: \`linear-gradient(135deg,\${t.secondary}38,\${t.accent}24)\`, color: t.accent, border: \`1px solid \${t.accent}66\`, boxShadow: \`0 0 16px \${t.glow}\` }}>{status}</Badge>`,
  "made status badge rarity-neon",
);

replaceOnce(
  `<div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3"><div className="text-[9px] font-black uppercase tracking-[.15em] text-white/40">Cards required</div><div className="mt-1 text-sm font-black" style={{ color: t.accent }}>{requirement.shortLabel}</div></div>`,
  `<div className="mt-3 rounded-xl border p-3" style={{ borderColor: \`\${t.accent}55\`, background: t.surface, boxShadow: \`inset 0 0 22px \${t.accent}12, 0 0 18px \${t.accent}12\` }}><div className="text-[9px] font-black uppercase tracking-[.15em] text-white/45">Cards required</div><div className="mt-1 text-sm font-black" style={{ color: t.accent, textShadow: \`0 0 14px \${t.glow}\` }}>{requirement.shortLabel}</div></div>`,
  "lit cards-required panel",
);

replaceOnce(
  `<div className="h-full rounded-full" style={{ width: \`\${capacityProgress}%\`, background: t.accent, boxShadow: \`0 0 18px \${t.glow}\` }} />`,
  `<div className="h-full rounded-full" style={{ width: \`\${capacityProgress}%\`, background: \`linear-gradient(90deg,\${t.secondary},\${t.accent})\`, boxShadow: \`0 0 22px \${t.glow}\` }} />`,
  "upgraded Free Cup neon progress",
);
replaceOnce(
  `<div className="h-full rounded-full" style={{ width: \`\${vaultProgress}%\`, background: t.accent, boxShadow: \`0 0 18px \${t.glow}\` }} />`,
  `<div className="h-full rounded-full" style={{ width: \`\${vaultProgress}%\`, background: \`linear-gradient(90deg,\${t.secondary},\${t.accent})\`, boxShadow: \`0 0 22px \${t.glow}\` }} />`,
  "upgraded Prize Vault neon progress",
);

replaceOnce(
  `<Button variant="outline" className="w-full border-white/15 bg-black/20 text-white"><Gift className="mr-2 h-4 w-4" />Prize ladder</Button>`,
  `<Button variant="outline" className="w-full bg-black/25 text-white" style={{ borderColor: \`\${t.accent}55\`, boxShadow: \`inset 0 0 16px \${t.accent}10\` }}><Gift className="mr-2 h-4 w-4" style={{ color: t.accent }} />Prize ladder</Button>`,
  "tinted prize ladder control",
);

replaceAll(
  `style={{ background: canEnter ? t.accent : "#334155", color: r === "legendary" && canEnter ? "#111827" : "white" }}`,
  `style={{ background: canEnter ? \`linear-gradient(135deg,\${t.secondary},\${t.accent})\` : "#334155", color: canEnter ? t.buttonText : "#cbd5e1", border: canEnter ? \`1px solid \${t.accent}\` : "1px solid #475569", boxShadow: canEnter ? \`0 0 24px \${t.glow}\` : "none", textShadow: canEnter && t.buttonText === "#ffffff" ? "0 1px 5px rgba(0,0,0,.55)" : "none" }}`,
  "made all entry CTAs rarity-neon",
);

fs.writeFileSync(file, source);
console.log("Tournament rarity neon polish ready.");
