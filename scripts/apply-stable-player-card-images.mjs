import fs from "node:fs";

function patch(path, transform) {
  const before = fs.readFileSync(path, "utf8");
  const after = transform(before);
  if (after !== before) {
    fs.writeFileSync(path, after);
    console.log(`[stable-card-images] patched ${path}`);
  } else console.log(`[stable-card-images] ${path} already ready`);
}

function replaceRequired(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`[stable-card-images] anchor not found: ${label}`);
  return source.replace(from, to);
}

patch("client/src/components/cards/CollectionStableCard.tsx", (original) => {
  let source = original;
  source = source.replace(
    'import { type CSSProperties, useEffect, useMemo, useState } from "react";',
    'import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";',
  );

  const oldState = `  const [imageIndex, setImageIndex] = useState(0);\n  useEffect(() => { setImageIndex(0); }, [player.id, imageCandidates]);\n  const image = imageCandidates[imageIndex] || "/players/fallback.svg";`;
  const newState = `  const [imageIndex, setImageIndex] = useState(0);\n  const imageCandidateKey = imageCandidates.join("\\u001f");\n  const lastDisplayedImage = useRef(imageCandidates[0] || "/players/fallback.svg");\n  useEffect(() => {\n    // STABLE_CARD_IMAGE_REFRESH_V1: profile queries can add a verified source after\n    // the card has already found a working fallback. Keep the currently displayed\n    // source if it is still in the candidate set instead of flashing/disappearing.\n    const retainedIndex = imageCandidates.indexOf(lastDisplayedImage.current);\n    setImageIndex(retainedIndex >= 0 ? retainedIndex : 0);\n  }, [player.id, imageCandidateKey]);\n  const image = imageCandidates[imageIndex] || "/players/fallback.svg";\n  useEffect(() => { lastDisplayedImage.current = image; }, [image]);`;
  source = replaceRequired(source, oldState, newState, "stable image candidate state");
  return source;
});

patch("client/src/components/cards/CollectionProfileCard.tsx", (original) => {
  let source = original;
  const oldBlock = `    const identityVerified = Boolean(data && data.source && data.source !== "card-fallback");\n    const verifiedImage = identityVerified ? data?.player?.imageUrl || undefined : undefined;\n    const displayCard = data\n      ? ({\n          ...card,\n          totalPoints: data.stats?.totalPoints ?? (card as any).totalPoints,\n          player: {\n            ...(card.player as any),\n            ...data.player,\n            name: data.player?.name || card.player?.name,\n            team: data.player?.team || card.player?.team,\n            position: data.player?.position || card.player?.position,\n            imageUrl: verifiedImage,\n            verifiedImageUrl: verifiedImage,\n            identityVerified,\n            identitySource: identityVerified\n              ? data.source === "api-football"\n                ? "api-football"\n                : "fpl"\n              : "unverified-card-data",\n            totalPoints: data.stats?.totalPoints ?? (card.player as any)?.totalPoints,\n            photo: null,\n            photoUrl: null,\n            image: null,\n            image_url: null,\n            officialPortraitUrl: null,\n            headshotUrl: null,\n            cutoutUrl: null,\n            code: identityVerified ? (card.player as any)?.code : null,\n          },\n        } as PlayerCardWithPlayer)\n      : card;`;
  const newBlock = `    const originalPlayer = (card.player as any) || {};\n    const profileVerified = Boolean(data && data.source && data.source !== "card-fallback");\n    const existingVerified = Boolean(originalPlayer.identityVerified)\n      || ["fpl", "api-football", "fpl+api-football", "api-football-current-squad"].includes(String(originalPlayer.identitySource || "").toLowerCase());\n    const identityVerified = profileVerified || existingVerified;\n    const verifiedImage = profileVerified ? data?.player?.imageUrl || undefined : undefined;\n    const retainedImages = Array.from(new Set([\n      originalPlayer.verifiedImageUrl, originalPlayer.imageUrl, originalPlayer.image_url,\n      originalPlayer.image, originalPlayer.photoUrl, originalPlayer.photo,\n      originalPlayer.cutoutUrl, originalPlayer.headshotUrl, originalPlayer.officialPortraitUrl,\n      ...(Array.isArray(originalPlayer.imageCandidates) ? originalPlayer.imageCandidates : []),\n      verifiedImage,\n    ].filter(Boolean)));\n    const retainedPrimary = retainedImages[0] || verifiedImage;\n    const displayCard = data\n      ? ({\n          ...card,\n          totalPoints: data.stats?.totalPoints ?? (card as any).totalPoints,\n          player: {\n            ...originalPlayer,\n            ...data.player,\n            name: data.player?.name || originalPlayer.name,\n            team: data.player?.team || originalPlayer.team,\n            position: data.player?.position || originalPlayer.position,\n            imageUrl: retainedPrimary,\n            verifiedImageUrl: retainedPrimary,\n            imageCandidates: retainedImages,\n            identityVerified,\n            identitySource: profileVerified\n              ? data.source === "api-football" ? "api-football" : "fpl"\n              : originalPlayer.identitySource || "unverified-card-data",\n            totalPoints: data.stats?.totalPoints ?? originalPlayer.totalPoints,\n            code: identityVerified ? originalPlayer.code : null,\n          },\n        } as PlayerCardWithPlayer)\n      : card;`;
  source = replaceRequired(source, oldBlock, newBlock, "collection profile image preservation");
  return source;
});

patch("client/src/components/cards/CardProfileModal.tsx", (original) => {
  let source = original;
  const oldBlock = `  const identityVerified = data.source !== "card-fallback";\n  const verifiedImage = identityVerified ? data.player?.imageUrl || undefined : undefined;\n  const profileCard = {\n    ...card,\n    totalPoints: data.stats.totalPoints,\n    player: {\n      ...(card.player as any),\n      ...data.player,\n      name: displayName,\n      team,\n      position,\n      imageUrl: verifiedImage,\n      verifiedImageUrl: verifiedImage,\n      identityVerified,\n      identitySource: identityVerified ? (data.source === "api-football" ? "api-football" : "fpl") : "unverified-card-data",\n      totalPoints: data.stats.totalPoints,\n      photo: null,\n      photoUrl: null,\n      image: null,\n      image_url: null,\n      officialPortraitUrl: null,\n      headshotUrl: null,\n      cutoutUrl: null,\n      code: identityVerified ? (card.player as any)?.code : null,\n    },\n  } as PlayerCardWithPlayer;`;
  const newBlock = `  const originalPlayer = (card.player as any) || {};\n  const profileVerified = data.source !== "card-fallback";\n  const existingVerified = Boolean(originalPlayer.identityVerified)\n    || ["fpl", "api-football", "fpl+api-football", "api-football-current-squad"].includes(String(originalPlayer.identitySource || "").toLowerCase());\n  const identityVerified = profileVerified || existingVerified;\n  const verifiedImage = profileVerified ? data.player?.imageUrl || undefined : undefined;\n  const retainedImages = Array.from(new Set([\n    originalPlayer.verifiedImageUrl, originalPlayer.imageUrl, originalPlayer.image_url,\n    originalPlayer.image, originalPlayer.photoUrl, originalPlayer.photo,\n    originalPlayer.cutoutUrl, originalPlayer.headshotUrl, originalPlayer.officialPortraitUrl,\n    ...(Array.isArray(originalPlayer.imageCandidates) ? originalPlayer.imageCandidates : []),\n    verifiedImage,\n  ].filter(Boolean))) as string[];\n  const retainedPrimary = retainedImages[0] || verifiedImage;\n  const profileCard = {\n    ...card,\n    totalPoints: data.stats.totalPoints,\n    player: {\n      ...originalPlayer,\n      ...data.player,\n      name: displayName,\n      team,\n      position,\n      imageUrl: retainedPrimary,\n      verifiedImageUrl: retainedPrimary,\n      imageCandidates: retainedImages,\n      identityVerified,\n      identitySource: profileVerified ? (data.source === "api-football" ? "api-football" : "fpl") : originalPlayer.identitySource || "unverified-card-data",\n      totalPoints: data.stats.totalPoints,\n      code: identityVerified ? originalPlayer.code : null,\n    },\n  } as PlayerCardWithPlayer;`;
  source = replaceRequired(source, oldBlock, newBlock, "modal image preservation");
  return source;
});
