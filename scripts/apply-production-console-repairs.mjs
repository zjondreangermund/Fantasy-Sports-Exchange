import fs from "node:fs";

function patchFile(path, transform, required = []) {
  const before = fs.readFileSync(path, "utf8");
  const after = transform(before);
  for (const token of required) {
    if (!after.includes(token)) throw new Error(`[production-console-repairs] ${path} missing required token: ${token}`);
  }
  if (after !== before) {
    fs.writeFileSync(path, after);
    console.log(`[production-console-repairs] patched ${path}`);
  } else {
    console.log(`[production-console-repairs] ${path} already ready`);
  }
}

// Keep the production CSP strict, but explicitly allow the two Google Fonts
// origins that the client stylesheet actually uses. Do not add unsafe-eval;
// browser-extension content scripts are not part of Fantasy Arena.
patchFile("server/services/securityControl.ts", (original) => {
  if (original.includes("https://fonts.googleapis.com") && original.includes("https://fonts.gstatic.com")) return original;
  const oldPolicy = "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data: blob: https:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' https: wss:; frame-src 'none'";
  const newPolicy = "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data: blob: https:; font-src 'self' data: https://fonts.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com; script-src 'self'; connect-src 'self' https: wss:; frame-src 'none'";
  if (!original.includes(oldPolicy)) throw new Error("[production-console-repairs] CSP policy anchor not found");
  return original.replace(oldPolicy, newPolicy);
}, ["https://fonts.googleapis.com", "https://fonts.gstatic.com", "script-src 'self'"]);

// The current Premier League web experience reliably exposes the portrait-sized
// 110x140 asset path. Prefer that path instead of generating 250x250 as the first
// FPL fallback, which can legitimately 404 for some current players.
patchFile("server/services/fplApi.ts", (original) => {
  let source = original;
  source = source.replace(
    '    const dimensions = size === 110 ? "110x140" : "250x250";',
    '    const dimensions = "110x140"; // CURRENT_PL_PLAYER_PHOTO_PRIMARY_V2',
  );
  source = source.replace(
    '    return `https://resources.premierleague.com/premierleague/photos/players/${dimensions}/p${id}.png`;',
    '    return `https://resources.premierleague.com/premierleague25/photos/players/${dimensions}/${id}.png`; // CURRENT_PL_PLAYER_PHOTO_PATH_V2',
  );
  source = source.replace(
    '    return `https://resources.premierleague.com/premierleague25/photos/players/${dimensions}/${id}.png`; // CURRENT_PL_PLAYER_PHOTO_PATH',
    '    return `https://resources.premierleague.com/premierleague25/photos/players/${dimensions}/${id}.png`; // CURRENT_PL_PLAYER_PHOTO_PATH_V2',
  );
  return source;
}, ["CURRENT_PL_PLAYER_PHOTO_PRIMARY_V2", "CURRENT_PL_PLAYER_PHOTO_PATH_V2", "110x140"]);

patchFile("client/src/lib/card-image.ts", (original) => {
  let source = original;
  source = source.replace(
    '  return `https://resources.premierleague.com/premierleague/photos/players/250x250/p${match[1]}.png`;',
    '  return `https://resources.premierleague.com/premierleague25/photos/players/110x140/${match[1]}.png`; // CURRENT_PL_PLAYER_PHOTO_PATH_V2',
  );
  source = source.replace(
    '  return `https://resources.premierleague.com/premierleague25/photos/players/250x250/${match[1]}.png`; // CURRENT_PL_PLAYER_PHOTO_PATH',
    '  return `https://resources.premierleague.com/premierleague25/photos/players/110x140/${match[1]}.png`; // CURRENT_PL_PLAYER_PHOTO_PATH_V2',
  );
  return source;
}, ["CURRENT_PL_PLAYER_PHOTO_PATH_V2", "premierleague25/photos/players/110x140"]);

patchFile("server/index.ts", (original) => {
  if (original.includes("CURRENT_PL_PLAYER_PHOTO_FALLBACKS_V2")) return original;
  let source = original;

  const originalBlock = `  const urlsToTry = [target.toString()];\n  const codeMatch = target.pathname.match(/\\/players\\/(?:\\d+x\\d+)\\/p(\\d+)\\.(?:png|jpg|jpeg|webp)$/i);\n  if (codeMatch?.[1]) {\n    const code = codeMatch[1];\n    for (const size of ["500x500", "250x250", "110x110", "40x40"]) urlsToTry.push(\`https://resources.premierleague.com/premierleague/photos/players/\${size}/p\${code}.png\`);\n  }`;

  const v1Block = `  const urlsToTry = [target.toString()];\n  // CURRENT_PL_PLAYER_PHOTO_FALLBACKS: the official PL CDN moved current player\n  // portraits from /premierleague/.../p<code>.png to /premierleague25/.../<code>.png.\n  // Try current assets first, then tolerate older cached/stored URLs.\n  const codeMatch = target.pathname.match(/\\/players\\/(?:\\d+x\\d+)\\/p?(\\d+)\\.(?:png|jpg|jpeg|webp)$/i);\n  if (codeMatch?.[1]) {\n    const code = codeMatch[1];\n    for (const size of ["500x500", "250x250", "110x140", "110x110", "40x40"]) {\n      urlsToTry.push(\`https://resources.premierleague.com/premierleague25/photos/players/\${size}/\${code}.png\`);\n      urlsToTry.push(\`https://resources.premierleague.com/premierleague/photos/players/\${size}/p\${code}.png\`);\n    }\n  }`;

  const v2Block = `  // CURRENT_PL_PLAYER_PHOTO_FALLBACKS_V2\n  // Prefer the portrait size used by the current PL/FPL experience. A stored\n  // 250x250 URL can 404 even when the same current player has a healthy 110x140\n  // portrait, so canonical current assets are attempted before the raw request.\n  const codeMatch = target.pathname.match(/\\/players\\/(?:\\d+x\\d+)\\/p?(\\d+)\\.(?:png|jpg|jpeg|webp)$/i);\n  const urlsToTry: string[] = [];\n  if (codeMatch?.[1] && target.hostname === "resources.premierleague.com") {\n    const code = codeMatch[1];\n    for (const size of ["110x140", "500x500", "250x250", "40x40"]) {\n      urlsToTry.push(\`https://resources.premierleague.com/premierleague25/photos/players/\${size}/\${code}.png\`);\n    }\n    urlsToTry.push(target.toString());\n    for (const size of ["110x140", "500x500", "250x250", "110x110", "40x40"]) {\n      urlsToTry.push(\`https://resources.premierleague.com/premierleague/photos/players/\${size}/p\${code}.png\`);\n    }\n  } else {\n    urlsToTry.push(target.toString());\n  }`;

  if (source.includes(v1Block)) source = source.replace(v1Block, v2Block);
  else if (source.includes(originalBlock)) source = source.replace(originalBlock, v2Block);
  else throw new Error("[production-console-repairs] image proxy fallback block not found");
  return source;
}, ["CURRENT_PL_PLAYER_PHOTO_FALLBACKS_V2", '["110x140", "500x500", "250x250", "40x40"]']);

console.log("[production-console-repairs] production CSP, official player portrait fallbacks and proxy ordering verified.");
