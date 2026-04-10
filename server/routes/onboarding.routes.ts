import type { Express } from "express";

interface RegisterOnboardingRoutesDeps {
  requireAuth: any;
  storage: any;
  fplApi: any;
  getOnboardingConfig?: () => {
    signupPacksEnabled: boolean;
    requireTeamName: boolean;
    teamNameMinLength: number;
    onboardingEntryPath: string;
    starterChecklistLabel: string;
    packLabels: string[];
  };
}

function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function normalizePackPosition(pos: string) {
  const p = (pos || "").toLowerCase().trim();
  if (p === "gk") return "GK";
  if (p === "def") return "DEF";
  if (p === "mid") return "MID";
  if (p === "fwd") return "FWD";
  if (p.includes("goal")) return "GK";
  if (p.includes("def")) return "DEF";
  if (p.includes("mid")) return "MID";
  if (p.includes("for") || p.includes("strik") || p.includes("att")) return "FWD";
  return "MID";
}

export function registerOnboardingRoutes(app: Express, deps: RegisterOnboardingRoutesDeps) {
  const { requireAuth, storage, fplApi } = deps;
  const getOnboardingConfig = () =>
    deps.getOnboardingConfig?.() ?? {
      signupPacksEnabled: true,
      requireTeamName: true,
      teamNameMinLength: 3,
      onboardingEntryPath: "/onboarding",
      starterChecklistLabel: "Open starter packs",
      packLabels: ["Goalkeepers", "Defenders", "Midfielders", "Forwards", "Wildcards"],
    };

  const getOnboardingPlayerPool = async () => {
    const [fplPlayers, bootstrap, fixtures] = await Promise.all([
      fplApi.getPlayers(),
      fplApi.bootstrap(),
      fplApi.fixtures(),
    ]);

    const teams = Array.isArray(bootstrap?.teams) ? bootstrap.teams : [];
    const teamMap = new Map<number, any>(teams.map((t: any) => [Number(t.id), t] as [number, any]));

    const now = new Date();
    const sameUtcDay = (dateStr: string) => {
      const d = new Date(dateStr);
      return (
        d.getUTCFullYear() === now.getUTCFullYear() &&
        d.getUTCMonth() === now.getUTCMonth() &&
        d.getUTCDate() === now.getUTCDate()
      );
    };

    const todayTeamIds = new Set<number>();
    (Array.isArray(fixtures) ? fixtures : []).forEach((fixture: any) => {
      if (!fixture?.kickoff_time || !sameUtcDay(String(fixture.kickoff_time))) return;
      todayTeamIds.add(Number(fixture.team_h));
      todayTeamIds.add(Number(fixture.team_a));
    });

    const positionMap: Record<number, "GK" | "DEF" | "MID" | "FWD"> = {
      1: "GK",
      2: "DEF",
      3: "MID",
      4: "FWD",
    };

    const allFplPlayers = Array.isArray(fplPlayers) ? fplPlayers : [];
    const todayCandidates = allFplPlayers.filter((p: any) => todayTeamIds.has(Number(p.team)));
    const sourcePool = todayCandidates.length >= 15 ? todayCandidates : allFplPlayers;

    const candidates = sourcePool
      .sort((a: any, b: any) => {
        const sa = Number(a.starts || 0);
        const sb = Number(b.starts || 0);
        if (sb !== sa) return sb - sa;
        const ma = Number(a.minutes || 0);
        const mb = Number(b.minutes || 0);
        if (mb !== ma) return mb - ma;
        return Number(b.form || 0) - Number(a.form || 0);
      });

    const existingPlayers = await storage.getPlayers();
    const mapKey = (name: string, team: string, pos: string) =>
      `${name.toLowerCase()}::${team.toLowerCase()}::${pos}`;
    const existingMap = new Map<string, any>();
    existingPlayers.forEach((p: any) => {
      existingMap.set(mapKey(String(p.name), String(p.team), String(p.position)), p);
    });

    const ensurePlayer = async (fplPlayer: any) => {
      const teamName = String(teamMap.get(Number(fplPlayer.team))?.name || "Unknown");
      const position = positionMap[Number(fplPlayer.element_type)] || "MID";
      const fullName =
        `${String(fplPlayer.first_name || "").trim()} ${String(fplPlayer.second_name || "").trim()}`.trim() ||
        String(fplPlayer.web_name || "Unknown");
      const key = mapKey(fullName, teamName, position);
      const existing = existingMap.get(key);
      if (existing) return existing;

      const photoUrl = fplApi.playerPhotoUrl(fplPlayer, 250);
      const overall = Math.max(55, Math.min(95, Math.round(Number(fplPlayer.now_cost || 50) + 30)));

      const created = await storage.createPlayer({
        name: fullName,
        team: teamName,
        league: "Premier League",
        position,
        nationality: "Unknown",
        age: 24,
        overall,
        imageUrl: photoUrl,
      } as any);

      existingMap.set(key, created);
      return created;
    };

    const result: any[] = [];
    for (const player of candidates.slice(0, 120)) {
      result.push(await ensurePlayer(player));
    }

    return result;
  };

  const buildPackCards = (playersPool: any[]) => {
    const gkPool = shuffle(playersPool.filter((p: any) => normalizePackPosition(p.position) === "GK"));
    const defPool = shuffle(playersPool.filter((p: any) => normalizePackPosition(p.position) === "DEF"));
    const midPool = shuffle(playersPool.filter((p: any) => normalizePackPosition(p.position) === "MID"));
    const fwdPool = shuffle(playersPool.filter((p: any) => normalizePackPosition(p.position) === "FWD"));

    const gk = gkPool.slice(0, 3);
    const def = defPool.slice(0, 3);
    const mid = midPool.slice(0, 3);
    const fwd = fwdPool.slice(0, 3);

    const used = new Set<number>([...gk, ...def, ...mid, ...fwd].map((p: any) => Number(p.id)));
    const wildcard = shuffle(playersPool.filter((p: any) => !used.has(Number(p.id)))).slice(0, 3);

    if (gk.length < 3 || def.length < 3 || mid.length < 3 || fwd.length < 3 || wildcard.length < 3) {
      return null;
    }

    return [
      gk.map((p: any) => p.id),
      def.map((p: any) => p.id),
      mid.map((p: any) => p.id),
      fwd.map((p: any) => p.id),
      wildcard.map((p: any) => p.id),
    ];
  };

  app.get("/api/onboarding/config", requireAuth, async (_req: any, res) => {
    return res.json(getOnboardingConfig());
  });

  app.get("/api/onboarding/status", requireAuth, async (req: any, res) => {
    try {
      const config = getOnboardingConfig();
      if (!config.signupPacksEnabled) {
        return res.json({ completed: true });
      }
      const userId = req.authUserId;
      const ob = await storage.getOnboarding(userId);
      res.json({ completed: ob?.completed ?? false });
    } catch (error: any) {
      console.error("Onboarding status failed:", error);
      res.status(500).json({ message: "Failed to fetch onboarding status" });
    }
  });

  app.post("/api/onboarding/create-offer", requireAuth, async (req: any, res) => {
    try {
      const config = getOnboardingConfig();
      if (!config.signupPacksEnabled) {
        return res.status(403).json({ message: "Signup starter packs are currently disabled by admin" });
      }

      const userId = req.authUserId;
      const ob = await storage.getOnboarding(userId);

      if (ob?.completed) {
        return res.status(400).json({ message: "Onboarding already completed" });
      }

      if (ob?.packCards?.length === 5 && ob.packCards.flat().length === 15) {
        return res.json({ packCards: ob.packCards });
      }

      const allPlayers = await getOnboardingPlayerPool();

      if (!Array.isArray(allPlayers) || allPlayers.length < 15) {
        return res.status(400).json({
          message: "Not enough players in database. Seeding may have failed or player table is still empty.",
          count: allPlayers?.length ?? 0,
        });
      }

      const packCards = buildPackCards(allPlayers);
      if (!packCards) {
        return res.status(400).json({
          message: "Not enough players per position",
        });
      }

      if (!ob) {
        await storage.createOnboarding({
          userId,
          completed: false,
          packCards,
          selectedCards: [],
        } as any);
      } else {
        await storage.updateOnboarding(userId, { packCards, selectedCards: [] } as any);
      }

      return res.json({ packCards });
    } catch (error: any) {
      console.error("Onboarding/create-offer failed:", error);
      return res.status(500).json({ message: "Failed to create onboarding packs" });
    }
  });

  app.get("/api/onboarding/offers", requireAuth, async (req: any, res) => {
    try {
      const config = getOnboardingConfig();
      if (!config.signupPacksEnabled) {
        return res.status(403).json({
          message: "Signup starter packs are currently disabled by admin",
          config,
        });
      }

      const userId = req.authUserId;
      let ob = await storage.getOnboarding(userId);

      if (!ob?.packCards?.length) {
        const allPlayers = await getOnboardingPlayerPool();

        if (!Array.isArray(allPlayers) || allPlayers.length < 15) {
          return res.status(404).json({ message: "No offer found. Create offer first." });
        }

        const packCards = buildPackCards(allPlayers);
        if (!packCards) {
          return res.status(404).json({ message: "No offer found. Create offer first." });
        }

        if (!ob) {
          await storage.createOnboarding({
            userId,
            completed: false,
            packCards,
            selectedCards: [],
          } as any);
        } else {
          await storage.updateOnboarding(userId, { packCards, selectedCards: [] } as any);
        }

        ob = await storage.getOnboarding(userId);
      }

      const offeredPlayerIds = ob?.packCards?.flat() || [];
      const offeredPlayers = await Promise.all(
        offeredPlayerIds.map((id: number | null) =>
          id ? storage.getPlayer(id) : Promise.resolve(undefined),
        ),
      );
      const players = offeredPlayers.filter(Boolean);

      res.json({
        packCards: ob?.packCards || [],
        offeredPlayerIds,
        players,
        selectedCards: ob?.selectedCards ?? [],
        completed: ob?.completed ?? false,
        config,
      });
    } catch (error: any) {
      console.error("Fetch offers failed:", error);
      res.status(500).json({ message: "Failed to fetch offers" });
    }
  });

  app.post("/api/onboarding/choose", requireAuth, async (req: any, res) => {
    try {
      const config = getOnboardingConfig();
      if (!config.signupPacksEnabled) {
        return res.status(403).json({ message: "Signup starter packs are currently disabled by admin" });
      }

      const userId = req.authUserId;
      const selected: number[] = req.body?.selectedPlayerIds ?? [];

      if (!Array.isArray(selected) || selected.length !== 5) {
        return res.status(400).json({ message: "Select exactly 5 cards" });
      }
      if (new Set(selected).size !== 5) {
        return res.status(400).json({ message: "Duplicate selections not allowed" });
      }

      const ob = await storage.getOnboarding(userId);
      if (!ob?.packCards?.length) {
        return res.status(400).json({ message: "No offer exists. Create offer first." });
      }
      if (ob.completed) {
        return res.status(400).json({ message: "Onboarding already completed" });
      }

      const offeredSet = new Set(ob.packCards.flat());
      for (const id of selected) {
        if (!offeredSet.has(id)) {
          return res.status(400).json({ message: "Selection includes an invalid card" });
        }
      }

      for (const pack of ob.packCards) {
        const selectedInPack = selected.filter((id) => pack.includes(id));
        if (selectedInPack.length !== 1) {
          return res.status(400).json({ message: "Select exactly 1 player from each pack" });
        }
      }

      for (const playerId of selected) {
        await storage.createPlayerCard({
          playerId,
          ownerId: userId,
          rarity: "common",
          level: 1,
          xp: 0,
          decisiveScore: 35,
          forSale: false,
          price: 0,
        } as any);
      }

      await storage.updateOnboarding(userId, {
        selectedCards: selected,
        completed: true,
      } as any);

      res.json({ success: true, kept: 5 });
    } catch (error: any) {
      console.error("Choose cards failed:", error);
      res.status(500).json({ message: "Failed to complete onboarding" });
    }
  });
}
