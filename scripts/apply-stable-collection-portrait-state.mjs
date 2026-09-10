import fs from "node:fs";

const FILE = "client/src/components/cards/CollectionStableCard.tsx";
const MARKER = "STABLE_COLLECTION_PORTRAIT_STATE_V1";

const source = fs.readFileSync(FILE, "utf8");
let next = source;

if (!next.includes(MARKER)) {
  const importAnchor = 'import { normalizeRarity } from "./cardTheme";\n';
  if (!next.includes(importAnchor)) {
    throw new Error("[stable-portrait-state] CollectionStableCard import anchor missing");
  }
  next = next.replace(
    importAnchor,
    `${importAnchor}\n// ${MARKER}: keep the current working portrait when React receives a new\n// imageCandidates array containing the same URLs. This prevents a failed first\n// provider URL from resetting the card to index 0 on every query/render refresh.\n`,
  );
}

const unstableReadyBlock = `  const [imageIndex, setImageIndex] = useState(0);\n  const [imageReady, setImageReady] = useState(false);\n  useEffect(() => { setImageIndex(0); setImageReady(false); }, [player.id, imageCandidates]);\n  useEffect(() => { setImageReady(false); }, [imageIndex]);\n  const image = imageCandidates[imageIndex] || "/players/fallback.svg";`;
const stableReadyBlock = `  const imageCandidateKey = imageCandidates.join("\\u001f");\n  const [imageIndex, setImageIndex] = useState(0);\n  const [imageReady, setImageReady] = useState(false);\n  useEffect(() => { setImageIndex(0); setImageReady(false); }, [player.id, imageCandidateKey]);\n  useEffect(() => { setImageReady(false); }, [imageIndex]);\n  const image = imageCandidates[imageIndex] || "/players/fallback.svg";`;

const unstableBaseBlock = `  const [imageIndex, setImageIndex] = useState(0);\n  useEffect(() => { setImageIndex(0); }, [player.id, imageCandidates]);\n  const image = imageCandidates[imageIndex] || "/players/fallback.svg";`;
const stableBaseBlock = `  const imageCandidateKey = imageCandidates.join("\\u001f");\n  const [imageIndex, setImageIndex] = useState(0);\n  useEffect(() => { setImageIndex(0); }, [player.id, imageCandidateKey]);\n  const image = imageCandidates[imageIndex] || "/players/fallback.svg";`;

if (next.includes(unstableReadyBlock)) {
  next = next.replace(unstableReadyBlock, stableReadyBlock);
} else if (next.includes(unstableBaseBlock)) {
  next = next.replace(unstableBaseBlock, stableBaseBlock);
}

if (!next.includes("const imageCandidateKey = imageCandidates.join")) {
  throw new Error("[stable-portrait-state] stable candidate key was not applied");
}
if (next.includes("[player.id, imageCandidates]")) {
  throw new Error("[stable-portrait-state] unstable imageCandidates reference dependency remains");
}
if (!next.includes("setImageIndex((previous)")) {
  throw new Error("[stable-portrait-state] verified portrait fallback progression is missing");
}

if (next !== source) {
  fs.writeFileSync(FILE, next);
  console.log("[stable-portrait-state] collection portraits no longer reset when equivalent candidate arrays are recreated");
} else {
  console.log("[stable-portrait-state] collection portrait state already stable");
}
