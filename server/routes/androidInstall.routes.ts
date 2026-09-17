import type { Express } from "express";
import { createHash } from "node:crypto";

const ANDROID_VERSION = "1.1.10";
const APK_URL = "https://github.com/zjondreangermund/Fantasy-Sports-Exchange/releases/download/android-1.1.10/Fantasy-Arena-Android.apk";
const APK_SHA256 = "3335e5558cc1756d7d9e223d9c2f2f5bf621075f86e58f75b53931028085f040";
const MAX_APK_BYTES = 50 * 1024 * 1024;

export function registerAndroidInstallRoutes(app: Express) {
  app.get("/api/android/install-apk", async (req: any, res) => {
    try {
      const requestedVersion = String(req.query?.version || ANDROID_VERSION).trim();
      if (requestedVersion !== ANDROID_VERSION) {
        return res.status(404).json({ message: "Android release not found" });
      }

      const upstream = await fetch(APK_URL, {
        redirect: "follow",
        headers: { "User-Agent": "Fantasy-Arena-Android-Install" },
        signal: AbortSignal.timeout(30_000),
      });
      if (!upstream.ok) throw new Error(`Android APK download returned ${upstream.status}`);

      const advertisedLength = Number(upstream.headers.get("content-length") || 0);
      if (advertisedLength > MAX_APK_BYTES) throw new Error("Android APK is unexpectedly large");

      const apk = Buffer.from(await upstream.arrayBuffer());
      if (
        apk.length < 4 ||
        apk.length > MAX_APK_BYTES ||
        apk[0] !== 0x50 ||
        apk[1] !== 0x4b ||
        apk[2] !== 0x03 ||
        apk[3] !== 0x04
      ) {
        throw new Error("Downloaded Android package is not a valid APK archive");
      }

      const digest = createHash("sha256").update(apk).digest("hex");
      if (digest !== APK_SHA256) {
        throw new Error("Android APK integrity verification failed");
      }

      res.setHeader("Content-Type", "application/vnd.android.package-archive");
      res.setHeader("Content-Disposition", `attachment; filename="Fantasy-Arena-${ANDROID_VERSION}.apk"`);
      res.setHeader("Content-Length", String(apk.length));
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("X-Fantasy-Arena-Version", ANDROID_VERSION);
      res.setHeader("X-Fantasy-Arena-SHA256", digest);
      return res.status(200).send(apk);
    } catch (error: any) {
      console.error("Failed to serve verified Fantasy Arena APK:", error);
      return res.status(502).json({ message: "Fantasy Arena Android download is temporarily unavailable" });
    }
  });
}
