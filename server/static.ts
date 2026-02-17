import express, { type Express } from "express";
import fs from "fs";
import path from "path";
export function serveStatic(app: Express) {
  const distPath = path.resolve(process.cwd(), "dist", "public");

  console.log(`Checking for build directory at: ${distPath}`);

  if (!fs.existsSync(distPath)) {
    const fallbackPath = path.resolve(process.cwd(), "public");
    if (fs.existsSync(path.resolve(fallbackPath, "index.html"))) {
       console.log(`Found build at fallback: ${fallbackPath}`);
       app.use(express.static(fallbackPath));
       // FIX: Use named wildcard for Express v5
       app.get("/*splat", (_req, res) => res.sendFile(path.resolve(fallbackPath, "index.html")));
       return;
    }

    throw new Error(`Could not find the build directory: ${distPath}. Build artifacts missing.`);
  }

  app.use(express.static(distPath));
  // FIX: Use named wildcard for Express v5
  app.get("/*splat", (_req, res) => res.sendFile(path.resolve(distPath, "index.html")));
}
