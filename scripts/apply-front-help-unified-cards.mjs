import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const write = (file, content) => fs.writeFileSync(path.join(root, file), content);

// An older guided-help generator still writes a local tooltip inside the floating
// support widget during npm check/build. Remove that copy after the generator has
// run, because the canonical GuidedHoverHelp component is portalled to body and
// deliberately sits above the sidebar, sheets, dialogs and fixed app chrome.
{
  const file = "client/src/components/FloatingSupportWidget.tsx";
  let source = read(file);

  source = source.replace(
    /\nfunction GuidedHoverHelp\(\) \{[\s\S]*?\n\}\n\n(?=function MarketplaceListingActivity\(\))/, 
    "\n",
  );
  source = source.replace("<GuidedHoverHelp/><MarketplaceListingActivity/>", "<MarketplaceListingActivity/>");
  source = source.replace("<GuidedHoverHelp />\n      <MarketplaceListingActivity />", "<MarketplaceListingActivity />");

  write(file, source);
}

// The main card compatibility component is intentionally the single gateway for
// older card pages. Fail immediately if a future build script restores the old
// CARD_THEMES renderer instead of the Collection profile-quality card engine.
{
  const file = "client/src/components/cards/PremiumFootballCard.tsx";
  const source = read(file);
  if (!source.includes('import CollectionStableCard from "./CollectionStableCard";')) {
    throw new Error("PremiumFootballCard no longer delegates to CollectionStableCard");
  }
  if (source.includes("CARD_THEMES")) {
    throw new Error("Old dull PremiumFootballCard theme renderer was restored");
  }
}

console.log("[cards/help] Kept one front-layer guided-help system and the Collection card engine across all card surfaces");
