import type { Express } from "express";
import { createHash } from "node:crypto";

const RELEASES_API = "https://api.github.com/repos/zjondreangermund/Fantasy-Sports-Exchange/releases?per_page=20";
const PUBLIC_APK_ROUTE = "https://playfantasyarena.com/api/android/update/apk";
const RELEASE_CACHE_MS = 5 * 60_000;
const MAX_APK_BYTES = 50 * 1024 * 1024;

type AndroidRelease = {
  version: string;
  title: string;
  notes: string;
  assetUrl: string;
  sha256: string | null;
  size: number | null;
};

let releaseCache: { checkedAt: number; releases: AndroidRelease[] } | null = null;

function parseVersion(value: unknown): number[] | null {
  const match = String(value || "").match(/^(\d+)\.(\d+)\.(\d+)$/);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

function compareVersions(left: string, right: string) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  if (!a || !b) return 0;
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] > b[index] ? 1 : -1;
  }
  return 0;
}

function cleanDigest(value: unknown): string | null {
  const match = String(value || "").toLowerCase().match(/^sha256:([a-f0-9]{64})$/);
  return match?.[1] || null;
}

async function loadAndroidReleases(): Promise<AndroidRelease[]> {
  if (releaseCache && Date.now() - releaseCache.checkedAt < RELEASE_CACHE_MS) return releaseCache.releases;

  const response = await fetch(RELEASES_API, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "Fantasy-Arena-Android-Updater",
    },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Android release lookup returned ${response.status}`);

  const payload: any[] = await response.json();
  const releases = (Array.isArray(payload) ? payload : [])
    .filter((release) => !release?.draft && !release?.prerelease)
    .map((release): AndroidRelease | null => {
      const version = String(release?.tag_name || "").match(/^android-(\d+\.\d+\.\d+)$/i)?.[1];
      if (!version || !parseVersion(version)) return null;
      const asset = Array.isArray(release?.assets)
        ? release.assets.find((item: any) => String(item?.name || "").toLowerCase() === "fantasy-arena-android.apk")
        : null;
      if (!asset?.browser_download_url) return null;
      return {
        version,
        title: String(release?.name || `Fantasy Arena Android ${version}`),
        notes: String(release?.body || "").replace(/<!--.*?-->/gs, "").trim(),
        assetUrl: String(asset.browser_download_url),
        sha256: cleanDigest(asset?.digest),
        size: Number.isFinite(Number(asset?.size)) ? Number(asset.size) : null,
      };
    })
    .filter(Boolean) as AndroidRelease[];

  releases.sort((a, b) => compareVersions(b.version, a.version));
  releaseCache = { checkedAt: Date.now(), releases };
  return releases;
}

function publicRelease(release: AndroidRelease) {
  return {
    version: release.version,
    title: release.title,
    notes: release.notes,
    sha256: release.sha256,
    size: release.size,
    downloadUrl: `${PUBLIC_APK_ROUTE}?version=${encodeURIComponent(release.version)}`,
  };
}

export function registerAndroidUpdateRoutes(app: Express) {
  app.get("/api/android/update", async (req: any, res) => {
    try {
      const releases = await loadAndroidReleases();
      const latest = releases[0] || null;
      if (!latest) return res.status(503).json({ message: "Android update metadata is temporarily unavailable" });

      const currentVersion = String(req.query?.currentVersion || "").trim();
      const updateAvailable = Boolean(parseVersion(currentVersion) && compareVersions(latest.version, currentVersion) > 0);
      res.setHeader("Cache-Control", "no-store");
      return res.json({
        updateAvailable,
        currentVersion: parseVersion(currentVersion) ? currentVersion : null,
        latest: publicRelease(latest),
      });
    } catch (error: any) {
      console.error("Failed to load Android update metadata:", error);
      return res.status(502).json({ message: "Android update metadata is temporarily unavailable" });
    }
  });

  app.get("/api/android/update/apk", async (req: any, res) => {
    try {
      const version = String(req.query?.version || "").trim();
      if (!parseVersion(version)) return res.status(400).json({ message: "A valid Android version is required" });

      const releases = await loadAndroidReleases();
      const release = releases.find((candidate) => candidate.version === version);
      if (!release) return res.status(404).json({ message: "Android release not found" });

      const upstream = await fetch(release.assetUrl, {
        redirect: "follow",
        headers: { "User-Agent": "Fantasy-Arena-Android-Updater" },
        signal: AbortSignal.timeout(30_000),
      });
      if (!upstream.ok) throw new Error(`Android APK download returned ${upstream.status}`);

      const lengthHeader = Number(upstream.headers.get("content-length") || 0);
      if (lengthHeader > MAX_APK_BYTES) throw new Error("Android APK is unexpectedly large");

      const apk = Buffer.from(await upstream.arrayBuffer());
      if (apk.length < 4 || apk.length > MAX_APK_BYTES || apk[0] !== 0x50 || apk[1] !== 0x4b || apk[2] !== 0x03 || apk[3] !== 0x04) {
        throw new Error("Downloaded Android package is not a valid APK archive");
      }

      const sha256 = createHash("sha256").update(apk).digest("hex");
      if (release.sha256 && sha256 !== release.sha256) {
        throw new Error("Android APK integrity verification failed");
      }

      res.setHeader("Content-Type", "application/vnd.android.package-archive");
      res.setHeader("Content-Disposition", `attachment; filename=\"Fantasy-Arena-${version}.apk\"`);
      res.setHeader("Content-Length", String(apk.length));
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Cache-Control", "public, max-age=300");
      res.setHeader("X-Fantasy-Arena-Version", version);
      res.setHeader("X-Fantasy-Arena-SHA256", sha256);
      return res.status(200).send(apk);
    } catch (error: any) {
      console.error("Failed to proxy Android APK:", error);
      return res.status(502).json({ message: "Android update download is temporarily unavailable" });
    }
  });
}
