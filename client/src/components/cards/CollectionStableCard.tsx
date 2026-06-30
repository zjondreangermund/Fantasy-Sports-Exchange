import { type PlayerCardData } from "./types";
import { normalizeRarity, CARD_THEMES } from "./cardTheme";

type Props = {
  player: PlayerCardData;
  selected?: boolean;
  onClick?: () => void;
  showPrice?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
};

const SIZE = {
  sm: { width: 160, height: 226, radius: 18 },
  md: { width: 206, height: 292, radius: 22 },
  lg: { width: 260, height: 368, radius: 28 },
  xl: { width: 320, height: 452, radius: 34 },
};

function imageOf(player: PlayerCardData) {
  return player.image || player.imageUrl || player.photo || player.imageCandidates?.[0] || "";
}

function nameOf(player: PlayerCardData) {
  return String(player.name || "Unknown Player").toUpperCase();
}

export default function CollectionStableCard({ player, selected = false, onClick, showPrice = false, size = "sm" }: Props) {
  const rarity = normalizeRarity(player.rarity);
  const theme = CARD_THEMES[rarity];
  const dim = SIZE[size] || SIZE.sm;
  const image = imageOf(player);
  const team = player.team || player.club || "Fantasy Arena";
  const price = Number(player.price || player.listedPrice || 0);

  return (
    <button
      type="button"
      onClick={onClick}
      style={{ background: "transparent", border: 0, padding: 0, display: "block" }}
    >
      <article
        style={{
          width: dim.width,
          height: dim.height,
          borderRadius: dim.radius,
          position: "relative",
          overflow: "hidden",
          border: `2px solid ${theme.border}`,
          background: theme.chrome,
          boxShadow: selected ? `0 0 0 3px #34d399, ${theme.glow}` : theme.glow,
          color: "white",
        }}
      >
        <div style={{ position: "absolute", inset: 0, background: theme.background }} />
        <div style={{ position: "absolute", inset: 8, borderRadius: dim.radius - 6, overflow: "hidden", background: "#111827" }}>
          {image ? (
            <img src={image} alt={player.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          ) : (
            <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", fontWeight: 900, fontSize: 34, color: "rgba(255,255,255,.25)" }}>{nameOf(player).slice(0, 2)}</div>
          )}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(0,0,0,.05),rgba(0,0,0,.1) 45%,rgba(0,0,0,.85))" }} />
        </div>
        <div style={{ position: "absolute", inset: 0, background: theme.foil, mixBlendMode: "screen", opacity: .32 }} />
        <div style={{ position: "absolute", inset: 4, borderRadius: dim.radius - 4, border: "1px solid rgba(255,255,255,.55)" }} />
        <div style={{ position: "absolute", top: 12, left: 12, right: 12, display: "flex", justifyContent: "space-between", fontSize: 9, fontWeight: 900, textShadow: "0 2px 4px #000" }}>
          <span>{player.season || "2026-27"}</span><span>{team.slice(0, 3).toUpperCase()}</span>
        </div>
        <div style={{ position: "absolute", left: 12, right: 12, bottom: 18, padding: "7px 9px", borderRadius: 14, background: theme.nameplate, border: "1px solid rgba(255,255,255,.28)", boxShadow: "0 8px 18px rgba(0,0,0,.55)" }}>
          <div style={{ fontSize: 12, fontWeight: 950, letterSpacing: ".04em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nameOf(player)}</div>
          <div style={{ marginTop: 3, fontSize: 9, fontWeight: 900, color: theme.mutedText, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{player.position || "N/A"} • {team}</div>
          {showPrice && price > 0 ? <div style={{ marginTop: 3, fontSize: 9, fontWeight: 950, color: "#bbf7d0" }}>N${price.toFixed(2)}</div> : null}
        </div>
        <div style={{ position: "absolute", left: "50%", bottom: 5, transform: "translateX(-50%)", fontSize: 7, fontWeight: 900, letterSpacing: ".14em", background: "rgba(0,0,0,.55)", padding: "2px 8px", borderRadius: 999 }}>{theme.label}</div>
      </article>
    </button>
  );
}
