import type { Express } from "express";
import {
  getWithdrawalIntegrityReport,
  listAdminWithdrawals,
  listUserWithdrawals,
  recoverWithdrawal,
  reviewWithdrawal,
  submitWithdrawalRequest,
} from "../services/withdrawalPayout.js";

interface RegisterWithdrawalPayoutRoutesDeps {
  requireAuth: any;
  isAdmin: any;
}

function errorStatus(error: any) {
  const message = String(error?.message || "Withdrawal operation failed");
  if (message.includes("not found")) return 404;
  if (
    message.includes("already") ||
    message.includes("reused") ||
    message.includes("does not match") ||
    message.includes("could not be") ||
    message.includes("must be approved") ||
    message.includes("cannot be")
  ) return 409;
  if (
    message.includes("Valid ") ||
    message.includes("required") ||
    message.includes("Minimum") ||
    message.includes("Insufficient") ||
    message.includes("missing") ||
    message.includes("invalid") ||
    message.includes("too small")
  ) return 400;
  return 500;
}

export function registerWithdrawalPayoutRoutes(app: Express, deps: RegisterWithdrawalPayoutRoutesDeps) {
  const { requireAuth, isAdmin } = deps;

  app.get("/api/wallet/withdrawals", requireAuth, async (req: any, res) => {
    try {
      return res.json(await listUserWithdrawals(String(req.authUserId || "")));
    } catch (error: any) {
      console.error("Failed to list user withdrawals:", error);
      return res.status(500).json({ message: error?.message || "Failed to load withdrawals" });
    }
  });

  app.post("/api/wallet/withdraw", requireAuth, async (req: any, res) => {
    try {
      const result = await submitWithdrawalRequest({
        ...req.body,
        userId: String(req.authUserId || ""),
        idempotencyKey: req.headers?.["x-idempotency-key"] || req.body?.idempotencyKey,
      });
      return res.json({
        success: true,
        message: result.duplicate ? "Withdrawal request already recorded" : "Withdrawal request submitted",
        ...result,
      });
    } catch (error: any) {
      const status = errorStatus(error);
      if (status === 500) console.error("Failed to submit withdrawal:", error);
      return res.status(status).json({ message: String(error?.message || "Failed to submit withdrawal") });
    }
  });

  app.get("/api/admin/withdrawals", requireAuth, isAdmin, async (req: any, res) => {
    try {
      return res.json(await listAdminWithdrawals({ status: req.query?.status, limit: req.query?.limit }));
    } catch (error: any) {
      console.error("Failed to list admin withdrawals:", error);
      return res.status(500).json({ message: error?.message || "Failed to list withdrawals" });
    }
  });

  app.post("/api/admin/withdrawals/:id/status", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const result = await reviewWithdrawal({
        withdrawalId: Number(req.params.id),
        adminId: String(req.authUserId || ""),
        status: req.body?.status,
        adminNotes: req.body?.adminNotes,
        payoutReference: req.body?.payoutReference,
        failureReason: req.body?.failureReason,
      });
      return res.json({ success: true, ...result });
    } catch (error: any) {
      const status = errorStatus(error);
      if (status === 500) console.error("Failed to review withdrawal:", error);
      return res.status(status).json({ message: String(error?.message || "Failed to review withdrawal") });
    }
  });

  app.get("/api/admin/withdrawals/integrity", requireAuth, isAdmin, async (_req: any, res) => {
    try {
      return res.json(await getWithdrawalIntegrityReport());
    } catch (error: any) {
      console.error("Failed to inspect withdrawal integrity:", error);
      return res.status(500).json({ message: error?.message || "Failed to inspect withdrawal integrity" });
    }
  });

  app.post("/api/admin/withdrawals/:id/recover", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const result = await recoverWithdrawal({
        withdrawalId: Number(req.params.id),
        adminId: String(req.authUserId || ""),
        action: req.body?.action,
        adminNotes: req.body?.adminNotes,
        payoutReference: req.body?.payoutReference,
      });
      return res.json({ success: true, ...result });
    } catch (error: any) {
      const status = errorStatus(error);
      if (status === 500) console.error("Failed to recover withdrawal:", error);
      return res.status(status).json({ message: String(error?.message || "Failed to recover withdrawal") });
    }
  });
}
