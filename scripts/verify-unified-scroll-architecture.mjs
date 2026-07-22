#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const failures = [];

function expect(condition, message) {
  if (!condition) failures.push(message);
}

function includesAll(source, values, label) {
  for (const value of values) expect(source.includes(value), `${label} is missing: ${value}`);
}

const main = read("client/src/main.tsx");
const app = read("client/src/App.tsx");
const unified = read("client/src/unified-scroll.css");
const hook = read("client/src/hooks/use-scroll-repair.ts");
const liveShell = read("client/src/components/layout/LivePageShell.tsx");
const premiumShell = read("client/src/components/premium/PremiumShell.tsx");
const table = read("client/src/components/ui/table.tsx");
const dialog = read("client/src/components/ui/dialog.tsx");
const serviceWorker = read("client/public/sw.js");

includesAll(main, ['import "./unified-scroll.css"', '"fantasy-site-v8"'], "Client entry point");
for (const legacy of [
  'import "./mobile-polish.css"',
  'import "./mobile-scroll-fix.css"',
  'import "./mobile-native-scroll.css"',
  'import "./play-route-fix.css"',
]) {
  expect(!main.includes(legacy), `Client entry point must not import conflicting legacy scroll authority: ${legacy}`);
}

includesAll(app, [
  'className="h-[100dvh] min-h-0 overflow-hidden"',
  "data-app-scroll-root",
  "data-page-scroll-content",
  'data-fixed-docks={isInfoRoute ? "false" : "true"}',
  "app-page-content min-w-0 flex-none",
], "Application shell");
expect((app.match(/data-app-scroll-root/g) || []).length === 1, "Application shell must expose exactly one page-level scroll root");
expect(!app.includes('pb-[calc(7rem+env(safe-area-inset-bottom,0px))]'), "Application shell must not duplicate fixed-dock bottom padding");
expect(!app.includes('className="sticky top-0'), "Header must live outside the scroller instead of using sticky positioning inside it");

includesAll(unified, [
  "html.app-scroll-locked",
  "html.app-scroll-locked body",
  "padding: 0 !important",
  ".app-scroll-root",
  "[data-app-scroll-root]",
  "overflow-y: auto !important",
  "[data-page-scroll-content]",
  '[data-fixed-docks="true"]',
  "10.5rem",
  "[data-scroll-region=\"true\"]",
  "[role=\"dialog\"]",
  "touch-action: pan-x pan-y !important",
], "Unified scroll stylesheet");
expect(!/^html,\s*\nbody,\s*\n#root\s*\{[^}]*overflow:\s*hidden/im.test(unified), "Public document scrolling must not be globally locked without app-scroll-locked");
expect(unified.includes("[data-page-scroll-content] > :where(main, section, article, div)"), "Direct page roots must be neutralized as nested vertical scrollers");

includesAll(hook, [
  'classList.add("app-scroll-locked")',
  'classList.remove("app-scroll-locked")',
  "getRoot()?.scrollTo",
  "useLayoutEffect",
], "Scroll lifecycle hook");
expect(!hook.includes("window.scrollTo"), "Authenticated route changes must reset the app scroll root, not the document");
expect(!hook.includes("document.body.style"), "Scroll lifecycle must not mutate body inline overflow styles");
expect(!hook.includes("document.documentElement.style"), "Scroll lifecycle must use a scoped class instead of document inline style repair");

expect(!liveShell.includes("flex-1 overflow-auto"), "LivePageShell must not create a nested page scrollbar");
expect(liveShell.includes("live-page-shell relative min-h-full"), "LivePageShell must grow naturally inside the app scroll root");
expect(!premiumShell.includes("10rem"), "PremiumPage must not duplicate mobile dock clearance");
expect(!premiumShell.includes("5rem+env"), "PremiumPage inner content must not duplicate bottom padding");
expect(premiumShell.includes("premium-page relative min-h-full overflow-x-hidden px-3 pb-6"), "PremiumPage must use natural height and modest page padding");

includesAll(table, [
  'overflow-x-auto overflow-y-clip',
  'data-mobile-x-scroll="true"',
], "Shared table wrapper");
expect(!table.includes('className="relative w-full overflow-auto"'), "Shared table wrapper must not own an unbounded vertical scrollbar");

includesAll(dialog, [
  "max-h-[calc(100dvh-1.5rem)]",
  "overflow-y-auto",
  "overscroll-contain",
], "Shared dialog");

expect(serviceWorker.includes('const CACHE_NAME = "fantasy-site-v8"'), "Service worker cache must invalidate legacy scroll bundles");

if (failures.length) {
  console.error("Unified scrolling architecture verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Unified page scrolling, mobile dock clearance, horizontal overflow and modal scrolling verified.");
