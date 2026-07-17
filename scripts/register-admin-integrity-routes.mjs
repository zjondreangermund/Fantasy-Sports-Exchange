import fs from "node:fs";

const path = "server/routes/admin.routes.ts";
let source = fs.readFileSync(path, "utf8");

const importLine = 'import { registerAdminIntegrityRoutes } from "./adminIntegrity.routes.js";';
if (!source.includes(importLine)) {
  source = source.replace('import { sql } from "drizzle-orm";', 'import { sql } from "drizzle-orm";\n' + importLine);
}

const marker = '  const { requireAuth, isAdmin, isAdminUser } = deps;';
const registration = marker + '\n  registerAdminIntegrityRoutes(app, { requireAuth, isAdmin });';
if (!source.includes('registerAdminIntegrityRoutes(app, { requireAuth, isAdmin });')) {
  source = source.replace(marker, registration);
}

fs.writeFileSync(path, source);
console.log("Registered admin integrity routes.");
