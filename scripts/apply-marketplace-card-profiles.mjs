#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const write = (file, content) => fs.writeFileSync(path.join(root, file), content);

function replaceText(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`Missing source for ${label}`);
  return source.replace(from, to);
}

function replaceRegex(source, pattern, to, label) {
  if (typeof to === "string" && source.includes(to)) return source;
  if (!pattern.test(source)) throw new Error(`Missing source for ${label}`);
  pattern.lastIndex = 0;
  return source.replace(pattern, to);
}

function patch(file, transform) {
  const source = read(file);
  const output = transform(source);
  if (output !== source) {
    write(file, output);
    console.log(`Updated ${file}`);
  } else {
    console.log(`Already updated ${file}`);
  }
}

patch("client/src/components/cards/types.ts", (source) => replaceText(
  source,
  "  totalPoints?: number;\n  status?: \"active\" | \"legacy\" | \"uncovered_league\";",
  "  totalPoints?: number;\n  /** True only when the displayed performance fields came from a verified official provider. */\n  statsVerified?: boolean;\n  status?: \"active\" | \"legacy\" | \"uncovered_league\";",
  "card stats verification type",
));

patch("client/src/lib/fantasy-card-adapter.ts", (source) => {
  source = replaceText(
    source,
    `  const totalPoints = finiteNumber(\n    player?.totalPoints,\n    player?.total_points,\n    (card as any).totalPoints,\n    last5Scores.reduce((sum, value) => sum + Number(value || 0), 0),\n  );\n  const form = finiteNumber(player?.form, player?.currentForm, (card as any).form, card.decisiveScore);\n  const rating = finiteNumber(player?.overall, card.decisiveScore);`,
    `  const officialStatValues = [\n    player?.totalPoints,\n    player?.total_points,\n    (card as any).totalPoints,\n    player?.form,\n    player?.currentForm,\n    (card as any).form,\n    player?.overall,\n  ];\n  const statsVerified = identityVerified && officialStatValues.some((value) => {\n    if (value === null || value === undefined || value === \"\") return false;\n    return Number.isFinite(Number(value));\n  });\n  const totalPoints = statsVerified\n    ? finiteNumber(player?.totalPoints, player?.total_points, (card as any).totalPoints)\n    : 0;\n  const form = statsVerified\n    ? finiteNumber(player?.form, player?.currentForm, (card as any).form)\n    : 0;\n  const rating = statsVerified ? finiteNumber(player?.overall) : 0;`,
    "verified adapter stats",
  );
  source = replaceText(
    source,
    "    totalPoints,\n  };",
    "    totalPoints,\n    statsVerified,\n  };",
    "adapter statsVerified output",
  );
  return source;
});

patch("client/src/components/cards/CollectionStableCard.tsx", (source) => replaceText(
  source,
  `  const ovr = numberStat(player.rating);\n  const points = numberStat(player.totalPoints);\n  const form = decimalStat(player.form);`,
  `  const statsVerified = player.statsVerified !== false;\n  const ovr: number | string = statsVerified ? numberStat(player.rating) : \"—\";\n  const points: number | string = statsVerified ? numberStat(player.totalPoints) : \"—\";\n  const form: number | string = statsVerified ? decimalStat(player.form) : \"—\";`,
  "stable card unverified stat placeholders",
));

patch("client/src/pages/marketplace-v2.tsx", (source) => {
  source = replaceText(
    source,
    `import CardShowcase from "../components/CardShowcase";\nimport { LoanMarketPanel } from "../components/marketplace/LoanMarketPanel";`,
    `import CardShowcase from "../components/CardShowcase";\nimport CardProfileModal from "../components/cards/CardProfileModal";\nimport { LoanMarketPanel } from "../components/marketplace/LoanMarketPanel";`,
    "marketplace profile modal import",
  );
  source = replaceText(
    source,
    `function ownerName(card: PlayerCardWithPlayer) {\n  return String((card as any).ownerUsername || (card as any).ownerName || "Fantasy Arena");\n}\n`,
    `function ownerName(card: PlayerCardWithPlayer) {\n  return String((card as any).ownerUsername || (card as any).ownerName || "Fantasy Arena");\n}\n\nfunction verifiedPlayerStat(card: PlayerCardWithPlayer, ...keys: string[]): number | null {\n  const player = card.player as any;\n  if (!player?.identityVerified) return null;\n  for (const key of keys) {\n    const value = key === "card.totalPoints" ? (card as any).totalPoints : player?.[key];\n    if (value === null || value === undefined || value === "") continue;\n    const number = Number(value);\n    if (Number.isFinite(number)) return number;\n  }\n  return null;\n}\n\nfunction officialPoints(card: PlayerCardWithPlayer) {\n  return verifiedPlayerStat(card, "totalPoints", "total_points", "card.totalPoints");\n}\n\nfunction officialOverall(card: PlayerCardWithPlayer) {\n  return verifiedPlayerStat(card, "overall");\n}\n\nfunction statText(value: number | null, decimals = 0) {\n  return value === null ? "—" : value.toFixed(decimals);\n}\n`,
    "marketplace verified stat helpers",
  );
  source = replaceText(
    source,
    `        return Number(b.decisiveScore || 0) - Number(a.decisiveScore || 0);`,
    `        return (officialPoints(b) ?? -1) - (officialPoints(a) ?? -1);`,
    "marketplace official performance sort",
  );
  source = replaceText(
    source,
    `            sortBy={sortBy}\n          />`,
    `            sortBy={sortBy}\n            onViewProfile={setSelected}\n          />`,
    "loan profile callback",
  );
  source = replaceRegex(
    source,
    /\n      <Dialog open=\{!!selected\}[\s\S]*?\n      <\/Dialog>(?=\n    <\/LivePageShell>)/,
    `\n      {selected ? <CardProfileModal card={selected} onClose={() => setSelected(null)} /> : null}`,
    "replace market details with shared profile modal",
  );
  source = replaceText(
    source,
    `    <article\n      className="relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-3 text-white backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-cyan-300/30"\n      style={{ boxShadow: \`0 0 30px \${glow}, 0 18px 48px rgba(0,0,0,.35)\` }}\n    >`,
    `    <article\n      role="button"\n      tabIndex={0}\n      aria-label={\`View verified stats for \${fantasy.name}\`}\n      onClick={() => onDetails?.()}\n      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onDetails?.(); }}\n      className="relative cursor-pointer overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-3 text-white backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-cyan-300/30"\n      style={{ boxShadow: \`0 0 30px \${glow}, 0 18px 48px rgba(0,0,0,.35)\` }}\n    >`,
    "clickable marketplace row",
  );
  source = replaceText(
    source,
    `<button onClick={onDetails} className="flex min-w-0 items-center gap-3 text-left">`,
    `<div className="flex min-w-0 items-center gap-3 text-left">`,
    "market row profile area open",
  );
  source = replaceText(
    source,
    `          </div>\n        </button>\n\n        <div className="flex items-center gap-2 rounded-xl`,
    `          </div>\n        </div>\n\n        <div className="flex items-center gap-2 rounded-xl`,
    "market row profile area close",
  );
  source = replaceText(
    source,
    `{Number(fantasy.rating || 0).toFixed(0)}`,
    `{statText(officialOverall(card))}`,
    "market row official overall",
  );
  source = replaceText(
    source,
    `<p className="text-[10px] uppercase tracking-[.14em] text-white/40">Points</p>\n          <p className="font-black">{Number(fantasy.totalPoints || card.decisiveScore || 0).toFixed(0)}</p>`,
    `<p className="text-[10px] uppercase tracking-[.14em] text-white/40">Season points</p>\n          <p className="font-black">{statText(officialPoints(card))}</p>`,
    "market row official points",
  );
  source = replaceText(
    source,
    `<Button size="sm" onClick={onBuy} className="rounded-xl bg-cyan-300 font-black text-black hover:bg-cyan-200">`,
    `<Button size="sm" onClick={(event) => { event.stopPropagation(); onBuy?.(); }} className="rounded-xl bg-cyan-300 font-black text-black hover:bg-cyan-200">`,
    "market buy propagation",
  );
  source = replaceText(
    source,
    `<Button size="icon" variant="ghost" onClick={onWatch} className={watched ? "text-red-300" : "text-white/45"}>`,
    `<Button size="icon" variant="ghost" onClick={(event) => { event.stopPropagation(); onWatch?.(); }} className={watched ? "text-red-300" : "text-white/45"}>`,
    "market watch propagation",
  );
  return source;
});

patch("client/src/components/marketplace/LoanMarketPanel.tsx", (source) => {
  source = replaceText(
    source,
    `function loanOwnerName(loan: LoanListing) {\n  return String(loan.owner_name || loan.ownerName || "Manager");\n}\n`,
    `function loanOwnerName(loan: LoanListing) {\n  return String(loan.owner_name || loan.ownerName || "Manager");\n}\n\nfunction loanCard(loan: LoanListing): PlayerCardWithPlayer {\n  if (loan.card?.id) return loan.card as PlayerCardWithPlayer;\n  return {\n    id: Number(loan.card_id || loan.cardId || 0),\n    playerId: Number(loan.player_id || loan.playerId || 0),\n    ownerId: String(loan.original_owner_id || loan.ownerId || ""),\n    rarity: rarityOfLoan(loan) as any,\n    serialId: loan.serial_id || loan.serialId || null,\n    serialNumber: loan.serial_number == null ? null : Number(loan.serial_number),\n    maxSupply: loan.max_supply == null ? null : Number(loan.max_supply),\n    level: Number(loan.level || 1),\n    xp: Number(loan.xp || 0),\n    decisiveScore: 0,\n    last5Scores: [],\n    forSale: false,\n    price: 0,\n    acquiredAt: loan.acquired_at || null,\n    player: {\n      id: Number(loan.player_id || loan.playerId || 0),\n      name: loanPlayerName(loan),\n      team: loan.team || "",\n      position: loan.position || "",\n      league: loan.league || "Premier League",\n      overall: loan.official_overall ?? null,\n      totalPoints: loan.official_total_points ?? null,\n      form: loan.official_form ?? null,\n      imageUrl: loanImage(loan),\n      verifiedImageUrl: loanImage(loan),\n      identityVerified: Boolean(loan.identity_verified),\n      identitySource: loan.identity_source || "unverified-card-data",\n    } as any,\n  } as PlayerCardWithPlayer;\n}\n\nfunction loanOfficialPoints(loan: LoanListing): number | null {\n  if (!loan.identity_verified) return null;\n  const value = loan.official_total_points ?? loan.card?.player?.totalPoints;\n  const number = Number(value);\n  return value === null || value === undefined || !Number.isFinite(number) ? null : number;\n}\n\nfunction loanOfficialOverall(loan: LoanListing): number | null {\n  if (!loan.identity_verified) return null;\n  const value = loan.official_overall ?? loan.card?.player?.overall;\n  const number = Number(value);\n  return value === null || value === undefined || !Number.isFinite(number) ? null : number;\n}\n\nfunction statText(value: number | null) {\n  return value === null ? "—" : value.toFixed(0);\n}\n`,
    "loan card profile helpers",
  );
  source = replaceText(
    source,
    `  sortBy = "performance",\n}: {\n  myCards: PlayerCardWithPlayer[];\n  walletBalance: number;\n  search?: string;\n  rarity?: string;\n  sortBy?: SortMode;\n}) {`,
    `  sortBy = "performance",\n  onViewProfile,\n}: {\n  myCards: PlayerCardWithPlayer[];\n  walletBalance: number;\n  search?: string;\n  rarity?: string;\n  sortBy?: SortMode;\n  onViewProfile?: (card: PlayerCardWithPlayer) => void;\n}) {`,
    "loan profile prop",
  );
  source = replaceText(
    source,
    `        return Number(b.overall || b.decisive_score || 0) - Number(a.overall || a.decisive_score || 0);`,
    `        return (loanOfficialPoints(b) ?? -1) - (loanOfficialPoints(a) ?? -1);`,
    "loan official performance sort",
  );
  source = replaceText(
    source,
    `              onAccept={() => setConfirmingLoan(loan)}\n            />`,
    `              onAccept={() => setConfirmingLoan(loan)}\n              onDetails={() => onViewProfile?.(loanCard(loan))}\n            />`,
    "loan row profile callback",
  );
  source = replaceText(
    source,
    `  onAccept,\n}: {\n  loan: LoanListing;\n  walletBalance: number;\n  accepting: boolean;\n  onAccept: () => void;\n}) {`,
    `  onAccept,\n  onDetails,\n}: {\n  loan: LoanListing;\n  walletBalance: number;\n  accepting: boolean;\n  onAccept: () => void;\n  onDetails: () => void;\n}) {`,
    "loan row detail prop",
  );
  source = replaceText(
    source,
    `  const overall = Number(loan.overall || loan.decisive_score || 0);`,
    `  const overall = loanOfficialOverall(loan);`,
    "loan official overall",
  );
  source = replaceText(
    source,
    `    <article\n      className="relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-3 text-white backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-cyan-300/30"\n      style={{ boxShadow: \`0 0 30px \${glow}, 0 18px 48px rgba(0,0,0,.35)\` }}\n    >`,
    `    <article\n      role="button"\n      tabIndex={0}\n      aria-label={\`View verified stats for \${loanPlayerName(loan)}\`}\n      onClick={onDetails}\n      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onDetails(); }}\n      className="relative cursor-pointer overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-3 text-white backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-cyan-300/30"\n      style={{ boxShadow: \`0 0 30px \${glow}, 0 18px 48px rgba(0,0,0,.35)\` }}\n    >`,
    "clickable loan row",
  );
  source = replaceText(
    source,
    `{overall.toFixed(0)}`,
    `{statText(overall)}`,
    "loan official rating display",
  );
  source = replaceText(
    source,
    `            onClick={onAccept}\n            className="rounded-xl bg-cyan-300 font-black text-black hover:bg-cyan-200"`,
    `            onClick={(event) => { event.stopPropagation(); onAccept(); }}\n            className="rounded-xl bg-cyan-300 font-black text-black hover:bg-cyan-200"`,
    "loan accept propagation",
  );
  return source;
});

patch("server/routes/marketplace.routes.ts", (source) => {
  source = replaceText(
    source,
    `import { buildFplPlayerIndex } from "../services/fplPlayerIdentity.js";`,
    `import { buildFplPlayerIndex, overallFromFplElement } from "../services/fplPlayerIdentity.js";`,
    "marketplace official overall import",
  );
  source = replaceText(
    source,
    `        const verifiedImageUrl = apiFootballImage || (matchedElement ? fplApi.playerPhotoUrl(matchedElement, 250) : null);\n        const identityVerified = Boolean(apiFootballPlayer || matchedElement);\n        return { ...row, player: { ...storedPlayer, ...(canonical || {}), name: canonical?.name || apiFootballPlayer?.name || storedPlayer.name, team: apiFootballPlayer?.team || canonical?.team || storedPlayer.team, position: apiFootballPlayer?.position || canonical?.position || storedPlayer.position, apiFootballId: apiFootballPlayer?.apiPlayerId || null, imageUrl: verifiedImageUrl, verifiedImageUrl, identityVerified, identitySource: apiFootballPlayer && matchedElement ? "fpl+api-football" : apiFootballPlayer ? "api-football-current-squad" : matchedElement ? "fpl" : "unverified-card-data" } };`,
    `        const verifiedImageUrl = apiFootballImage || (matchedElement ? fplApi.playerPhotoUrl(matchedElement, 250) : null);\n        const identityVerified = Boolean(apiFootballPlayer || matchedElement);\n        const officialTotalPoints = matchedElement ? Number(matchedElement.total_points || 0) : null;\n        const officialForm = matchedElement ? Number(matchedElement.form || 0) : null;\n        const officialOverall = matchedElement ? overallFromFplElement(matchedElement) : null;\n        return {\n          ...row,\n          totalPoints: officialTotalPoints,\n          player: {\n            ...storedPlayer,\n            ...(canonical || {}),\n            name: canonical?.name || apiFootballPlayer?.name || storedPlayer.name,\n            team: apiFootballPlayer?.team || canonical?.team || storedPlayer.team,\n            position: apiFootballPlayer?.position || canonical?.position || storedPlayer.position,\n            apiFootballId: apiFootballPlayer?.apiPlayerId || null,\n            imageUrl: verifiedImageUrl,\n            verifiedImageUrl,\n            identityVerified,\n            identitySource: apiFootballPlayer && matchedElement ? "fpl+api-football" : apiFootballPlayer ? "api-football-current-squad" : matchedElement ? "fpl" : "unverified-card-data",\n            totalPoints: officialTotalPoints,\n            form: officialForm,\n            overall: officialOverall,\n          },\n        };`,
    "marketplace official provider stats",
  );
  return source;
});

patch("server/routes/loanMarket.routes.ts", (source) => {
  source = replaceText(
    source,
    `import { db } from "../db.js";`,
    `import { db } from "../db.js";\nimport { fplApi } from "../services/fplApi.js";\nimport { buildFplPlayerIndex, overallFromFplElement } from "../services/fplPlayerIdentity.js";\nimport { apiFootballPhotoUrl, loadApiFootballPlayerDirectory, resolveApiFootballPlayer } from "../services/apiFootballPlayerDirectory.js";`,
    "loan official provider imports",
  );
  source = replaceRegex(
    source,
    /  app\.get\("\/api\/marketplace\/loans", requireAuth, async \(_req: any, res\) => \{[\s\S]*?\n  \}\);\n\n  app\.get\("\/api\/admin\/loan-payments\/integrity"/,
    `  app.get("/api/marketplace/loans", requireAuth, async (_req: any, res) => {\n    try {\n      await returnExpiredLoans();\n      const [result, bootstrap, apiFootballDirectory] = await Promise.all([\n        db.execute(sql\`\n          select\n            l.*,\n            pc.player_id, pc.level, pc.xp, pc.acquired_at,\n            p.name as player_name, p.team, p.position, p.league,\n            p.fpl_id, p.code, p.photo, p.web_name, p.nationality,\n            pc.rarity, pc.serial_id, pc.serial_number, pc.max_supply,\n            coalesce(u.manager_team_name, u.name, u.email, 'Manager') as owner_name\n          from app.card_loans l\n          join app.player_cards pc on pc.id = l.card_id\n          join app.players p on p.id = pc.player_id\n          left join app.users u on u.id = l.original_owner_id\n          where l.status = 'open'\n          order by l.created_at desc, l.id desc\n        \`),\n        fplApi.bootstrap().catch(() => null),\n        loadApiFootballPlayerDirectory().catch(() => []),\n      ]);\n      const fplIndex = buildFplPlayerIndex(bootstrap || {});\n      const loans = rowsOf(result).map((row: any) => {\n        const storedPlayer = {\n          id: row.player_id, name: row.player_name, team: row.team, position: row.position,\n          league: row.league, fplId: row.fpl_id, code: row.code, photo: row.photo,\n          webName: row.web_name, nationality: row.nationality,\n        };\n        const matchedElement = fplIndex.resolve(storedPlayer);\n        const canonical = matchedElement ? fplIndex.canonical(matchedElement) : null;\n        const apiFootballPlayer = resolveApiFootballPlayer({ ...storedPlayer, ...(canonical || {}) }, apiFootballDirectory);\n        const verifiedImageUrl = apiFootballPlayer\n          ? apiFootballPhotoUrl(apiFootballPlayer.apiPlayerId, apiFootballPlayer.photo)\n          : matchedElement\n            ? fplApi.playerPhotoUrl(matchedElement, 250)\n            : null;\n        const identityVerified = Boolean(apiFootballPlayer || matchedElement);\n        const identitySource = apiFootballPlayer && matchedElement\n          ? "fpl+api-football"\n          : apiFootballPlayer\n            ? "api-football-current-squad"\n            : matchedElement\n              ? "fpl"\n              : "unverified-card-data";\n        const officialTotalPoints = matchedElement ? Number(matchedElement.total_points || 0) : null;\n        const officialForm = matchedElement ? Number(matchedElement.form || 0) : null;\n        const officialOverall = matchedElement ? overallFromFplElement(matchedElement) : null;\n        const player = {\n          ...storedPlayer, ...(canonical || {}),\n          name: canonical?.name || apiFootballPlayer?.name || storedPlayer.name,\n          team: apiFootballPlayer?.team || canonical?.team || storedPlayer.team,\n          position: apiFootballPlayer?.position || canonical?.position || storedPlayer.position,\n          apiFootballId: apiFootballPlayer?.apiPlayerId || null,\n          imageUrl: verifiedImageUrl, verifiedImageUrl, identityVerified, identitySource,\n          totalPoints: officialTotalPoints, form: officialForm, overall: officialOverall,\n        };\n        return {\n          ...row, image_url: verifiedImageUrl, identity_verified: identityVerified, identity_source: identitySource,\n          official_total_points: officialTotalPoints, official_form: officialForm, official_overall: officialOverall,\n          player_name: player.name, team: player.team, position: player.position,\n          card: {\n            id: Number(row.card_id), playerId: Number(row.player_id), ownerId: String(row.original_owner_id || ""),\n            rarity: row.rarity, serialId: row.serial_id, serialNumber: row.serial_number, maxSupply: row.max_supply,\n            level: Number(row.level || 1), xp: Number(row.xp || 0), decisiveScore: 0, last5Scores: [],\n            forSale: false, price: 0, acquiredAt: row.acquired_at, totalPoints: officialTotalPoints, player,\n          },\n        };\n      });\n      return res.json({ loans });\n    } catch (error: any) {\n      console.error("Failed to fetch loan listings:", error);\n      return res.status(500).json({ message: error?.message || "Failed to fetch loan listings" });\n    }\n  });\n\n  app.get("/api/admin/loan-payments/integrity"`,
    "loan marketplace official enrichment",
  );
  return source;
});

patch("server/routes/cards.routes.ts", (source) => {
  source = replaceText(
    source,
    `        const totalPoints = matchedElement\n          ? Number(matchedElement.total_points || 0)\n          : Number(player.totalPoints ?? player.total_points ?? card.totalPoints ?? 0);\n        const form = matchedElement\n          ? Number(matchedElement.form || 0)\n          : Number(player.form ?? card.decisiveScore ?? 0);\n        const overall = matchedElement\n          ? overallFromFplElement(matchedElement)\n          : Number(player.overall || card.decisiveScore || 0);`,
    `        const totalPoints = matchedElement ? Number(matchedElement.total_points || 0) : null;\n        const form = matchedElement ? Number(matchedElement.form || 0) : null;\n        const overall = matchedElement ? overallFromFplElement(matchedElement) : null;`,
    "owned card official stats only",
  );
  source = replaceText(
    source,
    `      const userId = String(req.authUserId || "");\n      const cardId = Number(req.params.cardId);\n      if (!Number.isInteger(cardId) || cardId <= 0) return res.status(400).json({ message: "Valid cardId required" });\n      const userCards = await storage.getUserCards(userId);\n      const card = userCards.find((item: any) => Number(item.id) === cardId);\n      if (!card) return res.status(404).json({ message: "Card not found" });`,
    `      const viewerUserId = String(req.authUserId || "");\n      const cardId = Number(req.params.cardId);\n      if (!Number.isInteger(cardId) || cardId <= 0) return res.status(400).json({ message: "Valid cardId required" });\n      let card = await storage.getPlayerCardWithPlayer(cardId, viewerUserId);\n      if (!card) {\n        const rawCard = await storage.getPlayerCard(cardId);\n        const player = rawCard ? await storage.getPlayer(Number(rawCard.playerId)) : null;\n        if (rawCard && player) card = { ...rawCard, player } as any;\n      }\n      if (!card) return res.status(404).json({ message: "Card not found" });`,
    "shared card profile visibility",
  );
  source = replaceText(
    source,
    `stats: { matchesPlayed: 0, minutes: 0, goals: 0, assists: 0, cleanSheets: 0, yellowCards: 0, redCards: 0, bonus: 0, totalPoints: Number(card.totalPoints || player.totalPoints || 0), selectedBy: null, value: lastSaleValue, saves: 0, averageRating: null },`,
    `stats: { matchesPlayed: 0, minutes: 0, goals: 0, assists: 0, cleanSheets: 0, yellowCards: 0, redCards: 0, bonus: 0, totalPoints: 0, selectedBy: null, value: lastSaleValue, saves: 0, averageRating: null },`,
    "unverified profile does not reuse stored points",
  );
  return source;
});

patch("client/src/components/cards/CardProfileModal.tsx", (source) => {
  source = replaceText(
    source,
    `function sourceLabel(data: CardProfileData) {\n  if (data.source === "api-football") return "API-Football verified";\n  if (data.source === "fpl-live" && data.providers?.identity?.includes("API-Football")) return "FPL + API verified";\n  if (data.source === "fpl-live") return "FPL live linked";\n  return "Awaiting official link";\n}\n`,
    `function sourceLabel(data: CardProfileData) {\n  if (data.source === "api-football") return "API-Football verified";\n  if (data.source === "fpl-live" && data.providers?.identity?.includes("API-Football")) return "FPL + API verified";\n  if (data.source === "fpl-live") return "FPL live linked";\n  return "Awaiting official link";\n}\n\nfunction officialStat(data: CardProfileData, value: unknown, decimals = 0): string | number {\n  if (data.source === "card-fallback") return "—";\n  const number = Number(value);\n  if (!Number.isFinite(number)) return "—";\n  return decimals > 0 ? number.toFixed(decimals) : Math.round(number);\n}\n`,
    "profile official stat helper",
  );
  source = replaceText(
    source,
    `                <HeroStat icon={<Star className="h-4 w-4" />} label={totalPointsLabel} value={data.stats.totalPoints} />`,
    `                <HeroStat icon={<Star className="h-4 w-4" />} label={totalPointsLabel} value={officialStat(data, data.stats.totalPoints)} />`,
    "profile official total points",
  );
  source = replaceText(
    source,
    `                <HeroStat icon={<Award className="h-4 w-4" />} label={data.source === "api-football" ? "Avg Rating" : "Bonus"} value={data.source === "api-football" ? (data.stats.averageRating ?? "—") : (data.stats.bonus || 0)} />`,
    `                <HeroStat icon={<Award className="h-4 w-4" />} label={data.source === "api-football" ? "Avg Rating" : "Bonus"} value={data.source === "api-football" ? officialStat(data, data.stats.averageRating, 1) : officialStat(data, data.stats.bonus)} />`,
    "profile official rating bonus",
  );
  const replacements = [
    ["value={data.stats.matchesPlayed}", "value={officialStat(data, data.stats.matchesPlayed)}"],
    ["value={data.stats.minutes}", "value={officialStat(data, data.stats.minutes)}"],
    ["value={data.stats.goals}", "value={officialStat(data, data.stats.goals)}"],
    ["value={data.stats.assists}", "value={officialStat(data, data.stats.assists)}"],
    ["value={data.stats.cleanSheets || 0}", "value={officialStat(data, data.stats.cleanSheets)}"],
    ["value={data.stats.saves || 0}", "value={officialStat(data, data.stats.saves)}"],
    ["value={data.stats.yellowCards}", "value={officialStat(data, data.stats.yellowCards)}"],
    ["value={data.stats.redCards}", "value={officialStat(data, data.stats.redCards)}"],
    ["value={data.stats.bonus || 0}", "value={officialStat(data, data.stats.bonus)}"],
  ];
  for (const [from, to] of replacements) source = replaceText(source, from, to, `profile stat ${from}`);
  return source;
});

const verifier = `#!/usr/bin/env node\nimport fs from "node:fs";\n\nconst read = (file) => fs.readFileSync(file, "utf8");\nconst failures = [];\nconst expect = (value, message) => { if (!value) failures.push(message); };\n\nconst market = read("client/src/pages/marketplace-v2.tsx");\nconst loan = read("client/src/components/marketplace/LoanMarketPanel.tsx");\nconst adapter = read("client/src/lib/fantasy-card-adapter.ts");\nconst stable = read("client/src/components/cards/CollectionStableCard.tsx");\nconst profile = read("client/src/components/cards/CardProfileModal.tsx");\nconst cards = read("server/routes/cards.routes.ts");\nconst marketRoute = read("server/routes/marketplace.routes.ts");\nconst loanRoute = read("server/routes/loanMarket.routes.ts");\n\nexpect(market.includes("CardProfileModal"), "Marketplace must open the collection card profile modal");\nexpect(market.includes("onViewProfile={setSelected}"), "Loan market must share the profile modal");\nexpect(market.includes("Season points"), "Marketplace must label official season points");\nexpect(!market.includes("fantasy.totalPoints || card.decisiveScore"), "Marketplace must not fall back to decisive score as points");\nexpect(loan.includes("loanCard(loan)"), "Loan rows must provide the real card to the profile modal");\nexpect(!loan.includes("loan.overall || loan.decisive_score"), "Loan rows must not display stored fallback ratings");\nexpect(adapter.includes("statsVerified"), "Card adapter must expose verified-stat state");\nexpect(!adapter.includes("card.decisiveScore);"), "Card adapter must not invent rating or form from decisive score");\nexpect(stable.includes('statsVerified ? numberStat(player.rating) : "—"'), "Cards must show dashes for unverified stats");\nexpect(profile.includes("officialStat(data"), "Profile modal must suppress unverified numeric stats");\nexpect(cards.includes("getPlayerCardWithPlayer(cardId, viewerUserId)"), "Profiles must work for marketplace cards");\nexpect(cards.includes("const rawCard = await storage.getPlayerCard(cardId)"), "Profiles must work for loan and auction cards");\nexpect(marketRoute.includes("officialTotalPoints"), "Sale listings must use official provider points");\nexpect(loanRoute.includes("official_total_points"), "Loan listings must use official provider points");\n\nif (failures.length) {\n  console.error("Marketplace profile integrity verification failed:");\n  failures.forEach((failure) => console.error(`- ${failure}`));\n  process.exit(1);\n}\nconsole.log("Marketplace and loan cards open verified profiles, and unverified performance values are not presented as facts.");\n`;
write("scripts/verify-marketplace-profile-integrity.mjs", verifier);
console.log("Wrote scripts/verify-marketplace-profile-integrity.mjs");
