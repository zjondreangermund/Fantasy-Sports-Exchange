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

  // Native WebView must revalidate the HTML shell after every deployment.
  // Hashed bundles still use the normal asset path and missing-asset 404 guard.
  app.use(express.static(distPath, { setHeaders(res, filePath) {
    if (filePath.endsWith("index.html") || filePath.endsWith("native-startup-recovery.js")) {
      res.setHeader("Cache-Control", "no-store");
    }
  } }));
  app.get("/assets/*assetPath", (req, res, next) => {
    const rel = String(req.params.assetPath || "");
    const absolute = path.resolve(distPath, "assets", rel);
    if (!absolute.startsWith(path.resolve(distPath, "assets"))) {
      return res.status(400).send("Bad asset path");
    }
    if (!fs.existsSync(absolute)) {
      return res.status(404).send("Asset not found");
    }
    return next();
  });
  // FIX: Use named wildcard for Express v5
  app.get("/*splat", (_req, res) => { res.setHeader("Cache-Control", "no-store"); res.sendFile(path.resolve(distPath, "index.html")); });
}
