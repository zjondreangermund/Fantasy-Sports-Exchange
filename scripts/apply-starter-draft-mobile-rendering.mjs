import fs from "node:fs";

const MARKER = "STARTER_DRAFT_MOBILE_RENDERING_V1";

function replaceRequired(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`Starter Draft mobile patch anchor not found: ${label}`);
  return source.replace(from, to);
}

function patchFile(path, transform, required = []) {
  if (!fs.existsSync(path)) throw new Error(`Starter Draft mobile target missing: ${path}`);
  const source = fs.readFileSync(path, "utf8");
  const next = transform(source);
  for (const marker of required) {
    if (!next.includes(marker)) throw new Error(`Starter Draft mobile verification failed for ${path}: ${marker}`);
  }
  if (next !== source) {
    fs.writeFileSync(path, next);
    console.log(`[starter-draft-mobile] patched ${path}`);
  } else {
    console.log(`[starter-draft-mobile] ${path} already patched`);
  }
}

patchFile("client/src/components/cards/CollectionStableCard.tsx", (original) => {
  if (original.includes(MARKER)) return original;
  let source = original;
  source = replaceRequired(
    source,
    'import { normalizeRarity } from "./cardTheme";\n',
    'import { normalizeRarity } from "./cardTheme";\n\n// STARTER_DRAFT_MOBILE_RENDERING_V1: keep tiny cards on Android Chrome off the scaled 3D compositor path.\n',
    "collection marker",
  );
  source = replaceRequired(source, '  size?: "sm" | "md";\n', '  size?: "xs" | "sm" | "md";\n', "collection xs prop");
  source = replaceRequired(
    source,
    'const SIZE = {\n  sm: { width: 146, height: 220, radius: 20 },\n  md: { width: 170, height: 256, radius: 23 },\n};',
    'const SIZE = {\n  xs: { width: 96, height: 136, radius: 12 },\n  sm: { width: 146, height: 220, radius: 20 },\n  md: { width: 170, height: 256, radius: 23 },\n};',
    "collection xs dimensions",
  );
  source = replaceRequired(
    source,
    '  const [imageIndex, setImageIndex] = useState(0);\n  useEffect(() => { setImageIndex(0); }, [player.id, imageCandidates]);\n  const image = imageCandidates[imageIndex] || "/players/fallback.svg";',
    '  const [imageIndex, setImageIndex] = useState(0);\n  const [imageReady, setImageReady] = useState(false);\n  useEffect(() => { setImageIndex(0); setImageReady(false); }, [player.id, imageCandidates]);\n  useEffect(() => { setImageReady(false); }, [imageIndex]);\n  const image = imageCandidates[imageIndex] || "/players/fallback.svg";',
    "collection image readiness",
  );
  source = replaceRequired(
    source,
    '  const scale = dim.width / SIZE.sm.width;\n  const fallback = isFallbackImage(image);',
    '  const scale = dim.width / SIZE.sm.width;\n  const compact = size === "xs";\n  const fallback = isFallbackImage(image);',
    "collection compact flag",
  );
  source = replaceRequired(
    source,
    '    boxShadow: selected\n      ? `0 0 0 3px #34d399, 0 0 44px ${palette.glow}, 0 22px 52px rgba(0,0,0,.74), inset 0 1px 0 rgba(255,255,255,.98), inset 0 -18px 40px rgba(0,0,0,.50)`\n      : `0 0 34px ${palette.glow}, 0 22px 50px rgba(0,0,0,.74), inset 0 1px 0 rgba(255,255,255,.98), inset 0 -18px 40px rgba(0,0,0,.50)`,\n    color: "white",\n    transform: "translateZ(0)",',
    '    boxShadow: compact\n      ? selected\n        ? `0 0 0 2px #34d399, 0 8px 18px rgba(0,0,0,.56), inset 0 1px 0 rgba(255,255,255,.88)`\n        : `0 8px 18px rgba(0,0,0,.52), inset 0 1px 0 rgba(255,255,255,.88)`\n      : selected\n        ? `0 0 0 3px #34d399, 0 0 44px ${palette.glow}, 0 22px 52px rgba(0,0,0,.74), inset 0 1px 0 rgba(255,255,255,.98), inset 0 -18px 40px rgba(0,0,0,.50)`\n        : `0 0 34px ${palette.glow}, 0 22px 50px rgba(0,0,0,.74), inset 0 1px 0 rgba(255,255,255,.98), inset 0 -18px 40px rgba(0,0,0,.50)`,\n    color: "white",\n    transform: compact ? "none" : "translateZ(0)",',
    "collection compact compositing",
  );
  source = replaceRequired(
    source,
    '    <button type="button" onClick={onClick} className="group relative block touch-manipulation fa-card-lift" style={{ background: "transparent", border: 0, padding: 0, perspective: 900 }}>\n      <span aria-hidden="true" className="absolute -inset-4 rounded-[2rem] opacity-80 blur-2xl transition duration-300 group-hover:opacity-100" style={{ background: `radial-gradient(circle, ${palette.glow}, transparent 64%)` }} />\n      <article style={cardStyle} className="transition duration-300 group-hover:[transform:rotateX(2deg)_rotateY(-2deg)_translateY(-3px)]">',
    '    <button type="button" onClick={onClick} className={`group relative block touch-manipulation ${compact ? "starter-card-static" : "fa-card-lift"}`} style={{ background: "transparent", border: 0, padding: 0, perspective: compact ? undefined : 900 }}>\n      {!compact ? <span aria-hidden="true" className="absolute -inset-4 rounded-[2rem] opacity-80 blur-2xl transition duration-300 group-hover:opacity-100" style={{ background: `radial-gradient(circle, ${palette.glow}, transparent 64%)` }} /> : null}\n      <article style={cardStyle} className={compact ? "" : "transition duration-300 group-hover:[transform:rotateX(2deg)_rotateY(-2deg)_translateY(-3px)]"}>',
    "collection compact interaction",
  );
  const imageLine = '          <img src={image} alt={player.name} loading="lazy" onError={() => setImageIndex((previous) => Math.min(previous + 1, imageCandidates.length - 1))} style={{ width: "100%", height: "100%", objectFit: fallback ? "contain" : "cover", objectPosition: "center top", display: "block", padding: fallback ? `${18 * scale}px ${18 * scale}px 0` : 0, filter: fallback ? "saturate(.94) contrast(1.08) brightness(1.06)" : "saturate(1.12) contrast(1.10) brightness(1.05)", transform: fallback ? "scale(.78)" : "scale(.86)" }} />';
  const imageReplacement = '          <img src="/players/fallback.svg" alt="" aria-hidden="true" loading="eager" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", objectPosition: "center top", display: "block", padding: `${18 * scale}px ${18 * scale}px 0`, filter: "saturate(.94) contrast(1.08) brightness(1.06)", transform: "scale(.78)" }} />\n          <img src={image} alt={player.name} loading={compact ? "eager" : "lazy"} decoding="async" onLoad={() => setImageReady(true)} onError={() => { setImageReady(false); setImageIndex((previous) => Math.min(previous + 1, imageCandidates.length - 1)); }} style={{ position: "relative", width: "100%", height: "100%", objectFit: fallback ? "contain" : "cover", objectPosition: "center top", display: "block", padding: fallback ? `${18 * scale}px ${18 * scale}px 0` : 0, filter: fallback ? "saturate(.94) contrast(1.08) brightness(1.06)" : "saturate(1.12) contrast(1.10) brightness(1.05)", transform: fallback ? "scale(.78)" : "scale(.86)", opacity: fallback || imageReady ? 1 : 0, transition: compact ? "none" : "opacity .12s ease" }} />';
  source = replaceRequired(source, imageLine, imageReplacement, "collection immediate portrait fallback");
  return source;
}, [MARKER, 'size?: "xs" | "sm" | "md"', 'loading={compact ? "eager" : "lazy"}', 'starter-card-static']);

patchFile("client/src/components/cards/PremiumFootballCard.tsx", (original) => {
  if (original.includes(MARKER)) return original;
  let source = original;
  source = replaceRequired(
    source,
    'import PlayerIntelligencePanel from "../PlayerIntelligencePanel";\n',
    'import PlayerIntelligencePanel from "../PlayerIntelligencePanel";\n\n// STARTER_DRAFT_MOBILE_RENDERING_V1: xs cards render at native size instead of through a scaled GPU layer.\n',
    "premium marker",
  );
  source = replaceRequired(
    source,
    '  const directInteraction = Boolean(onClick);\n',
    '  const directInteraction = Boolean(onClick);\n  const compactDirect = size === "xs";\n',
    "premium compact flag",
  );
  source = replaceRequired(
    source,
    '            width: COLLECTION_PROFILE_WIDTH,\n            height: COLLECTION_PROFILE_HEIGHT,\n            transform: `scale(${scale})`,\n            transformOrigin: "top center",',
    '            width: compactDirect ? dimensions.width : COLLECTION_PROFILE_WIDTH,\n            height: compactDirect ? dimensions.height : COLLECTION_PROFILE_HEIGHT,\n            transform: compactDirect ? "none" : `scale(${scale})`,\n            transformOrigin: "top center",',
    "premium native xs wrapper",
  );
  source = replaceRequired(source, '            size="md"\n', '            size={compactDirect ? "xs" : "md"}\n', "premium native xs renderer");
  return source;
}, [MARKER, 'const compactDirect = size === "xs"', 'size={compactDirect ? "xs" : "md"}']);

patchFile("client/src/pages/onboarding.tsx", (original) => {
  if (original.includes(MARKER)) return original;
  let source = original;
  source = replaceRequired(
    source,
    'const defaultPackLabels = ["Goalkeepers", "Defenders", "Midfielders", "Forwards", "Wildcards"];\n',
    'const defaultPackLabels = ["Goalkeepers", "Defenders", "Midfielders", "Forwards", "Wildcards"];\n// STARTER_DRAFT_MOBILE_RENDERING_V1: stable native-size cards and explicit incomplete-selection CTA on mobile.\n',
    "onboarding marker",
  );
  source = replaceRequired(
    source,
    '                  <div className="mx-auto grid w-full max-w-[330px] grid-cols-3 items-start gap-1.5 px-1.5 py-2 sm:max-w-[390px] sm:gap-3 sm:px-3 sm:py-3">',
    '                  <div className="mx-auto grid w-full max-w-[330px] grid-cols-3 items-start justify-items-center gap-1 px-1 py-2 sm:max-w-[390px] sm:gap-3 sm:px-3 sm:py-3">',
    "onboarding mobile choice grid",
  );
  source = replaceRequired(
    source,
    '                          className={`relative flex h-auto min-h-0 min-w-0 self-start flex-col items-center justify-start overflow-hidden rounded-xl border px-0.5 pb-2 pt-1.5 text-center outline-none transition active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-cyan-300 ${isSelected ? "border-cyan-300/65 bg-cyan-300/[0.11] shadow-[0_0_24px_rgba(34,211,238,.16)]" : "border-white/8 bg-black/20 hover:border-white/20 hover:bg-white/[0.04]"}`}',
    '                          className={`relative flex h-auto min-h-0 min-w-0 self-start flex-col items-center justify-start overflow-visible rounded-xl border px-0.5 pb-2 pt-1.5 text-center outline-none transition active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-cyan-300 ${isSelected ? "border-cyan-300/65 bg-cyan-300/[0.11] shadow-[0_0_18px_rgba(34,211,238,.14)]" : "border-white/8 bg-black/20 hover:border-white/20 hover:bg-white/[0.04]"}`}',
    "onboarding no card clipping",
  );
  source = replaceRequired(
    source,
    '                          <span className="mt-1 block w-full truncate px-1 text-[9px] font-black leading-tight text-white/85 sm:text-[10px]">{card.player?.name || "Player"}</span>',
    '                          <span className="mt-1 block h-6 w-full overflow-hidden px-1 text-[9px] font-black leading-3 text-white/85 sm:text-[10px]">{card.player?.name || "Player"}</span>',
    "onboarding player label",
  );
  source = replaceRequired(
    source,
    '            <Button onClick={handleConfirm} disabled={selectedCount !== requiredSelections || chooseMutation.isPending} size="lg" className="h-11 shrink-0 rounded-xl bg-cyan-300 px-4 text-sm font-black text-slate-950 hover:bg-cyan-200 sm:min-w-[240px] sm:text-base">{chooseMutation.isPending ? "Minting..." : <>Confirm & Mint <Check className="ml-1.5 h-4 w-4" /></>}</Button>',
    '            <Button onClick={handleConfirm} disabled={selectedCount !== requiredSelections || chooseMutation.isPending} size="lg" className="h-11 min-w-[138px] shrink-0 rounded-xl border border-cyan-200/30 bg-cyan-300 px-4 text-sm font-black text-slate-950 hover:bg-cyan-200 disabled:border-white/10 disabled:bg-white/[0.06] disabled:text-white/35 disabled:opacity-100 sm:min-w-[240px] sm:text-base">{chooseMutation.isPending ? "Minting..." : selectedCount !== requiredSelections ? <>Select {remaining} more</> : <>Confirm & Mint <Check className="ml-1.5 h-4 w-4" /></>}</Button>',
    "onboarding disabled confirmation",
  );
  return source;
}, [MARKER, "overflow-visible rounded-xl", "Select {remaining} more", "disabled:opacity-100"]);

console.log("Starter Draft mobile rendering stabilized: native xs cards, immediate portrait fallback, reduced compositor load and explicit disabled confirmation.");
