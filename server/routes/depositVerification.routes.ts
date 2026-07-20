import type { Express } from "express";
import {
  getDepositVerificationIntegrity,
  listDepositVerifications,
  reviewDepositVerification,
  submitDepositForVerification,
} from "../services/depositVerification.js";

interface RegisterDepositVerificationRoutesDeps {
  requireAuth: any;
  isAdmin: any;
}

function errorStatus(error: any) {
  const message = String(error?.message || "Deposit operation failed");
  if (message.includes("not found")) return 404;
  if (message.includes("already") || message.includes("claimed") || message.includes("does not match")) return 409;
  if (message.includes("Valid ") || message.includes("required") || message.includes("must be") || message.includes("changed wallet value")) return 400;
  return 500;
}

export function registerDepositVerificationRoutes(app: Express, deps: RegisterDepositVerificationRoutesDeps) {
  const { requireAuth, isAdmin } = deps;

  app.post("/api/wallet/deposit", requireAuth, async (req: any, res) => {
    try {
      const result = await submitDepositForVerification({
        userId: String(req.authUserId || ""),
        amount: req.body?.amount,
        paymentMethod: req.body?.paymentMethod,
        externalTransactionId: req.body?.externalTransactionId,
      });
      return res.json({
        success: true,
        pending: result.verification?.status === "pending",
        message: result.duplicate ? "Deposit submission already recorded" : "Deposit submitted for verification",
        ...result,
      });
    } catch (error: any) {
      const status = errorStatus(error);
      if (status === 500) console.error("Failed to submit deposit verification:", error);
      return res.status(status).json({ message: String(error?.message || "Failed to submit deposit") });
    }
  });

  app.get("/api/admin/deposits", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const verifications = await listDepositVerifications({ status: req.query?.status, limit: req.query?.limit });
      return res.json({ verifications, total: verifications.length });
    } catch (error: any) {
      console.error("Failed to list deposit verifications:", error);
      return res.status(500).json({ message: error?.message || "Failed to list deposit verifications" });
    }
  });

  app.post("/api/admin/deposits/:id/status", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const result = await reviewDepositVerification({
        verificationId: Number(req.params.id),
        adminId: String(req.authUserId || ""),
        decision: req.body?.status,
        adminNotes: req.body?.adminNotes,
      });
      return res.json({ success: true, ...result });
    } catch (error: any) {
      const status = errorStatus(error);
      if (status === 500) console.error("Failed to review deposit verification:", error);
      return res.status(status).json({ message: String(error?.message || "Failed to review deposit") });
    }
  });

  app.get("/api/admin/deposits/integrity", requireAuth, isAdmin, async (_req: any, res) => {
    try {
      return res.json(await getDepositVerificationIntegrity());
    } catch (error: any) {
      console.error("Failed to inspect deposit verification integrity:", error);
      return res.status(500).json({ message: error?.message || "Failed to inspect deposit integrity" });
    }
  });
}
