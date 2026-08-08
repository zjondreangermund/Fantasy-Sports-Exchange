import fs from "node:fs";

function patchFile(file, transform) {
  const source = fs.readFileSync(file, "utf8");
  const next = transform(source);
  if (next !== source) fs.writeFileSync(file, next);
}

function replaceOnce(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`Loan pricing patch anchor not found: ${label}`);
  return source.replace(from, to);
}

// The Free Card Cups patch predates the new free-first landing and is imported by
// another build repair script. Once the new landing is present, its old landing
// string replacements are obsolete. Make those replacements no-ops while leaving
// all tournament/API/card-award patches untouched.
patchFile("scripts/apply-free-card-cups.mjs", (original) => {
  const oldHelper = `function replaceOnce(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(\`Free Card Cups patch anchor not found: \${label}\`);
  return source.replace(from, to);
}`;
  const compatibleHelper = `function replaceOnce(source, from, to, label) {
  if (label.startsWith("landing") && source.includes("Start Free. Build Your Club.")) return source;
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(\`Free Card Cups patch anchor not found: \${label}\`);
  return source.replace(from, to);
}`;
  if (original.includes(compatibleHelper)) return original;
  if (!original.includes(oldHelper)) throw new Error("Could not make Free Card Cups landing patch compatible with the free-first landing");
  return original.replace(oldHelper, compatibleHelper);
});

patchFile("server/routes/loanMarket.routes.ts", (original) => {
  let source = original;

  if (!source.includes("LOAN_ACQUISITION_PRICING_V1")) {
    const anchor = "export function registerLoanMarketRoutes(app: Express, deps: RegisterLoanMarketRoutesDeps) {";
    const helper = `// LOAN_ACQUISITION_PRICING_V1\nasync function resolveLoanAcquisitionBasis(executor: any, userId: string, cardId: number) {\n  const candidates: Array<{ price: number; source: \"marketplace\" | \"auction\"; occurredAt: Date }> = [];\n\n  const marketplace = rowsOf(await executor.execute(sql\`\n    select nullif(meta ->> 'price', '')::numeric as price, created_at\n    from app.audit_logs\n    where user_id = \${userId}\n      and action = 'marketplace.purchase.completed'\n      and meta ->> 'cardId' = \${String(cardId)}\n    order by created_at desc, id desc\n    limit 1\n  \`))[0];\n  if (Number(marketplace?.price || 0) > 0) {\n    candidates.push({ price: toMoney(marketplace.price), source: \"marketplace\", occurredAt: new Date(marketplace.created_at || 0) });\n  }\n\n  // Auction escrow is additive infrastructure and may not exist on very old databases.\n  // If unavailable, Marketplace acquisition history still works and won/free cards\n  // correctly fall back to 10% of the rarity floor.\n  try {\n    const auction = rowsOf(await executor.execute(sql\`\n      select h.amount as price, coalesce(h.settled_at, h.updated_at, h.created_at) as occurred_at\n      from app.auction_escrow_holds h\n      join app.auctions a on a.id = h.auction_id\n      where h.bidder_user_id = \${userId}\n        and a.card_id = \${cardId}\n        and h.status = 'settled'\n      order by coalesce(h.settled_at, h.updated_at, h.created_at) desc, h.id desc\n      limit 1\n    \`))[0];\n    if (Number(auction?.price || 0) > 0) {\n      candidates.push({ price: toMoney(auction.price), source: \"auction\", occurredAt: new Date(auction.occurred_at || 0) });\n    }\n  } catch {\n    // Older environments without auction escrow simply have no auction cost basis.\n  }\n\n  candidates.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());\n  const latest = candidates[0];\n  return latest ? { costBasis: latest.price, source: latest.source } : { costBasis: 0, source: \"rarity_floor\" as const };\n}\n\n${anchor}`;
    source = replaceOnce(source, anchor, helper, "server acquisition basis helper");
  }

  const adminAnchor = `  app.get("/api/admin/loan-payments/integrity", requireAuth, async (req: any, res) => {`;
  if (!source.includes('app.get("/api/marketplace/loans/my-minimums"')) {
    const endpoint = `  app.get("/api/marketplace/loans/my-minimums", requireAuth, async (req: any, res) => {\n    try {\n      const userId = String(req.authUserId || \"\");\n      const cards = rowsOf(await db.execute(sql\`\n        select id, rarity::text as rarity\n        from app.player_cards\n        where owner_id = \${userId}\n          and rarity::text in ('rare', 'unique', 'epic', 'legendary')\n          and coalesce(for_sale, false) = false\n        order by id\n      \`));\n\n      const minimums = [];\n      for (const card of cards) {\n        const cardId = Number(card.id);\n        const rarity = String(card.rarity || \"\");\n        const acquisition = await resolveLoanAcquisitionBasis(db, userId, cardId);\n        minimums.push({\n          cardId,\n          rarity,\n          costBasis: acquisition.costBasis,\n          acquisitionSource: acquisition.source,\n          minimumPricePerGameweek: getLoanFloorPerGameweek(rarity, acquisition.costBasis),\n        });\n      }\n\n      return res.json({ minimums });\n    } catch (error: any) {\n      console.error(\"Failed to calculate loan minimums:\", error);\n      return res.status(500).json({ message: error?.message || \"Failed to calculate loan minimums\" });\n    }\n  });\n\n${adminAnchor}`;
    source = replaceOnce(source, adminAnchor, endpoint, "loan minimum endpoint");
  }

  source = replaceOnce(
    source,
    `        const breakdown = getLoanFeeBreakdown({ rarity: normalizedRarity, pricePerGameweek: requestedPrice, gameweeks });`,
    `        const acquisition = await resolveLoanAcquisitionBasis(tx, userId, cardId);\n        const breakdown = getLoanFeeBreakdown({ rarity: normalizedRarity, pricePerGameweek: requestedPrice, gameweeks, costBasis: acquisition.costBasis });`,
    "server listing minimum enforcement",
  );

  source = source.replace(
    `values (\${userId}, 'loan.listing.created', \${JSON.stringify({ cardId, loanId: created?.id, breakdown })}::jsonb)`,
    `values (\${userId}, 'loan.listing.created', \${JSON.stringify({ cardId, loanId: created?.id, breakdown, acquisitionSource: acquisition.source })}::jsonb)`,
  );

  return source;
});

patchFile("client/src/components/marketplace/LoanMarketPanel.tsx", (original) => {
  let source = original;

  source = replaceOnce(
    source,
    `type LoanListing = Record<string, any>;\ntype SortMode = "performance" | "priceAsc" | "priceDesc" | "rarity";`,
    `type LoanListing = Record<string, any>;\ntype LoanMinimum = {\n  cardId: number;\n  rarity: string;\n  costBasis: number;\n  acquisitionSource: "marketplace" | "auction" | "rarity_floor";\n  minimumPricePerGameweek: number;\n};\ntype SortMode = "performance" | "priceAsc" | "priceDesc" | "rarity";`,
    "client loan minimum type",
  );

  const pricingBlock = `  const selectedCard = loanableCards.find((card) => card.id === selectedCardId) || loanableCards[0];\n  const selectedRarity = selectedCard ? rarityOfCard(selectedCard) : "rare";\n  const floor = getLoanFloorPerGameweek(selectedRarity) || 20;\n  const breakdown = getLoanFeeBreakdown({ rarity: selectedRarity, pricePerGameweek, gameweeks });`;
  const newPricingBlock = `  const selectedCard = loanableCards.find((card) => card.id === selectedCardId) || loanableCards[0];\n  const { data: loanMinimumData } = useQuery<{ minimums: LoanMinimum[] }>({\n    queryKey: ["/api/marketplace/loans/my-minimums"],\n    queryFn: async () => {\n      const res = await fetch("/api/marketplace/loans/my-minimums", { credentials: "include" });\n      if (!res.ok) throw new Error("Failed to calculate loan minimums");\n      return res.json();\n    },\n  });\n  const minimumByCard = useMemo(\n    () => new Map((loanMinimumData?.minimums || []).map((item) => [Number(item.cardId), item])),\n    [loanMinimumData?.minimums],\n  );\n  const selectedMinimum = selectedCard ? minimumByCard.get(Number(selectedCard.id)) : undefined;\n  const selectedRarity = selectedCard ? rarityOfCard(selectedCard) : "rare";\n  const costBasis = Number(selectedMinimum?.costBasis || 0);\n  const floor = Number(selectedMinimum?.minimumPricePerGameweek ?? getLoanFloorPerGameweek(selectedRarity, costBasis));\n  const breakdown = getLoanFeeBreakdown({ rarity: selectedRarity, pricePerGameweek, gameweeks, costBasis });`;
  source = replaceOnce(source, pricingBlock, newPricingBlock, "client acquisition pricing query");

  source = replaceOnce(
    source,
    `    setPricePerGameweek(getLoanFloorPerGameweek(rarityOfCard(selectedCard)) || 20);\n  }, [selectedCard?.id]);`,
    `    setPricePerGameweek(floor);\n  }, [selectedCard?.id, floor]);`,
    "client default loan price",
  );

  source = source.replace(
    `Choose a card, duration and price per gameweek. Common cards cannot be loaned.`,
    `Choose a card, duration and price per gameweek. Purchased cards start at 10% of what you paid; won/free cards start at 10% of the rarity floor. Common cards cannot be loaned.`,
  );

  source = replaceOnce(
    source,
    `<p className="text-white/55">Minimum: {money(floor)} per gameweek</p>`,
    `<p className="text-white/55">Minimum: {money(floor)} per gameweek</p>\n                  <p className="text-xs text-white/40">{costBasis > 0 ? \`10% of your ${"${money(costBasis)}"} acquisition price${"${selectedMinimum?.acquisitionSource === \"auction\" ? \" (auction)\" : \"\"}"}\` : \`10% of the ${"${selectedRarity}"} Marketplace floor price\`}</p>`,
    "client minimum explanation",
  );

  return source;
});

patchFile("client/src/pages/legal-centre.tsx", (original) => {
  let source = original;
  source = source.replace(
    `"Loan duration, lineup eligibility and return timing are governed by the terms shown at confirmation.", "Auction bids may be binding once accepted by the system."`,
    `"Eligible Rare, Unique, Epic and Legendary cards may be loaned for the duration shown at confirmation. Common cards cannot be loaned.", "The minimum loan listing price per gameweek is 10% of the current owner's recorded purchase or auction acquisition price. If the card was won or otherwise acquired without a purchase price, the minimum is 10% of that rarity's Marketplace floor price.", "Loan duration, lineup eligibility and automatic return timing are governed by the terms shown at confirmation.", "Auction bids may be binding once accepted by the system."`,
  );
  return source;
});

console.log("Applied acquisition-based loan pricing and user-facing loan guidance.");
