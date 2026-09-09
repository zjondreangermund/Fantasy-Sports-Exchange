import fs from "node:fs";

function patchFile(file, transform) {
  const source = fs.readFileSync(file, "utf8");
  const next = transform(source);
  if (next !== source) fs.writeFileSync(file, next);
}

function replaceOnce(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`[native-trading-integrity] ${label} anchor not found`);
  return source.replace(from, to);
}

patchFile("server/routes/loanMarket.routes.ts", (original) => {
  let source = original;

  source = replaceOnce(
    source,
    "  getLoanFloorPerGameweek,\n  LOAN_DURATIONS_GAMEWEEKS,\n  normalizeLoanRarity,",
    "  getLoanFloorPerGameweek,\n  LOAN_DURATIONS_GAMEWEEKS,\n  LOAN_MARKET_FEE_RATE,\n  normalizeLoanRarity,",
    "loan fee constant import",
  );

  source = source.replace("gross * 0.08", "gross * LOAN_MARKET_FEE_RATE");

  const adminAnchor = `  app.get("/api/admin/loan-payments/integrity", requireAuth, async (req: any, res) => {`;
  if (!source.includes('app.get("/api/marketplace/loans/mine"')) {
    const endpoint = `  // NATIVE_CARD_TRADING_LOAN_STATE_V1\n  app.get("/api/marketplace/loans/mine", requireAuth, async (req: any, res) => {\n    try {\n      await returnExpiredLoans();\n      const userId = String(req.authUserId || "");\n      const result = await db.execute(sql\`\n        select\n          l.*,\n          pc.rarity,\n          p.name as player_name,\n          p.team,\n          p.position\n        from app.card_loans l\n        join app.player_cards pc on pc.id = l.card_id\n        join app.players p on p.id = pc.player_id\n        where (l.original_owner_id = \${userId} or l.borrower_user_id = \${userId})\n          and l.status in ('open', 'active')\n        order by l.created_at desc, l.id desc\n      \`);\n      const loans = rowsOf(result).map((row: any) => ({\n        ...row,\n        relation: String(row.original_owner_id || "") === userId ? "lender" : "borrower",\n      }));\n      return res.json({ loans });\n    } catch (error: any) {\n      console.error("Failed to fetch user loan state:", error);\n      return res.status(500).json({ message: error?.message || "Failed to fetch loan state" });\n    }\n  });\n\n${adminAnchor}`;
    source = replaceOnce(source, adminAnchor, endpoint, "user loan state endpoint");
  }

  const acceptAnchor = `  app.post("/api/marketplace/loans/:loanId/accept", requireAuth, async (req: any, res) => {`;
  if (!source.includes('app.post("/api/marketplace/loans/:loanId/cancel"')) {
    const endpoint = `  app.post("/api/marketplace/loans/:loanId/cancel", requireAuth, async (req: any, res) => {\n    try {\n      await returnExpiredLoans();\n      const userId = String(req.authUserId || "");\n      const loanId = Number(req.params.loanId);\n      if (!Number.isInteger(loanId) || loanId <= 0) return res.status(400).json({ message: "Valid loanId required" });\n\n      let cancelled: any = null;\n      await db.transaction(async (tx) => {\n        const result = await tx.execute(sql\`\n          select * from app.card_loans\n          where id = \${loanId}\n          for update\n        \`);\n        const loan = rowsOf(result)[0];\n        if (!loan) throw new Error("Loan listing not found");\n        if (String(loan.original_owner_id || "") !== userId) throw new Error("You can only cancel your own loan listing");\n        if (String(loan.status || "") !== "open") throw new Error("Only an open loan listing can be cancelled");\n\n        const update = await tx.execute(sql\`\n          update app.card_loans\n          set status = 'cancelled'\n          where id = \${loanId} and status = 'open'\n          returning *\n        \`);\n        cancelled = rowsOf(update)[0] || null;\n        if (!cancelled) throw new Error("Loan listing changed before cancellation completed");\n        await tx.execute(sql\`\n          insert into app.audit_logs (user_id, action, meta)\n          values (\${userId}, 'loan.listing.cancelled', \${JSON.stringify({ loanId })}::jsonb)\n        \`);\n      });\n\n      return res.json({ success: true, loan: cancelled });\n    } catch (error: any) {\n      const message = String(error?.message || "Failed to cancel loan listing");\n      console.error("Failed to cancel loan listing:", error);\n      return res.status(message.includes("not found") ? 404 : 400).json({ message });\n    }\n  });\n\n${acceptAnchor}`;
    source = replaceOnce(source, acceptAnchor, endpoint, "loan cancellation endpoint");
  }

  return source;
});

patchFile("server/routes/cards.routes.ts", (original) => {
  let source = original;
  if (source.includes("NATIVE_CARD_SALE_LOAN_GUARD_V1")) return source;
  const anchor = `      await storage.updatePlayerCard(cardId, { forSale: true, price } as any);`;
  const guarded = `      // NATIVE_CARD_SALE_LOAN_GUARD_V1\n      const loanStateResult = await db.execute(sql\`\n        select id, status\n        from app.card_loans\n        where card_id = \${cardId}\n          and status in ('open', 'active')\n        order by id desc\n        limit 1\n      \`);\n      const loanState = Array.isArray((loanStateResult as any)?.rows) ? (loanStateResult as any).rows[0] : null;\n      if (loanState) {\n        const status = String(loanState.status || "");\n        return res.status(400).json({ message: status === "active" ? "A card on an active loan cannot be sold" : "Cancel the loan listing before listing this card for sale" });\n      }\n      await storage.updatePlayerCard(cardId, { forSale: true, price } as any);`;
  source = replaceOnce(source, anchor, guarded, "sale versus loan guard");
  return source;
});

patchFile("server/routes/marketplace.routes.ts", (original) => {
  let source = original;
  if (source.includes("NATIVE_MARKET_BUY_LOAN_GUARD_V1")) return source;
  const anchor = `      const sellerId = String(card.ownerId || ""); const price = toMoney(card.price || 0);`;
  const guarded = `      // NATIVE_MARKET_BUY_LOAN_GUARD_V1\n      const loanStateResult = await tx.execute(sql\`\n        select id, status\n        from app.card_loans\n        where card_id = \${resolvedCardId}\n          and status in ('open', 'active')\n        order by id desc\n        limit 1\n      \`);\n      if (rowsFromResult(loanStateResult).length > 0) throw new Error("Card is reserved by the loan market and cannot be purchased");\n      const sellerId = String(card.ownerId || ""); const price = toMoney(card.price || 0);`;
  source = replaceOnce(source, anchor, guarded, "purchase versus loan guard");
  return source;
});

console.log("[native-trading-integrity] Native sell/loan state, cancellation, automatic-return safeguards and fee consistency applied.");
