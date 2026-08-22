#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const write = (file, text) => fs.writeFileSync(path.join(root, file), text, "utf8");

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one legacy anchor, found ${count}`);
  return source.replace(before, after);
}

// FPL is a fallback identity provider. A stored/current football position is a
// hard identity boundary: no exact-name or stored-id match may cross positions.
{
  const file = "server/services/fplPlayerIdentity.ts";
  let source = read(file);
  source = replaceRequired(
    source,
    `function playerMatchesElement(player: any, element: any): boolean {\n  const names = normalizedNames(player);`,
    `function normalizedPlayerPosition(value: unknown): FplPosition | "" {\n  const position = String(value || "").trim().toUpperCase();\n  return position === "GK" || position === "DEF" || position === "MID" || position === "FWD"\n    ? position as FplPosition\n    : "";\n}\n\nfunction positionCompatible(player: any, element: any): boolean {\n  const storedPosition = normalizedPlayerPosition(player?.position);\n  return !storedPosition || fplPlayerPosition(element) === storedPosition;\n}\n\nfunction playerMatchesElement(player: any, element: any): boolean {\n  if (!positionCompatible(player, element)) return false;\n  const names = normalizedNames(player);`,
    "FPL hard-position identity guard",
  );
  source = source.replace("// STRICT_PLAYER_IDENTITY_FIX_V2", "// STRICT_PLAYER_IDENTITY_FIX_V3_POSITION_LOCK");
  write(file, source);
}

// PR #231 already removed the API-Football cross-position name bypass. Keep the
// source position canonical too so malformed legacy strings do not become a new
// accidental hard filter.
{
  const file = "server/services/apiFootballPlayerDirectory.ts";
  let source = read(file);
  source = replaceRequired(
    source,
    `  const rawPosition = String(player?.position || "").toUpperCase();`,
    `  const storedPosition = String(player?.position || "").trim().toUpperCase();\n  const rawPosition = (["GK", "DEF", "MID", "FWD"] as const).includes(storedPosition as any)\n    ? storedPosition as CanonicalPlayerPosition\n    : "";`,
    "API-Football canonical source-position guard",
  );
  if (source.includes("rawPosition === row.candidate.position || row.nameScore >= 105")) {
    throw new Error("API-Football exact-name cross-position bypass has reappeared");
  }
  write(file, source);
}

// A card thumbnail already has the tournament/collection identity payload. The
// profile request may enrich it, but it must never visually replace the card with
// a different position. This prevents a GK card face and MID lineup label from
// being shown for the same owned card.
{
  const file = "client/src/components/cards/PremiumFootballCard.tsx";
  let source = read(file);
  source = replaceRequired(
    source,
    `    if (!data) return player;\n\n    return {\n      ...player,\n      name: data.player?.name || player.name,\n      team: data.player?.team || player.team,\n      club: data.player?.team || player.club,\n      position: data.player?.position || player.position,\n      totalPoints: data.stats?.totalPoints ?? player.totalPoints,\n      image: verifiedImage || player.image,\n      imageUrl: verifiedImage || player.imageUrl,\n      photo: verifiedImage || player.photo,\n      imageCandidates: verifiedImage ? [verifiedImage] : player.imageCandidates,\n      statsVerified: identityVerified ? true : player.statsVerified,\n      apiFootballId: data.player?.apiFootballId || (player as any).apiFootballId,\n    } as PlayerCardData;`,
    `    if (!data) return player;\n\n    const payloadPosition = String(player.position || "").trim().toUpperCase();\n    const profilePosition = String(data.player?.position || "").trim().toUpperCase();\n    const profilePositionMatches = !payloadPosition || !profilePosition || payloadPosition === profilePosition;\n    const useProfileIdentity = identityVerified && profilePositionMatches;\n\n    return {\n      ...player,\n      name: useProfileIdentity ? (data.player?.name || player.name) : player.name,\n      team: useProfileIdentity ? (data.player?.team || player.team) : player.team,\n      club: useProfileIdentity ? (data.player?.team || player.club) : player.club,\n      position: useProfileIdentity ? (data.player?.position || player.position) : player.position,\n      totalPoints: useProfileIdentity ? (data.stats?.totalPoints ?? player.totalPoints) : player.totalPoints,\n      image: useProfileIdentity ? (verifiedImage || player.image) : player.image,\n      imageUrl: useProfileIdentity ? (verifiedImage || player.imageUrl) : player.imageUrl,\n      photo: useProfileIdentity ? (verifiedImage || player.photo) : player.photo,\n      imageCandidates: useProfileIdentity && verifiedImage ? [verifiedImage] : player.imageCandidates,\n      statsVerified: useProfileIdentity ? true : player.statsVerified,\n      apiFootballId: useProfileIdentity ? (data.player?.apiFootballId || (player as any).apiFootballId) : (player as any).apiFootballId,\n    } as PlayerCardData;`,
    "Premium card profile/payload position consistency guard",
  );
  write(file, source);
}

// Defence in depth for the production startup reconciler. Even if a future
// provider resolver regresses, automatic metadata repair may never rewrite an
// already-known GK/DEF/MID/FWD player row into another position.
{
  const file = "scripts/reconcile-owned-premier-league-cards.mjs";
  let source = read(file);
  source = replaceRequired(
    source,
    `async function repairActivePlayer(client, playerId, identity, element) {\n  const canonicalPosition = positionOf(identity.position);\n  if (!canonicalPosition) throw new Error(\`Invalid official position for player \${playerId}\`);\n  const requestedFplId = element ? Number(element.id || 0) || null : null;`,
    `async function repairActivePlayer(client, playerId, identity, element) {\n  const canonicalPosition = positionOf(identity.position);\n  if (!canonicalPosition) throw new Error(\`Invalid official position for player \${playerId}\`);\n  const currentPlayer = rows(await client.query(\`\n    select position::text as position, name, team\n    from app.players where id=$1 limit 1\n  \`, [playerId]))[0];\n  const storedPosition = positionOf(currentPlayer?.position);\n  if (storedPosition && storedPosition !== canonicalPosition) {\n    console.warn(\n      \`PLAYER_POSITION_REPAIR_BLOCKED playerId=\${playerId}\`\n      + \` stored=\${storedPosition} provider=\${canonicalPosition}\`\n      + \` storedName=\"\${String(currentPlayer?.name || "")}\"\`\n      + \` providerName=\"\${String(identity?.name || "")}\"\`,\n    );\n    return 0;\n  }\n  const requestedFplId = element ? Number(element.id || 0) || null : null;`,
    "startup player position mutation guard",
  );
  write(file, source);
}

console.log("Strict player-position identity consistency applied across FPL, API-Football, card rendering and startup reconciliation.");
