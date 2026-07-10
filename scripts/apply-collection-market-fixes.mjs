import fs from "node:fs";

function patchFile(path, replacements) {
  let text = fs.readFileSync(path, "utf8");
  for (const [from, to] of replacements) {
    if (!text.includes(from)) {
      throw new Error(`Expected source text not found in ${path}: ${from.slice(0, 120)}`);
    }
    text = text.replace(from, to);
  }
  fs.writeFileSync(path, text);
}

patchFile("client/src/components/cards/CardProfileModal.tsx", [
  [
    'function money(value?: number | null) {\n  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "—";\n  return `£${Number(value).toFixed(1)}m`;\n}',
    'function money(value?: number | null) {\n  if (value === null || value === undefined || !Number.isFinite(Number(value)) || Number(value) <= 0) return "Not sold yet";\n  return `N$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;\n}'
  ],
  [
    '<HeroStat icon={<Zap className="h-4 w-4" />} label="FPL Value" value={money(data.stats.value)} />',
    '<HeroStat icon={<Zap className="h-4 w-4" />} label="Last Arena Sale" value={money(data.stats.value)} />'
  ],
]);

patchFile("server/routes/cards.routes.ts", [
  ['import { desc, sql } from "drizzle-orm";', 'import { and, desc, eq, sql } from "drizzle-orm";'],
  ['import { auditLogs } from "../../shared/schema.js";', 'import { auditLogs, transactions } from "../../shared/schema.js";'],
  [
    '      const player = card.player || {};\n      const bootstrap = await fplApi.bootstrap();',
    '      const player = card.player || {};\n      const [lastSaleTransaction] = await db\n        .select({ grossAmount: transactions.grossAmount, amount: transactions.amount })\n        .from(transactions)\n        .where(and(eq(transactions.type, "sale" as any), sql`${transactions.description} ilike ${`%card:${cardId}%`}`))\n        .orderBy(desc(transactions.createdAt))\n        .limit(1);\n      const lastSaleValue = Number(lastSaleTransaction?.grossAmount || lastSaleTransaction?.amount || 0) || null;\n      const bootstrap = await fplApi.bootstrap();'
  ],
  [
    'stats: { matchesPlayed: 0, minutes: 0, goals: 0, assists: 0, cleanSheets: 0, yellowCards: 0, redCards: 0, totalPoints: Number(card.totalPoints || 0), selectedBy: null, value: null }',
    'stats: { matchesPlayed: 0, minutes: 0, goals: 0, assists: 0, cleanSheets: 0, yellowCards: 0, redCards: 0, totalPoints: Number(card.totalPoints || 0), selectedBy: null, value: lastSaleValue }'
  ],
  [
    'value: Number(matchedElement.now_cost || 0) / 10',
    'value: lastSaleValue'
  ],
]);

patchFile("server/routes/prizeVault.routes.ts", [
  [
    '        const previous = activeByRarity.get(rarity);\n        if (!previous || Number(row.gameWeek || 0) < Number(previous.gameWeek || 999)) activeByRarity.set(rarity, row);',
    '        const previous = activeByRarity.get(rarity);\n        const rowGameWeek = Number(row.gameWeek || 0);\n        const previousGameWeek = Number(previous?.gameWeek || -1);\n        const rowEntries = Number(row.entryCount || 0);\n        const previousEntries = Number(previous?.entryCount || 0);\n        if (!previous || rowGameWeek > previousGameWeek || (rowGameWeek === previousGameWeek && rowEntries > previousEntries)) activeByRarity.set(rarity, row);'
  ],
]);

patchFile("client/src/pages/collection-clean.tsx", [
  [
    'import { Archive, ChevronLeft, ChevronRight, Crown, DollarSign, Gem, Search, ShieldCheck, Sparkles, Trophy, X } from "lucide-react";',
    'import { Archive, ChevronLeft, ChevronRight, Crown, DollarSign, Gem, Handshake, Search, ShieldCheck, Sparkles, Trophy, X } from "lucide-react";'
  ],
  [
    '<button onClick={() => openSellModal(card)} disabled={listMutation.isPending} className="h-9 w-full rounded-2xl border border-emerald-200/70 bg-gradient-to-r from-emerald-300 via-lime-200 to-amber-200 px-3 text-[11px] font-black uppercase tracking-[.1em] text-black shadow-[0_0_22px_rgba(52,211,153,.35)]"><DollarSign className="mr-1 inline h-3 w-3" /> Sell</button>',
    '<div className="grid w-full grid-cols-2 gap-2"><button onClick={() => openSellModal(card)} disabled={listMutation.isPending} className="h-9 rounded-2xl border border-emerald-200/70 bg-gradient-to-r from-emerald-300 via-lime-200 to-amber-200 px-2 text-[11px] font-black uppercase tracking-[.08em] text-black shadow-[0_0_22px_rgba(52,211,153,.35)]"><DollarSign className="mr-1 inline h-3 w-3" /> Sell</button><button onClick={() => { window.location.href = `/marketplace?mode=loan&cardId=${card.id}`; }} className="h-9 rounded-2xl border border-cyan-200/70 bg-gradient-to-r from-cyan-300 via-sky-200 to-blue-300 px-2 text-[11px] font-black uppercase tracking-[.08em] text-slate-950 shadow-[0_0_22px_rgba(34,211,238,.32)]"><Handshake className="mr-1 inline h-3 w-3" /> Loan</button></div>'
  ],
]);

patchFile("client/src/components/marketplace/LoanMarketPanel.tsx", [
  ['import { useMemo, useState } from "react";', 'import { useEffect, useMemo, useState } from "react";'],
  [
    '  const [selectedCardId, setSelectedCardId] = useState<number>(loanableCards[0]?.id || 0);\n  const selectedCard = loanableCards.find((card) => card.id === selectedCardId) || loanableCards[0];',
    '  const requestedCardId = useMemo(() => {\n    if (typeof window === "undefined") return 0;\n    const value = Number(new URLSearchParams(window.location.search).get("cardId") || 0);\n    return Number.isInteger(value) && value > 0 ? value : 0;\n  }, []);\n  const [selectedCardId, setSelectedCardId] = useState<number>(requestedCardId || loanableCards[0]?.id || 0);\n  const selectedCard = loanableCards.find((card) => card.id === selectedCardId) || loanableCards[0];\n  useEffect(() => {\n    if (requestedCardId && loanableCards.some((card) => card.id === requestedCardId)) {\n      setSelectedCardId(requestedCardId);\n    } else if (!selectedCardId && loanableCards[0]?.id) {\n      setSelectedCardId(loanableCards[0].id);\n    }\n  }, [loanableCards, requestedCardId, selectedCardId]);'
  ],
]);

console.log("Applied collection, marketplace value, loan button and Prize Vault fixes.");
