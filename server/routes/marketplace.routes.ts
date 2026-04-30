// ADD THIS ROUTE BELOW EXISTING ROUTES
app.post("/api/marketplace/cancel/:cardId", requireAuth, async (req: any, res) => {
  const userId = req.authUserId;
  const cardId = Number(req.params.cardId);

  const card = await db.select().from(playerCards).where(eq(playerCards.id, cardId)).then(r => r[0]);
  if (!card) return res.status(404).json({ message: "Card not found" });
  if (String(card.ownerId) !== String(userId)) return res.status(403).json({ message: "Not your card" });

  await db.update(playerCards).set({ forSale: false, price: 0 } as any).where(eq(playerCards.id, cardId));
  res.json({ success: true });
});