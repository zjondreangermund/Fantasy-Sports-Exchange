import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import SlabCard, { type SlabRarity } from "./SlabCard";

type PlayerCardProps = {
  id: number;
  rarity: SlabRarity;
  className?: string;
};

type FplPlayerPayload = {
  id: number;
  name: string;
  teamName: string;
  teamCode: string;
  totalPoints: number;
  influence: number;
  ictIndex: number;
  form: number;
  price: number;
};

type ApiFootballPayload = {
  photo?: string;
  nationality?: string;
  flag?: string;
  matched?: boolean;
};

function toFlagEmojiFromNationality(nationality: string) {
  const map: Record<string, string> = {
    argentina: "AR",
    england: "GB",
    brazil: "BR",
    france: "FR",
    spain: "ES",
    portugal: "PT",
    netherlands: "NL",
    germany: "DE",
    italy: "IT",
  };

  const iso2 = map[String(nationality || "").toLowerCase()];
  if (!iso2) return "🏳️";
  return String.fromCodePoint(...iso2.split("").map((c) => 127397 + c.charCodeAt(0)));
}

export default function PlayerCard({ id, rarity, className = "" }: PlayerCardProps) {
  const [fpl, setFpl] = useState<FplPlayerPayload | null>(null);
  const [apiFootball, setApiFootball] = useState<ApiFootballPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const [fplRes, apiFootballRes] = await Promise.all([
          fetch(`/api/proxy/fpl/player/${id}`, { credentials: "include" }),
          fetch(`/api/proxy/api-football/by-fpl/${id}`, { credentials: "include" }),
        ]);

        if (!fplRes.ok) throw new Error("Failed to fetch FPL data");
        if (!apiFootballRes.ok) throw new Error("Failed to fetch API-Football data");

        const [fplJson, apiFootballJson] = await Promise.all([fplRes.json(), apiFootballRes.json()]);
        if (!mounted) return;

        setFpl(fplJson as FplPlayerPayload);
        setApiFootball(apiFootballJson as ApiFootballPayload);
      } catch (loadError: any) {
        if (!mounted) return;
        setError(loadError?.message || "Failed to load player card");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [id]);

  const last5 = useMemo(() => {
    if (!fpl) return [0, 0, 0, 0, 0];
    const baseline = Number(fpl.form || 0) * 10;
    return [
      Math.max(0, Math.round(baseline - 8)),
      Math.max(0, Math.round(baseline + 3)),
      Math.max(0, Math.round(baseline - 2)),
      Math.max(0, Math.round(baseline + 6)),
      Math.max(0, Math.round(baseline + 1)),
    ];
  }, [fpl]);

  if (loading) {
    return <div className={`h-[250px] w-[170px] animate-pulse rounded-[24px] bg-white/10 ${className}`} />;
  }

  if (error || !fpl) {
    return <div className={`h-[250px] w-[170px] rounded-[24px] border border-rose-300/30 bg-rose-500/10 p-3 text-xs text-rose-200 ${className}`}>{error || "Card unavailable"}</div>;
  }

  const fantasyMetric = Number(fpl.ictIndex || fpl.form || 0);

  return (
    <motion.div
      className={className}
      whileHover={{ y: -4, transition: { duration: 0.25, ease: "easeOut" } }}
      transition={{ type: "spring", stiffness: 240, damping: 20 }}
    >
      <SlabCard
        name={fpl.name}
        rarity={rarity}
        avgScore={fantasyMetric}
        serialNumber={`${id}/100`}
        imageSrc={apiFootball?.photo || ""}
        teamCode={fpl.teamCode || "LIV"}
        shirtNumber={10}
        age={25}
        countryCode={toFlagEmojiFromNationality(String(apiFootball?.nationality || ""))}
        last5={last5}
        value={`£${Number(fpl.price || 0).toFixed(1)}m`}
      />
    </motion.div>
  );
}
