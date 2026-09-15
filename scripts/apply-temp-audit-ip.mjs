import fs from "node:fs";

const path = "server/routes/auth.routes.ts";
let source = fs.readFileSync(path, "utf8");

const tokenBefore = `      if (!expectedToken || !suppliedToken || !safeEqualText(suppliedToken, expectedToken)) {\n        return res.status(401).json({ message: "Unauthorized" });\n      }`;

const tokenAfter = `      const allowedIp = String(process.env.TEMP_AUDIT_ALLOWED_IP || "").trim();\n      const forwardedIp = String(req.get?.("x-forwarded-for") || "").split(",")[0].trim();\n      const remoteIp = String(req.socket?.remoteAddress || "").replace(/^::ffff:/, "");\n      const tokenAuthorized = Boolean(expectedToken && suppliedToken && safeEqualText(suppliedToken, expectedToken));\n      const ipAuthorized = Boolean(allowedIp && (forwardedIp === allowedIp || remoteIp === allowedIp));\n      if (!tokenAuthorized && !ipAuthorized) {\n        return res.status(401).json({ message: "Unauthorized" });\n      }`;

if (source.includes(tokenAfter)) {
  console.log("[temp-audit] token/IP gate already applied");
} else if (source.includes(tokenBefore)) {
  source = source.replace(tokenBefore, tokenAfter);
  console.log("[temp-audit] applied token/IP gate");
} else {
  throw new Error("Temporary audit authorization patch anchor not found; refusing to modify auth route");
}

const userBefore = `        const { storage } = await import("../storage.js");\n        const user: any = await storage.getUser(userId);\n        if (!user) return res.status(404).json({ message: "Configured audit user was not found" });`;

const userAfter = `        const { storage } = await import("../storage.js");\n        let user: any = await storage.getUser(userId);\n        if (!user && userId === "demo-buyer-1") {\n          user = await storage.createUser({ id: userId, email: "audit-preview@local.test", name: "Fantasy Arena Preview" });\n          const wallet = await storage.getWallet(userId);\n          if (!wallet) await storage.createWallet({ userId, balance: 0, lockedBalance: 0 } as any);\n        }\n        if (!user) return res.status(404).json({ message: "Configured audit user was not found" });`;

if (source.includes(userAfter)) {
  console.log("[temp-audit] isolated user provisioning already applied");
} else if (source.includes(userBefore)) {
  source = source.replace(userBefore, userAfter);
  console.log("[temp-audit] applied isolated user provisioning");
} else {
  throw new Error("Temporary audit user patch anchor not found; refusing to modify auth route");
}

fs.writeFileSync(path, source);
