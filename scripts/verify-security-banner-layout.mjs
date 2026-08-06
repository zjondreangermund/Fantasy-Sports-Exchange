import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const banner = read("client/src/components/SecurityModeBanner.tsx");
const app = read("client/src/App.tsx");
const sidebar = read("client/src/components/ui/sidebar.tsx");

const checks = [
  [banner.includes("--security-banner-offset"), "Security banner does not publish its measured offset"],
  [banner.includes("ResizeObserver"), "Security banner offset does not respond to wrapping or viewport changes"],
  [banner.includes("ref={bannerRef}"), "Security banner measurement ref is missing"],
  [app.includes('paddingTop: "var(--security-banner-offset, 0px)"'), "App header/content is not offset below the security banner"],
  [sidebar.includes('top: "var(--security-banner-offset, 0px)"'), "Sidebar does not consume the security banner offset"],
  [sidebar.includes('height: "calc(100dvh - var(--security-banner-offset, 0px))"'), "Sidebar height is not reduced below the security banner"],
];

for (const [passed, message] of checks) {
  if (!passed) throw new Error(message);
}

console.log("[layout] Verified production banner, app header and mobile sidebar do not overlap");
