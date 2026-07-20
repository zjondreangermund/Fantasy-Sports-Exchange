import type { Express } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db.js";
import {
  buyAuctionNow,
  cancelAuctionWithEscrowRecovery,
  createAuction,
  getAuctionDetails,
  getAuctionEscrowIntegrityReport,
  listActiveAuctions,
  placeAuctionBid,
  recoverAuctionEscrow,
  settleAuctionWithEscrowRecovery,
} from "../services/auctionEscrow.js";

interface RegisterAuctionsRoutesDeps {
  requireAuth: any;
  isAdmin?: any;
}

const DEFAULT_ADMIN_EMAIL = "lbcplaya@gmail.com";

function rowsOf(result: any): any[] {
  return Array.isArray(result?.rows) ? result.rows : Array.isArray(result) ? result : [];
}

async function secureAuctionAdmin(req: any, res: any, next: any) {
  const userId = String(req.authUserId || "");
  if (!userId) return res.status(401).json({ message: "Unauthorized" });
  const configuredIds = String(process.env.ADMIN_USER_IDS || "").split(",").map((value) => value.trim()).filter(Boolean);
  if (configuredIds.includes(userId)) return next();
  const configuredEmails = String(process.env.ADMIN_EMAILS || DEFAULT_ADMIN_EMAIL).split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
  const user = rowsOf(await db.execute(sql`SELECT lower(coalesce(email, '')) AS email FROM app.users WHERE id = ${userId} LIMIT 1`))[0];
  if (user?.email && configuredEmails.includes(String(user.email).toLowerCase())) return next();
  return res.status(403).json({ message: "Admin access required" });
}

function errorStatus(error: any) {
  const message = String(error?.message || "Auction operation failed");
  if (message.includes("not found")) return 404;
  if (message.includes("do not own") || message.includes("own auction")) return 403;
  if (
    message.includes("already") ||
    message.includes("not live") ||
    message.includes("has ended") ||
    message.includes("requires admin recovery") ||
    message.includes("cannot be cancelled") ||
    message.includes("require admin cancellation") ||
    message.includes("locked by another operation")
  ) return 409;
  if (
    message.includes("Valid ") ||
    message.includes("cannot be") ||
    message.includes("must be") ||
    message.includes("Insufficient") ||
    message.includes("not available") ||
    message.includes("has not started") ||
    message.includes("Common cards") ||
    message.includes("Remove the card")
  ) return 400;
  return 500;
}

export function registerAuctionsRoutes(app: Express, deps: RegisterAuctionsRoutesDeps) {
  const { requireAuth } = deps;
  const isAdmin = deps.isAdmin || secureAuctionAdmin;

  app.get("/api/auctions/active", async (_req, res) => {
    try {
      return res.json(await listActiveAuctions());
    } catch (error: any) {
      console.error("Failed to list active auctions:", error);
      return res.status(500).json({ message: error?.message || "Failed to fetch auctions" });
    }
  });

  app.get("/api/auctions/:id", async (req, res) => {
    try {
      const auctionId = Number(req.params.id);
      if (!Number.isInteger(auctionId) || auctionId <= 0) return res.status(400).json({ message: "Valid auction required" });
      const auction = await getAuctionDetails(auctionId);
      if (!auction) return res.status(404).json({ message: "Auction not found" });
      return res.json(auction);
    } catch (error: any) {
      console.error("Failed to fetch auction:", error);
      return res.status(500).json({ message: error?.message || "Failed to fetch auction" });
    }
  });

  app.post("/api/auctions/create", requireAuth, async (req: any, res) => {
    try {
      const auction = await createAuction({ ...req.body, sellerId: String(req.authUserId || "") });
      return res.json({ success: true, auction });
    } catch (error: any) {
      const status = errorStatus(error);
      if (status === 500) console.error("Failed to create auction:", error);
      return res.status(status).json({ message: String(error?.message || "Failed to create auction") });
    }
  });

  app.post("/api/auctions/:id/bid", requireAuth, async (req: any, res) => {
    try {
      const result = await placeAuctionBid({
        auctionId: Number(req.params.id),
        bidderId: String(req.authUserId || ""),
        amount: req.body?.amount,
        idempotencyKey: req.headers?.["x-idempotency-key"] || req.body?.idempotencyKey,
      });
      return res.json(result);
    } catch (error: any) {
      const status = errorStatus(error);
      if (status === 500) console.error("Failed to place auction bid:", error);
      return res.status(status).json({ message: String(error?.message || "Failed to place bid") });
    }
  });

  app.post("/api/auctions/:id/buy-now", requireAuth, async (req: any, res) => {
    try {
      const result = await buyAuctionNow({
        auctionId: Number(req.params.id),
        buyerId: String(req.authUserId || ""),
        idempotencyKey: req.headers?.["x-idempotency-key"] || req.body?.idempotencyKey,
      });
      if (result.success === false) return res.status(409).json(result);
      return res.json(result);
    } catch (error: any) {
      const status = errorStatus(error);
      if (status === 500) console.error("Failed to buy auction now:", error);
      return res.status(status).json({ message: String(error?.message || "Failed to buy now") });
    }
  });

  app.post("/api/auctions/:id/cancel", requireAuth, async (req: any, res) => {
    try {
      const userId = String(req.authUserId || "");
      const result = await cancelAuctionWithEscrowRecovery({
        auctionId: Number(req.params.id),
        actorId: userId,
        ownerId: userId,
        allowBids: false,
        reason: req.body?.reason,
      });
      return res.json(result);
    } catch (error: any) {
      const status = errorStatus(error);
      if (status === 500) console.error("Failed to cancel auction:", error);
      return res.status(status).json({ message: String(error?.message || "Failed to cancel auction") });
    }
  });

  app.post("/api/admin/auctions/:id/cancel", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const result = await cancelAuctionWithEscrowRecovery({
        auctionId: Number(req.params.id),
        actorId: String(req.authUserId || ""),
        allowBids: true,
        reason: req.body?.reason || req.body?.adminNotes,
      });
      return res.json(result);
    } catch (error: any) {
      const status = errorStatus(error);
      if (status === 500) console.error("Failed to cancel auction as admin:", error);
      return res.status(status).json({ message: String(error?.message || "Failed to cancel auction") });
    }
  });

  app.post("/api/auctions/:id/settle", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const result = await settleAuctionWithEscrowRecovery({
        auctionId: Number(req.params.id),
        actorId: String(req.authUserId || ""),
      });
      if (result.success === false) return res.status(409).json(result);
      return res.json(result);
    } catch (error: any) {
      const status = errorStatus(error);
      if (status === 500) console.error("Failed to settle auction:", error);
      return res.status(status).json({ message: String(error?.message || "Failed to settle auction") });
    }
  });

  app.get("/api/admin/auctions/escrow-integrity", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const auctionId = req.query?.auctionId ? Number(req.query.auctionId) : undefined;
      return res.json(await getAuctionEscrowIntegrityReport(auctionId));
    } catch (error: any) {
      console.error("Failed to inspect auction escrow:", error);
      return res.status(500).json({ message: error?.message || "Failed to inspect auction escrow" });
    }
  });

  app.post("/api/admin/auctions/:id/recover", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const result = await recoverAuctionEscrow({
        auctionId: Number(req.params.id),
        actorId: String(req.authUserId || ""),
      });
      return res.json(result);
    } catch (error: any) {
      const status = errorStatus(error);
      if (status === 500) console.error("Failed to recover auction escrow:", error);
      return res.status(status).json({ message: String(error?.message || "Failed to recover auction escrow") });
    }
  });
}
