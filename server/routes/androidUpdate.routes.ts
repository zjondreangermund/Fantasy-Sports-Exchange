import type { Express } from "express";

type AndroidRelease = {
  version: string;
  name: string;
  notes: string;
  assetUrl: string;
  size: number | null;
  digest: string | null;
};

const RELEASES_API = "https://api.github.com/repos/zjondreangermund/Fantasy-Sports-Exchange/releases?per_page=20";
const CACHE_MS = 5 * 60_000;
let releaseCache: { checkedAt: number; release: AndroidRelease | null } | null = null;

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

async function latestAndroidRelease(force = false): Promise<AndroidRelease | null> {
  if (!force && releaseCache && Date.now() - releaseCache.checkedAt < CACHE_MS) return releaseCache.release;

  const response = await fetch(RELEASES_API, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "Fantasy-Arena-Update-Service",
    },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Android release lookup returned ${response.status}`);

  const releases: any[] = await response.json();
  const candidates = (Array.isArray(releases) ? releases : [])
    .filter((release) => !release?.draft && !release?.prerelease)
    .map((release) => {
      const version = String(release?.tag_name || "").match(/^android-(\d+\.\d+\.\d+)$/i)?.[1];
      if (!version || !parseVersion(version)) return null;
      const asset = Array.isArray(release?.assets)
        ? release.assets.find((item: any) => String(item?.name || "").toLowerCase() === "fantasy-arena-android.apk")
        : null;
      if (!asset?.browser_download_url) return null;
      return {
        version,
        name: String(release?.name || `Fantasy Arena Android ${version}`),
        notes: String(release?.body || "").replace(/<!--.*?-->/gs, "").trim(),
        assetUrl: String(asset.browser_download_url),
        size: Number.isFinite(Number(asset?.size)) ? Number(asset.size) : null,
        digest: typeof asset?.digest === "string" ? asset.digest : null,
      } satisfies AndroidRelease;
    })
    .filter(Boolean) as AndroidRelease[];

  candidates.sort((a, b) => compareVersions(b.version, a.version));
  const release = candidates[0] || null;
  releaseCache = { checkedAt: Date.now(), release };
  return release;
}

export function registerAndroidUpdateRoutes(app: Express) {
  app.get("/api/android/releases/latest", async (_req, res) => {
    try {
      const release = await latestAndroidRelease();
      if (!release) return res.status(404).json({ message: "No Android release is available" });
      res.setHeader("Cache-Control", "no-store");
      return res.json({
        version: release.version,
        name: release.name,
        notes: release.notes,
        size: release.size,
        digest: release.digest,
        downloadPath: "/api/android/releases/latest.apk",
      });
    } catch (error: any) {
      console.error("Failed to resolve Android release metadata:", error);
      return res.status(502).json({ message: "Android update service is temporarily unavailable" });
    }
  });

  app.get("/api/android/releases/latest.apk", async (_req, res) => {
    try {
      const release = await latestAndroidRelease(true);
      if (!release) return res.status(404).send("No Android release is available");

      const response = await fetch(release.assetUrl, {
        headers: {
          Accept: "application/vnd.android.package-archive,application/octet-stream;q=0.9,*/*;q=0.1",
          "User-Agent": "Fantasy-Arena-Update-Service",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(45_000),
      });
      if (!response.ok) throw new Error(`Android APK fetch returned ${response.status}`);

      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length < 1024 * 1024 || bytes.length > 100 * 1024 * 1024) {
        throw new Error(`Android APK size failed validation (${bytes.length} bytes)`);
      }
      if (release.size && bytes.length !== release.size) {
        throw new Error(`Android APK is incomplete (${bytes.length}/${release.size} bytes)`);
      }
      // APKs are ZIP containers and must begin with the PK signature. Reject an
      // HTML/error page before it can ever reach Android's package parser.
      if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
        throw new Error("Android release response was not an APK archive");
      }

      res.status(200);
      res.setHeader("Content-Type", "application/vnd.android.package-archive");
      res.setHeader("Content-Length", String(bytes.length));
      res.setHeader("Content-Disposition", `attachment; filename="Fantasy-Arena-${release.version}.apk"`);
      res.setHeader("Cache-Control", "private, no-store, max-age=0");
      res.setHeader("X-Content-Type-Options", "nosniff");
      return res.end(bytes);
    } catch (error: any) {
      console.error("Failed to proxy Android release APK:", error);
      if (!res.headersSent) return res.status(502).send("Android update package is temporarily unavailable");
      return res.end();
    }
  });
}
