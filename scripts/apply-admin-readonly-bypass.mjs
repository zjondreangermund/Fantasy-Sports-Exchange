import fs from "node:fs";

const file = "server/services/securityControl.ts";
let source = fs.readFileSync(file, "utf8");
let changed = false;

const helperMarker = "ADMIN_READ_ONLY_BYPASS_V1";
if (!source.includes(helperMarker)) {
  const anchor = `function requestUserId(req: any) {\n  return String(req.authUserId || req.user?.claims?.sub || req.user?.id || "");\n}\n\n`;
  if (!source.includes(anchor)) throw new Error("Could not locate requestUserId for admin Read-only bypass");
  const helper = `${anchor}const DEFAULT_ADMIN_READ_ONLY_EMAIL = "lbcplaya@gmail.com";\nconst READ_ONLY_ADMIN_USER_IDS = String(process.env.ADMIN_USER_IDS || "").split(",").map((value) => value.trim()).filter(Boolean);\nconst READ_ONLY_ADMIN_EMAILS = String(process.env.ADMIN_EMAILS || DEFAULT_ADMIN_READ_ONLY_EMAIL).split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);\n\n// ${helperMarker}\n// Read-only is a public maintenance control, not an Admin lockout. This check\n// uses the authenticated Passport session only; it does not trust client flags.\nexport function isPrivilegedAdminRequest(req: any): boolean {\n  const userId = requestUserId(req);\n  const email = String(req.user?.email || req.user?.claims?.email || "").trim().toLowerCase();\n  return Boolean((userId && READ_ONLY_ADMIN_USER_IDS.includes(userId)) || (email && READ_ONLY_ADMIN_EMAILS.includes(email)));\n}\n\n`;
  source = source.replace(anchor, helper);
  changed = true;
}

const middlewareMarker = "ADMIN_READ_ONLY_EFFECTIVE_SETTINGS_V1";
if (!source.includes(middlewareMarker)) {
  const anchor = `    const record = await getSecuritySettings();\n    const settings = record.settings;\n    const blockedBy = emergencyBlock(settings, req);`;
  if (!source.includes(anchor)) throw new Error("Could not locate securityControlMiddleware emergency block");
  const replacement = `    const record = await getSecuritySettings();\n    const settings = record.settings;\n    // ${middlewareMarker}\n    // Admin bypass removes only the global Read-only bit. Dedicated emergency\n    // switches (deposits, withdrawals, marketplace, auctions, auth) remain live.\n    const adminReadOnlyBypass = settings.emergency.readOnly && isPrivilegedAdminRequest(req);\n    const effectiveSettings: SecuritySettings = adminReadOnlyBypass\n      ? { ...settings, emergency: { ...settings.emergency, readOnly: false } }\n      : settings;\n    const blockedBy = emergencyBlock(effectiveSettings, req);`;
  source = source.replace(anchor, replacement);
  changed = true;
}

if (changed) {
  fs.writeFileSync(file, source);
  console.log("Applied authenticated Admin bypass for global Read-only mode.");
} else {
  console.log("Authenticated Admin Read-only bypass already applied.");
}
