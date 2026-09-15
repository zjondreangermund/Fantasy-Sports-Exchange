import fs from "node:fs";

const path = "server/routes/auth.routes.ts";
let source = fs.readFileSync(path, "utf8");

const before = `      if (!expectedToken || !suppliedToken || !safeEqualText(suppliedToken, expectedToken)) {\n        return res.status(401).json({ message: "Unauthorized" });\n      }`;

const after = `      const allowedIp = String(process.env.TEMP_AUDIT_ALLOWED_IP || "").trim();\n      const forwardedIp = String(req.get?.("x-forwarded-for") || "").split(",")[0].trim();\n      const remoteIp = String(req.socket?.remoteAddress || "").replace(/^::ffff:/, "");\n      const tokenAuthorized = Boolean(expectedToken && suppliedToken && safeEqualText(suppliedToken, expectedToken));\n      const ipAuthorized = Boolean(allowedIp && (forwardedIp === allowedIp || remoteIp === allowedIp));\n      if (!tokenAuthorized && !ipAuthorized) {\n        return res.status(401).json({ message: "Unauthorized" });\n      }`;

if (source.includes(after)) {
  console.log("[temp-audit-ip] already applied");
} else if (source.includes(before)) {
  source = source.replace(before, after);
  fs.writeFileSync(path, source);
  console.log("[temp-audit-ip] applied IP-gated audit access");
} else {
  throw new Error("Temporary audit patch anchor not found; refusing to modify auth route");
}
