import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const write = (file, content) => fs.writeFileSync(path.join(root, file), content);

function replaceOnce(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`Production/Collection patch anchor not found: ${label}`);
  return source.replace(from, to);
}

const PUBLIC_PREVIEW_MESSAGE = "Production preview · Read-only mode. Trading, wallet actions, tournament entries and auction bids are paused until launch controls are opened.";
const OLD_SECURITY_MESSAGE = "Fantasy Arena is temporarily restricted while the security team completes checks.";

// Do not show a second blocked-action popup for global Read-only mode. The fixed
// Production preview banner is the single source of truth for that state.
{
  const file = "client/src/lib/api-base.ts";
  let source = read(file);
  const anchor = `  if (!response.ok) {
    const code = String(payload?.code || "");`;
  const replacement = `  if (!response.ok) {
    const code = String(payload?.code || "");
    if (code === "read_only") return;`;
  source = replaceOnce(source, anchor, replacement, "suppress duplicate read-only action toast");
  write(file, source);
}

// Remove the old security-team wording from client fallbacks.
{
  const file = "client/src/lib/security-mode.ts";
  let source = read(file);
  source = source.replaceAll(OLD_SECURITY_MESSAGE, PUBLIC_PREVIEW_MESSAGE);
  write(file, source);
}

// Remove the old wording from server defaults as well.
{
  const file = "server/services/securityControl.ts";
  let source = read(file);
  source = source.replaceAll(OLD_SECURITY_MESSAGE, PUBLIC_PREVIEW_MESSAGE);
  write(file, source);
}

// Public clients always receive the production-preview wording, even when an
// older custom message remains stored in the security settings row.
{
  const file = "server/routes/securityAdmin.routes.ts";
  let source = read(file);
  source = replaceOnce(
    source,
    "        message: record.settings.emergency.message,",
    `        message: ${JSON.stringify(PUBLIC_PREVIEW_MESSAGE)},`,
    "public security status message",
  );
  write(file, source);
}

// Read-only blocked responses use the same production-preview wording so old
// persisted text can no longer appear in buttons, errors or mobile notices.
{
  const file = "server/services/readOnlyGuard.ts";
  let source = read(file);
  source = replaceOnce(
    source,
    '  if (reason === "read_only") return settings.emergency.message || "Fantasy Arena is currently in view-only mode.";',
    `  if (reason === "read_only") return ${JSON.stringify(PUBLIC_PREVIEW_MESSAGE)};`,
    "read-only guard public message",
  );
  write(file, source);
}

// Collection now uses the exact profile-style card renderer and verified profile
// image payload rather than the older, flatter PremiumFootballCard renderer.
{
  const file = "client/src/pages/collection-clean.tsx";
  let source = read(file);
  source = source.replace('import { toFantasyCardData } from "../lib/fantasy-card-adapter";\n', "");
  source = replaceOnce(
    source,
    'import { PremiumFootballCard } from "../components/cards";',
    'import CollectionProfileCard from "../components/cards/CollectionProfileCard";',
    "Collection profile-card import",
  );
  source = source.replace('const fantasyCard = toFantasyCardData(card, { imageWidth: 540 }); ', "");
  source = replaceOnce(
    source,
    '<PremiumFootballCard player={fantasyCard} selected={isSelected} onClick={() => handleCardTap(card)} showPrice={Boolean(card.forSale)} size="sm" />',
    '<CollectionProfileCard card={card} selected={isSelected} onClick={() => handleCardTap(card)} showPrice={Boolean(card.forSale)} />',
    "Collection card renderer",
  );
  write(file, source);
}

console.log("[collection] Applied single production message and profile-quality Collection cards");
