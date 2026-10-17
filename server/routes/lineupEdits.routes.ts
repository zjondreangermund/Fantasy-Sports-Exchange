import type { Express } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db.js";
import { fplApi } from "../services/fplApi.js";
import { buildFplPlayerIndex } from "../services/fplPlayerIdentity.js";
import { loadApiFootballGameweekScoringContext } from "../services/apiFootballScoringBridge.js";
import { resolveApiFootballPlayer } from "../services/apiFootballPlayerDirectory.js";
import { createNotificationOnce, ensureNotificationsSchema } from "../services/notifications.js";
import { TOURNAMENT_REQUIRED_POSITIONS, TOURNAMENT_UTILITY_POSITIONS, validateTournamentRarityLineup } from "../../shared/game-rules.js";

const rows = (r: any): any[] => Array.isArray(r?.rows) ? r.rows : [];
const premier = (s: unknown) => ["premierleague", "englishpremierleague", "epl"].includes(String(s || "").toLowerCase().replace(/[^a-z0-9]/g, ""));
const IDs = (v: unknown): number[] => Array.isArray(v) ? v.map(Number).filter(n => Number.isSafeInteger(n) && n > 0) : [];
function errorMessage(error: any) { return String(error?.message || "Could not update this lineup"); }

/** Entry edits are FREE, preserve the paid entry and do not alter the scoring/settlement history.
 * Every change is rechecked under row locks; no changes after actual first kickoff.
 */
export function registerLineupEditsRoutes(app: Express, deps: { requireAuth: any }) {
  app.patch("/api/competitions/entries/:entryId/lineup", deps.requireAuth, async (req: any, res) => {
    try {
      const entryId = Number(req.params.entryId);
      const userId = String(req.authUserId || "");
      const cardIds = IDs(req.body?.cardIds);
      const captainId = Number(req.body?.captainId);
      if (!Number.isSafeInteger(entryId) || entryId <= 0 || !userId || cardIds.length !== 5 || new Set(cardIds).size !== 5 || !cardIds.includes(captainId)) {
        return res.status(400).json({ message: "Select five different cards in GK, DEF, MID, FWD, Utility order and a captain from those cards." });
      }
      const preview = rows(await db.execute(sql`
        SELECT c.game_week AS "gameWeek", c.start_date AS "startDate",
          ce.competition_id AS "competitionId"
        FROM app.competition_entries ce JOIN app.competitions c ON c.id=ce.competition_id
        WHERE ce.id=${entryId} AND ce.user_id=${userId}
      `))[0];
      if (!preview) return res.status(404).json({ message: "Your tournament entry was not found." });

      const gw = Number(preview.gameWeek || 0);
      // Fetch BEFORE the transaction to avoid external calls while holding SQL locks.
      const [fixtures, bootstrap, scoring] = await Promise.all([
        fplApi.fixturesLive(), fplApi.bootstrap(),
        loadApiFootballGameweekScoringContext(gw).catch(() => null),
      ]);
      const gwFixtures = (Array.isArray(fixtures) ? fixtures : []).filter((f: any) => Number(f?.event) === gw && f?.kickoff_time);
      const kickoffs = gwFixtures.map((f: any) => Date.parse(String(f.kickoff_time))).filter(Number.isFinite).sort((a: number,b: number) => a-b);
      const event: any = (Array.isArray(bootstrap?.events) ? bootstrap.events : []).find((f: any) => Number(f.id) === gw);
      const fallback = Date.parse(String(event?.deadline_time || ""));
      const cutoff = kickoffs[0] ?? fallback;
      if (!Number.isFinite(cutoff)) return res.status(503).json({ message: "Lineup deadline cannot be verified. Try again shortly." });
      const startMs=Date.parse(String(preview.startDate || ""));
      if(Number.isFinite(startMs) && Math.abs(cutoff-startMs)>35*86400000)
        return res.status(409).json({message:"This entry belongs to another gameweek or season; it cannot be changed."});
      if (Date.now() >= cutoff || gwFixtures.some((f: any) => Boolean(f.started || f.finished || f.finished_provisional))) {
        return res.status(409).json({ message: "The first Premier League match has begun. Submitted tournament lineups are final." });
      }
      const official = buildFplPlayerIndex(bootstrap);
      const directory = scoring?.directory || [];
      const departed = scoring?.departedDirectory || [];
      const payload = JSON.stringify(cardIds);

      await ensureNotificationsSchema();
      const result = await db.transaction(async tx => {
        const competition = rows(await tx.execute(sql`
          SELECT id, tier::text AS tier, status::text AS status, game_week AS "gameWeek",
            admin_status_override AS "manualStatus"
          FROM app.competitions WHERE id=${Number(preview.competitionId)} FOR UPDATE
        `))[0];
        if (!competition || Number(competition.gameWeek) !== gw || String(competition.status) !== "open" || (competition.manualStatus && String(competition.manualStatus) !== "open") || Date.now() >= cutoff) {
          throw new Error("Entries are locked or the gameweek schedule has changed.");
        }
        const entry = rows(await tx.execute(sql`
          SELECT id, lineup_card_ids AS "oldIds", captain_id AS "oldCaptain", tiebreak_meta AS "meta"
          FROM app.competition_entries WHERE id=${entryId} AND user_id=${userId}
            AND competition_id=${Number(competition.id)} FOR UPDATE
        `))[0];
        if (!entry) throw new Error("Entry no longer exists.");
        const oldIds = IDs(entry.oldIds);
        // Lock the union to keep concurrent purchase/loan/entry edits serializable.
        const unionJson = JSON.stringify([...new Set([...oldIds, ...cardIds])].sort((a,b)=>a-b));
        await tx.execute(sql`
          SELECT pg_advisory_xact_lock(87421, chosen.card_id)
          FROM (SELECT value::integer AS card_id FROM jsonb_array_elements_text(${unionJson}::jsonb)) chosen
          ORDER BY chosen.card_id
        `);
        const cards = rows(await tx.execute(sql`
          SELECT pc.id, pc.owner_id AS "ownerId", pc.rarity::text AS rarity, pc.for_sale AS "forSale",
            pc.player_id AS "playerId", p.position::text AS position, p.league AS league,
            p.status AS status, p.name AS "playerName", p.team AS team,
            p.fpl_id AS "fplId", p.code AS code, p.web_name AS "webName"
          FROM app.player_cards pc JOIN app.players p ON p.id=pc.player_id
          WHERE pc.id IN (SELECT value::integer FROM jsonb_array_elements_text(${payload}::jsonb))
          FOR UPDATE OF pc
        `));
        const ordered = cardIds.map(id => cards.find((c: any) => Number(c.id) === id));
        if (ordered.some(c => !c) || cards.some(c => String(c.ownerId) !== userId || c.forSale)) throw new Error("All five cards must be owned by you and not listed for sale.");
        if (new Set(cards.map(c => Number(c.playerId))).size !== 5) throw new Error("Choose five distinct footballers.");
        const normalized = ordered.map((c: any) => {
          const storedLeague = String(c.league || "").toLowerCase();
          const isDeparted = ["departed", "superseded", "unlinked", "archived"].includes(String(c.status || "").toLowerCase())
            || Boolean(storedLeague && !premier(storedLeague))
            || Boolean(resolveApiFootballPlayer({...c, name:c.playerName}, departed));
          if (isDeparted) throw new Error(`${c.playerName} is no longer eligible for Premier League entries.`);
          const fpl = official.resolve({name:c.playerName,team:c.team,position:c.position,fplId:c.fplId,code:c.code,webName:c.webName});
          const canonical = fpl ? official.canonical(fpl) : null;
          const linked = resolveApiFootballPlayer({...c,name:c.playerName,...(canonical || {})},directory);
          if (!linked) throw new Error(`${c.playerName} could not be verified against current Premier League data.`);
          return {...c, position:String(canonical?.position || c.position || linked.position || "").toUpperCase()};
        });
        normalized.forEach((card: any, idx: number) => {
          const position = card.position;
          if (idx < 4 && position !== TOURNAMENT_REQUIRED_POSITIONS[idx]) throw new Error("Your team must be ordered GK, DEF, MID, FWD, then Utility.");
          if (idx === 4 && !TOURNAMENT_UTILITY_POSITIONS.includes(position as any)) throw new Error("Utility must be a defender, midfielder or forward.");
        });
        const rarity = validateTournamentRarityLineup(normalized.map((c: any)=>c.rarity),competition.tier);
        if (!rarity.valid) throw new Error(rarity.message);
        const occupiedByOtherEntry = rows(await tx.execute(sql`
          SELECT ce.id FROM app.competition_entries ce
          WHERE ce.competition_id=${Number(competition.id)} AND ce.id <> ${entryId}
            AND EXISTS (SELECT 1 FROM jsonb_array_elements_text(ce.lineup_card_ids) AS used(card_id)
              WHERE used.card_id::integer IN (SELECT value::integer FROM jsonb_array_elements_text(${payload}::jsonb)))
          LIMIT 1
        `));
        if (occupiedByOtherEntry.length) throw new Error("One or more cards belong to another submitted team in this tournament.");
        const foreignLocks = rows(await tx.execute(sql`
          SELECT cl.card_id FROM app.card_locks cl
          WHERE cl.card_id IN (SELECT value::integer FROM jsonb_array_elements_text(${payload}::jsonb))
            AND (cl.expires_at IS NULL OR cl.expires_at > now())
            AND NOT (cl.reason='competition' AND cl.ref_id=${String(competition.id)}
              AND cl.user_id=${userId}
              AND cl.card_id IN (SELECT value::integer FROM jsonb_array_elements_text(${JSON.stringify(oldIds)}::jsonb)))
          LIMIT 1
        `));
        if (foreignLocks.length) throw new Error("A selected card is already locked in another team or activity.");
        if (JSON.stringify(oldIds) === payload && Number(entry.oldCaptain) === captainId) {
          return { changed:false };
        }
        // Clear ONLY this entry's previous competition locks, then install new ones.
        await tx.execute(sql`
          DELETE FROM app.card_locks cl
          WHERE cl.user_id=${userId} AND cl.reason='competition' AND cl.ref_id=${String(competition.id)}
            AND cl.card_id IN (SELECT value::integer FROM jsonb_array_elements_text(${JSON.stringify(oldIds)}::jsonb))
        `);
        await tx.execute(sql`
          INSERT INTO app.card_locks(card_id,user_id,reason,ref_id,created_at)
          SELECT value::integer,${userId},'competition',${String(competition.id)},now()
          FROM jsonb_array_elements_text(${payload}::jsonb)
        `);
        await tx.execute(sql`
          UPDATE app.competition_entries
          SET lineup_card_ids=${payload}::jsonb, captain_id=${captainId},
            total_score=0, tiebreak_meta=(COALESCE(tiebreak_meta,'{}'::jsonb)-'scoring')
          WHERE id=${entryId} AND user_id=${userId}
        `);
        await tx.execute(sql`
          INSERT INTO app.audit_logs(user_id,action,meta)
          VALUES(${userId},'competition.lineup.changed',
            jsonb_build_object('entryId',${entryId},'competitionId',${Number(competition.id)},
              'oldIds',${JSON.stringify(oldIds)}::jsonb,'newIds',${payload}::jsonb,
              'oldCaptain',${Number(entry.oldCaptain || 0)},'newCaptain',${captainId}))
        `);
        await createNotificationOnce(tx,{
          userId,title:`✅ GW${gw} lineup updated`,
          message:"Your five selected cards and captain have been saved. You can edit again until first kickoff; no additional entry fee was charged.",
          dedupeKey:`competition:${competition.id}:entry:${entryId}:lineup-edit:${Date.now()}`,
        });
        return { changed:true };
      });
      return res.json({success:true, ...result,entryId,cardIds,captainId,closesAt:new Date(cutoff).toISOString()});
    } catch(error: any) {
      const message=errorMessage(error);
      const expected=/locked|deadline|gameweek|distinct|cards|Captain|Utility|eligible|verified|Premier League|team|lineup|entries|card|rarity|tournament|schedule/i.test(message);
      if(!expected)console.error("Tournament lineup revision failed",error);
      return res.status(expected?409:500).json({message});
    }
  });
}
