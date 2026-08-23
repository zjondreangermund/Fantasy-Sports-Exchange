import type { Express } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db.js";
import { storage } from "../storage.js";
import { fplApi } from "../services/fplApi.js";
import { buildFplPlayerIndex } from "../services/fplPlayerIdentity.js";
import { loadApiFootballPlayerDirectory, resolveApiFootballPlayer } from "../services/apiFootballPlayerDirectory.js";
import { ScoreUpdateService } from "../services/scoreUpdater.js";
import { rankCompetitionEntries } from "../services/tournamentRules.js";
import { getActivePrizeForEntries } from "../services/prizeEngine.js";
import { createNotificationOnce, ensureNotificationsSchema } from "../services/notifications.js";
import { TOURNAMENT_REQUIRED_POSITIONS, TOURNAMENT_UTILITY_POSITIONS, validateTournamentRarityLineup } from "../../shared/game-rules.js";
import {
  getWalletPostingIntegrityReport,
  postWalletAmountExactlyOnce,
  tournamentPayoutPostingKey,
} from "../services/walletPosting.js";

interface RegisterEconomyIntegrityRoutesDeps {
  requireAuth: any;
}

const DEFAULT_ADMIN_EMAIL = "lbcplaya@gmail.com";
const PREMIER_LEAGUE_KEYS = new Set(["premierleague", "englishpremierleague", "epl"]);
let cardLockGuardPromise: Promise<void> | null = null;
let prizeAwardSchemaPromise: Promise<void> | null = null;

function rowsOf(result: any): any[] {
  return Array.isArray(result?.rows) ? result.rows : [];
}

function toMoney(amount: unknown): number {
  const value = Number(amount);
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

function asObject(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
}

function normalizeLeague(value: unknown): string {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function isPremierLeague(value: unknown): boolean {
  return PREMIER_LEAGUE_KEYS.has(normalizeLeague(value));
}

function isOfficialPrizeVaultCompetition(competition: any): boolean {
  return String(competition?.visibility || "public").toLowerCase() === "public"
    && !competition?.createdByUserId
    && String(competition?.prizeKey || "").toLowerCase() === "ladder"
    && String(competition?.prizeType || "goods").toLowerCase() === "goods";
}

async function resolveEntryDeadline(gameWeek: number, fallbackStart: unknown): Promise<Date> {
  const [bootstrap, fixtures] = await Promise.all([fplApi.bootstrap(), fplApi.fixturesLive()]);
  const event = (Array.isArray(bootstrap?.events) ? bootstrap.events : []).find((row: any) => Number(row?.id) === Number(gameWeek));
  const eventDeadline = event?.deadline_time ? new Date(String(event.deadline_time)) : null;
  if (eventDeadline && Number.isFinite(eventDeadline.getTime())) return eventDeadline;
  const firstKickoff = (Array.isArray(fixtures) ? fixtures : [])
    .filter((fixture: any) => Number(fixture?.event) === Number(gameWeek) && fixture?.kickoff_time)
    .map((fixture: any) => new Date(String(fixture.kickoff_time)))
    .filter((date: Date) => Number.isFinite(date.getTime()))
    .sort((a: Date, b: Date) => a.getTime() - b.getTime())[0];
  if (firstKickoff) return firstKickoff;
  const fallback = new Date(String(fallbackStart || ""));
  if (Number.isFinite(fallback.getTime())) return fallback;
  throw new Error("Unable to verify the Premier League entry deadline");
}

async function ensureCardLockGuard(): Promise<void> {
  if (!cardLockGuardPromise) {
    cardLockGuardPromise = (async () => {
      await db.execute(sql`
        create or replace function app.prevent_locked_card_transfer()
        returns trigger
        language plpgsql
        as $$
        begin
          if exists (
            select 1
            from app.card_locks cl
            where cl.card_id = old.id
              and (cl.expires_at is null or cl.expires_at > now())
          ) and (
            new.owner_id is distinct from old.owner_id
            or (new.for_sale is distinct from old.for_sale and new.for_sale = true)
          ) then
            raise exception 'Card is locked for competition';
          end if;
          return new;
        end;
        $$
      `);
      await db.execute(sql`drop trigger if exists player_cards_lock_guard on app.player_cards`);
      await db.execute(sql`
        create trigger player_cards_lock_guard
        before update of owner_id, for_sale on app.player_cards
        for each row execute function app.prevent_locked_card_transfer()
      `);
    })().catch((error) => {
      cardLockGuardPromise = null;
      throw error;
    });
  }
  await cardLockGuardPromise;
}

async function ensurePrizeAwardSchema(): Promise<void> {
  if (!prizeAwardSchemaPromise) {
    prizeAwardSchemaPromise = (async () => {
      await db.execute(sql`
        create table if not exists app.competition_prize_awards (
          id bigserial primary key,
          competition_id integer not null,
          entry_id integer not null,
          user_id varchar(255) not null,
          game_week integer not null,
          rarity text not null,
          prize_key text not null,
          prize_title text not null,
          prize_value real not null default 0,
          prize_category text,
          status text not null default 'pending_claim',
          metadata jsonb not null default '{}'::jsonb,
          created_at timestamp not null default now(),
          updated_at timestamp not null default now(),
          unique (competition_id, entry_id)
        )
      `);
      await db.execute(sql`create index if not exists competition_prize_awards_user_idx on app.competition_prize_awards (user_id, created_at desc)`);
      await db.execute(sql`create index if not exists competition_prize_awards_status_idx on app.competition_prize_awards (status, created_at desc)`);
    })().catch((error) => {
      prizeAwardSchemaPromise = null;
      throw error;
    });
  }
  await prizeAwardSchemaPromise;
}

async function isAdminUser(userId: string): Promise<boolean> {
  if (!userId) return false;
  const configuredIds = String(process.env.ADMIN_USER_IDS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (configuredIds.includes(userId)) return true;

  const configuredEmails = String(process.env.ADMIN_EMAILS || DEFAULT_ADMIN_EMAIL)
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const user = rowsOf(await db.execute(sql`
    select lower(coalesce(email, '')) as email
    from app.users
    where id = ${userId}
    limit 1
  `))[0];
  return Boolean(user?.email && configuredEmails.includes(String(user.email).toLowerCase()));
}

export function registerEconomyIntegrityRoutes(app: Express, deps: RegisterEconomyIntegrityRoutesDeps) {
  const { requireAuth } = deps;

  app.post("/api/competitions/join", requireAuth, async (req: any, res) => {
    try {
      await ensureCardLockGuard();
      const userId = String(req.authUserId || "");
      const competitionId = Number(req.body?.competitionId);
      const cardIds = Array.isArray(req.body?.cardIds)
        ? req.body.cardIds.map(Number).filter((id: number) => Number.isInteger(id) && id > 0)
        : [];
      const captainId = Number(req.body?.captainId || cardIds[0]);

      if (!Number.isInteger(competitionId) || competitionId <= 0 || cardIds.length !== 5 || new Set(cardIds).size !== 5) {
        return res.status(400).json({ message: "Tournament ID and exactly 5 different card IDs required" });
      }
      if (!cardIds.includes(captainId)) {
        return res.status(400).json({ message: "Captain must be one of the five selected cards" });
      }

      const cardIdsJson = JSON.stringify(cardIds);

      const preview = rowsOf(await db.execute(sql`
        select id, game_week as "gameWeek", start_date as "startDate"
        from app.competitions
        where id = ${competitionId}
        limit 1
      `))[0];
      if (!preview) return res.status(404).json({ message: "Tournament not found" });
      const entryDeadline = await resolveEntryDeadline(Number(preview.gameWeek || 0), preview.startDate);
      const [officialBootstrap, apiFootballDirectory] = await Promise.all([
        fplApi.bootstrap(),
        loadApiFootballPlayerDirectory().catch(() => []),
      ]);
      const officialPlayerIndex = buildFplPlayerIndex(officialBootstrap);

      const entry = await db.transaction(async (tx) => {
        const competition = rowsOf(await tx.execute(sql`
          select id, name, tier::text as tier, status::text as status,
            coalesce(entry_fee, 0)::float as "entryFee", max_entries as "maxEntries",
            game_week as "gameWeek", start_date as "startDate"
          from app.competitions
          where id = ${competitionId}
          for update
        `))[0];
        if (!competition) throw new Error("Tournament not found");
        if (Number(competition.gameWeek || 0) !== Number(preview.gameWeek || 0)) throw new Error("Tournament schedule changed; reopen the entry window and try again");
        if (String(competition.status) !== "open") throw new Error("Tournament is not open for entries");
        if (Date.now() >= entryDeadline.getTime()) throw new Error("Gameweek entries are closed");

        await tx.execute(sql`
          select pg_advisory_xact_lock(87421, selected.card_id)
          from (
            select value::int as card_id
            from jsonb_array_elements_text(${cardIdsJson}::jsonb)
          ) selected
          order by selected.card_id
        `);

        const storedCards = rowsOf(await tx.execute(sql`
          select pc.id, pc.owner_id as "ownerId", pc.rarity::text as rarity,
            pc.for_sale as "forSale", pc.player_id as "playerId",
            p.position::text as position, p.league as league,
            p.name as "playerName", p.team as team, p.fpl_id as "fplId",
            p.code as code, p.web_name as "webName"
          from app.player_cards pc
          join app.players p on p.id = pc.player_id
          where pc.id in (
            select value::int
            from jsonb_array_elements_text(${cardIdsJson}::jsonb)
          )
          for update of pc
        `));
        const cards = storedCards.map((card) => {
          const officialPlayer = officialPlayerIndex.resolve({
            name: card.playerName,
            team: card.team,
            position: card.position,
            fplId: card.fplId,
            code: card.code,
            webName: card.webName,
          });
          const canonical = officialPlayer ? officialPlayerIndex.canonical(officialPlayer) : null;
          const apiFootballPlayer = resolveApiFootballPlayer({ ...card, name: card.playerName, ...(canonical || {}) }, apiFootballDirectory);
          if (!apiFootballPlayer && !canonical) return card;
          return {
            ...card,
            league: "Premier League",
            position: apiFootballPlayer?.position || canonical?.position || card.position,
            selectionProvider: apiFootballPlayer ? "API-Football" : "FPL fallback",
          };
        });
        const cardById = new Map(cards.map((card) => [Number(card.id), card]));
        const orderedCards = cardIds.map((cardId: number) => cardById.get(cardId));

        if (cards.length !== 5 || orderedCards.some((card: any) => !card) || cards.some((card) => String(card.ownerId) !== userId)) {
          throw new Error("You don't own all selected cards");
        }
        if (cards.some((card) => Boolean(card.forSale))) {
          throw new Error("Cannot use marketplace-listed cards.");
        }
        if (new Set(cards.map((card) => Number(card.playerId))).size !== 5) {
          throw new Error("Lineup must use 5 different players");
        }
        const ineligiblePlayer = cards.find((card) => !isPremierLeague(card.league));
        if (ineligiblePlayer) {
          throw new Error(`Premier League tournaments only accept Premier League player cards. ${ineligiblePlayer.playerName || "This player"} cannot be selected because no current API-Football or FPL fallback link was found.`);
        }
        for (let index = 0; index < TOURNAMENT_REQUIRED_POSITIONS.length; index += 1) {
          if (String(orderedCards[index]?.position || "").toUpperCase() !== TOURNAMENT_REQUIRED_POSITIONS[index]) {
            const card = orderedCards[index];
            throw new Error(`Invalid lineup order: select GK, DEF, MID, FWD, then one Utility player. ${card?.playerName || "This player"} is linked as ${card?.position || "unknown position"} by ${card?.selectionProvider || "stored card data"}; ${TOURNAMENT_REQUIRED_POSITIONS[index]} is required in this slot.`);
          }
        }
        const utilityPosition = String(orderedCards[4]?.position || "").toUpperCase();
        if (!TOURNAMENT_UTILITY_POSITIONS.includes(utilityPosition as typeof TOURNAMENT_UTILITY_POSITIONS[number])) {
          throw new Error("Utility player must be an unused defender, midfielder or forward.");
        }
        const rarityValidation = validateTournamentRarityLineup(cards.map((card) => card.rarity), competition.tier);
        if (!rarityValidation.valid) throw new Error(rarityValidation.message);

        const overlappingEntry = rowsOf(await tx.execute(sql`
          select ce.id
          from app.competition_entries ce
          where ce.competition_id = ${competitionId}
            and ce.user_id = ${userId}
            and exists (
              select 1
              from jsonb_array_elements_text(coalesce(ce.lineup_card_ids, '[]'::jsonb)) as used(card_id)
              where used.card_id::int in (
                select value::int
                from jsonb_array_elements_text(${cardIdsJson}::jsonb)
              )
            )
          limit 1
          for update
        `))[0];
        if (overlappingEntry) {
          throw new Error("Each tournament entry must use five different unused cards.");
        }

        const countRow = rowsOf(await tx.execute(sql`
          select count(*)::int as count
          from app.competition_entries
          where competition_id = ${competitionId}
        `))[0];
        const maxEntries = Number(competition.maxEntries || 0);
        if (maxEntries > 0 && Number(countRow?.count || 0) >= maxEntries) throw new Error("Tournament is full");

        const lockedCard = rowsOf(await tx.execute(sql`
          select card_id as "cardId"
          from app.card_locks
          where card_id in (
            select value::int
            from jsonb_array_elements_text(${cardIdsJson}::jsonb)
          )
            and (expires_at is null or expires_at > now())
          limit 1
        `))[0];
        if (lockedCard) throw new Error("One or more selected cards are already locked in a submitted team");

        const entryFee = toMoney(competition.entryFee);
        if (entryFee > 0) {
          const wallet = rowsOf(await tx.execute(sql`
            update app.wallets
            set balance = balance - ${entryFee}
            where user_id = ${userId} and balance >= ${entryFee}
            returning user_id
          `))[0];
          if (!wallet) throw new Error("Insufficient balance for entry fee");
          await tx.execute(sql`
            insert into app.transactions
              (user_id, type, amount, gross_amount, fee_amount, net_amount, source_type, status, description)
            values
              (${userId}, 'entry_fee', ${-entryFee}, ${entryFee}, 0, ${-entryFee},
               'tournament_entry', 'completed', ${`Entered tournament: ${competition.name}`})
          `);
        }

        const createdEntry = rowsOf(await tx.execute(sql`
          insert into app.competition_entries
            (competition_id, user_id, entry_fee_paid, lineup_card_ids, captain_id, total_score, joined_at)
          values
            (${competitionId}, ${userId}, ${entryFee}, ${cardIdsJson}::jsonb, ${captainId}, 0, now())
          returning *
        `))[0];

        await tx.execute(sql`
          insert into app.card_locks (card_id, user_id, reason, ref_id, created_at)
          select selected.card_id, ${userId}, 'competition', ${String(competitionId)}, now()
          from (
            select value::int as card_id
            from jsonb_array_elements_text(${cardIdsJson}::jsonb)
          ) selected
        `);

        return createdEntry;
      });

      let scoreRefresh: { updatedEntries: number; skipped: boolean } | null = null;
      try {
        const result = await new ScoreUpdateService(storage).updateCompetition(competitionId);
        scoreRefresh = {
          updatedEntries: Number(result.updatedCount || 0),
          skipped: Boolean(result.skipped),
        };
      } catch (error: any) {
        console.warn(`[scoring] Immediate scoring refresh failed for new tournament entry ${entry.id}; the scheduled refresh will retry:`, error?.message || error);
      }

      return res.json({ success: true, message: "Successfully submitted tournament team", entryId: entry.id, scoreRefresh });
    } catch (error: any) {
      const message = error?.message || "Failed to join tournament";
      const validationMessages = [
        "Tournament is full",
        "Insufficient balance for entry fee",
        "Tournament is not open for entries",
        "Gameweek entries are closed",
        "One or more selected cards are already locked in a submitted team",
        "Each tournament entry must use five different unused cards.",
        "Premier League tournaments only accept Premier League player cards.",
        "Invalid lineup order: select GK, DEF, MID, FWD, then one Utility player.",
        "Lineup must use 5 different players",
        "Cannot use marketplace-listed cards.",
        "You don't own all selected cards",
        "Tournament schedule changed; reopen the entry window and try again",
        "Unable to verify the Premier League entry deadline",
      ];
      const status = message === "Tournament not found" ? 404 :
        validationMessages.includes(message) || message.includes("tournaments require") || message.includes("tournaments may only use") ? 400 : 500;
      if (status === 500) console.error("Failed to join competition atomically:", error);
      return res.status(status).json({ message });
    }
  });

  app.get("/api/admin/wallet-postings/integrity", requireAuth, async (req: any, res) => {
    try {
      const adminId = String(req.authUserId || "");
      if (!(await isAdminUser(adminId))) return res.status(403).json({ message: "Admin access required" });
      return res.json(await getWalletPostingIntegrityReport());
    } catch (error: any) {
      console.error("Failed to inspect wallet postings:", error);
      return res.status(500).json({ message: error?.message || "Failed to inspect wallet postings" });
    }
  });

  app.post("/api/admin/competitions/settle/:id", requireAuth, async (req: any, res) => {
    try {
      await ensureCardLockGuard();
      await ensurePrizeAwardSchema();
      await ensureNotificationsSchema();
      const adminId = String(req.authUserId || "");
      if (!(await isAdminUser(adminId))) return res.status(403).json({ message: "Admin access required" });
      const competitionId = Number(req.params.id);
      if (!Number.isInteger(competitionId) || competitionId <= 0) return res.status(400).json({ message: "Valid tournament required" });

      const preview = await storage.getCompetition(competitionId);
      if (!preview) return res.status(404).json({ message: "Tournament not found" });
      if (String(preview.status) !== "completed") {
        const scoring = await new ScoreUpdateService(storage).updateCompetition(competitionId);
        if (scoring.skipped && scoring.reason === "Tournament entries are still open") throw new Error("Tournament entries are still open");
        if (!scoring.final) throw new Error("Gameweek scores are still provisional");
        if (!scoring.complete) throw new Error("Final scoring is incomplete for one or more cards");
      }

      const entries = await storage.getCompetitionEntries(competitionId);
      const ranked = await rankCompetitionEntries(storage, entries);
      if (!ranked.length) return res.status(400).json({ message: "Cannot settle a tournament without entries" });

      const settlement = await db.transaction(async (tx) => {
        const competition = rowsOf(await tx.execute(sql`
          select id, name, status::text as status, tier::text as tier, game_week as "gameWeek",
            coalesce(entry_fee, 0)::float as "entryFee", coalesce(platform_fee_rate, 0.2)::float as "platformFeeRate",
            coalesce(prize_type, 'goods') as "prizeType", coalesce(prize_key, '') as "prizeKey",
            coalesce(prize_description, '') as "prizeDescription", coalesce(visibility, 'public') as visibility,
            created_by_user_id as "createdByUserId"
          from app.competitions
          where id = ${competitionId}
          for update
        `))[0];
        if (!competition) throw new Error("Tournament not found");
        if (!["active", "closed", "completed"].includes(String(competition.status))) {
          throw new Error("Tournament must be closed before settlement");
        }
        const alreadyCompleted = String(competition.status) === "completed";

        const lockedEntries = rowsOf(await tx.execute(sql`
          select id, user_id as "userId", coalesce(entry_fee_paid, 0)::float as "entryFeePaid",
            coalesce(total_score, 0)::float as "totalScore", coalesce(prize_amount, 0)::float as "prizeAmount",
            payout_posting_key as "payoutPostingKey", payout_transaction_id as "payoutTransactionId",
            coalesce(tiebreak_meta, '{}'::jsonb) as "tiebreakMeta"
          from app.competition_entries
          where competition_id = ${competitionId}
          order by id
          for update
        `));
        const rankedIds = ranked.map((entry: any) => Number(entry.id)).sort((a: number, b: number) => a - b);
        const lockedIds = lockedEntries.map((entry: any) => Number(entry.id)).sort((a: number, b: number) => a - b);
        if (rankedIds.length !== lockedIds.length || rankedIds.some((id: number, index: number) => id !== lockedIds[index])) {
          throw new Error("Tournament entries changed during settlement; recalculate rankings and retry");
        }

        if (!alreadyCompleted) {
          for (const entry of lockedEntries) {
            const snapshot = asObject(asObject(entry.tiebreakMeta).scoring);
            if (Number(snapshot.version || 0) < 2 || Number(snapshot.gameWeek || 0) !== Number(competition.gameWeek || 0) || !snapshot.final || !snapshot.complete) {
              throw new Error("Final scoring snapshot is missing or incomplete");
            }
            if (toMoney(snapshot.totalScore) !== toMoney(entry.totalScore)) throw new Error("Stored score does not match the final scoring snapshot");
          }
        }

        const paidFees = lockedEntries.reduce((sum: number, entry: any) => sum + toMoney(entry.entryFeePaid), 0);
        const grossPool = toMoney(paidFees || ranked.length * Number(competition.entryFee || 0));
        const prizeType = String(competition.prizeType || "goods").toLowerCase();
        const prizeVault = isOfficialPrizeVaultCompetition(competition);
        const cashPoolEnabled = prizeType === "cash_pool" || prizeType === "goods_plus_cash";
        const nonCashAwardEnabled = prizeVault || ["goods", "goods_plus_cash", "packs", "sponsor_prize"].includes(prizeType);
        const payoutPercentages = [0.6, 0.3, 0.1];

        let sharedEntries = ranked.length;
        let prizeAward: any = null;
        if (prizeVault) {
          const shared = rowsOf(await tx.execute(sql`
            select count(*)::int as count
            from app.competition_entries ce
            join app.competitions c on c.id = ce.competition_id
            where c.game_week = ${Number(competition.gameWeek)}
              and c.tier::text = ${String(competition.tier)}
              and coalesce(c.visibility, 'public') = 'public'
              and coalesce(c.prize_key, '') = 'ladder'
              and c.created_by_user_id is null
          `))[0];
          sharedEntries = Number(shared?.count || 0);
          prizeAward = getActivePrizeForEntries(competition.tier, sharedEntries).activePrize;
        } else if (nonCashAwardEnabled) {
          prizeAward = {
            key: String(competition.prizeKey || `competition-${competitionId}-prize`),
            title: String(competition.prizeDescription || "Tournament prize"),
            value: 0,
            category: prizeType,
          };
        }

        const feeRate = Math.max(0, Math.min(1, Number(competition.platformFeeRate || 0.2)));
        const cashPrizePool = cashPoolEnabled ? toMoney(grossPool - toMoney(grossPool * feeRate)) : 0;
        const prizeValue = prizeAward ? toMoney(prizeAward.value || 0) : 0;
        const platformFee = cashPoolEnabled ? toMoney(grossPool - cashPrizePool) : toMoney(Math.max(0, grossPool - prizeValue));
        const prizePool = cashPoolEnabled ? cashPrizePool : prizeValue;

        if (alreadyCompleted && cashPoolEnabled) {
          for (let index = 0; index < ranked.length; index += 1) {
            const rankedEntry = ranked[index];
            const lockedEntry = lockedEntries.find((entry: any) => Number(entry.id) === Number(rankedEntry.id));
            const payout = toMoney(cashPrizePool * (payoutPercentages[index] || 0));
            const expectedKey = payout > 0 ? tournamentPayoutPostingKey(competitionId, Number(rankedEntry.id)) : null;
            if (!lockedEntry || toMoney(lockedEntry.prizeAmount) !== payout || String(lockedEntry.payoutPostingKey || "") !== String(expectedKey || "")) {
              throw new Error("Completed tournament payout state no longer matches calculated rankings");
            }
          }
        }

        let replayedPostings = 0;
        for (let index = 0; index < ranked.length; index += 1) {
          const rankedEntry = ranked[index];
          const entryId = Number(rankedEntry.id);
          const payout = cashPoolEnabled ? toMoney(cashPrizePool * (payoutPercentages[index] || 0)) : 0;
          const settlementMeta = {
            ...rankedEntry.tiebreak,
            competitionId,
            gameWeek: Number(competition.gameWeek),
            prizeType,
            prizeVault,
            sharedEntries,
            prizeAward: index === 0 ? prizeAward : null,
            settledAt: new Date().toISOString(),
          };
          await tx.execute(sql`
            update app.competition_entries
            set rank = ${index + 1}, prize_amount = ${payout},
                tiebreak_meta = jsonb_set(coalesce(tiebreak_meta, '{}'::jsonb), '{settlement}', ${JSON.stringify(settlementMeta)}::jsonb, true)
            where id = ${entryId} and competition_id = ${competitionId}
          `);
          if (payout <= 0) continue;

          const winnerId = String(rankedEntry.userId || "");
          const postingKey = tournamentPayoutPostingKey(competitionId, entryId);
          const posting = await postWalletAmountExactlyOnce(tx, {
            postingKey,
            userId: winnerId,
            amount: payout,
            transactionType: "tournament_payout",
            sourceType: "tournament_settlement",
            description: `Tournament payout competition:${competitionId} rank:${index + 1} entry:${entryId}`,
            actorUserId: adminId,
            reason: `Tournament ${competitionId} rank ${index + 1} cash payout`,
            metadata: { competitionId, entryId, rank: index + 1, grossPool, platformFee, prizePool: cashPrizePool },
            auditAction: "wallet.tournament_payout.completed",
          });
          if (posting.replayed) replayedPostings += 1;
          await tx.execute(sql`
            update app.competition_entries
            set payout_posting_key = ${posting.postingKey},
                payout_transaction_id = ${posting.transactionId},
                payout_completed_at = coalesce(payout_completed_at, now())
            where id = ${entryId} and competition_id = ${competitionId}
          `);
          await createNotificationOnce(tx, {
            userId: winnerId,
            type: index === 0 ? "win" : "runner_up",
            title: `Congratulations — #${index + 1} in ${competition.name}`,
            message: `Congratulations from the Fantasy Arena Team! You finished #${index + 1} in ${competition.name} with ${toMoney(rankedEntry.totalScore).toFixed(1)} points. N$${payout.toFixed(2)} has been credited to your Fantasy Arena wallet.`,
            dedupeKey: `competition:${competitionId}:entry:${entryId}:cash-congratulations`,
          });
        }

        let awardRecord: any = null;
        if (nonCashAwardEnabled && prizeAward) {
          const winner = ranked[0];
          const winnerEntryId = Number(winner.id);
          const winnerUserId = String(winner.userId || "");
          await tx.execute(sql`
            insert into app.competition_prize_awards
              (competition_id, entry_id, user_id, game_week, rarity, prize_key, prize_title, prize_value, prize_category, status, metadata)
            values
              (${competitionId}, ${winnerEntryId}, ${winnerUserId}, ${Number(competition.gameWeek)}, ${String(competition.tier)},
               ${String(prizeAward.key || "prize")}, ${String(prizeAward.title || "Tournament prize")}, ${toMoney(prizeAward.value || 0)},
               ${String(prizeAward.category || prizeType)}, 'pending_claim',
               ${JSON.stringify({ sharedEntries, requiredEntrants: prizeAward.requiredEntrants || null, unlockTarget: prizeAward.unlockTarget || null, prizeVault })}::jsonb)
            on conflict (competition_id, entry_id) do nothing
          `);
          awardRecord = rowsOf(await tx.execute(sql`
            select competition_id as "competitionId", entry_id as "entryId", user_id as "userId", game_week as "gameWeek",
              rarity, prize_key as "prizeKey", prize_title as "prizeTitle", coalesce(prize_value, 0)::float as "prizeValue",
              prize_category as "prizeCategory", status
            from app.competition_prize_awards
            where competition_id = ${competitionId} and entry_id = ${winnerEntryId}
            limit 1
          `))[0];
          if (!awardRecord || String(awardRecord.prizeKey) !== String(prizeAward.key || "prize") || toMoney(awardRecord.prizeValue) !== toMoney(prizeAward.value || 0)) {
            throw new Error("Prize Vault award state no longer matches the unlocked prize");
          }

          const valuedAt = toMoney(awardRecord.prizeValue) > 0 ? `, valued at N$${toMoney(awardRecord.prizeValue).toFixed(2)}` : "";
          await createNotificationOnce(tx, {
            userId: winnerUserId,
            type: "win",
            title: `Congratulations — you won ${awardRecord.prizeTitle}`,
            message: `Congratulations from the Fantasy Arena Team! You won ${competition.name} with ${toMoney(winner.totalScore).toFixed(1)} points and earned ${awardRecord.prizeTitle}${valuedAt}. Next steps: open My Teams & Prizes and start the prize claim; confirm your contact and delivery details; complete any required identity and age verification; then wait for Fantasy Arena to confirm prize availability and fulfilment. If the advertised prize is unavailable, an equivalent prize or approved equivalent value may be offered, subject to availability.`,
            dedupeKey: `competition:${competitionId}:entry:${winnerEntryId}:prize-congratulations`,
          });
        }

        await tx.execute(sql`
          update app.competitions
          set status = 'completed', platform_fee_total = ${platformFee}, prize_pool_total = ${prizePool}
          where id = ${competitionId}
        `);
        await tx.execute(sql`
          delete from app.card_locks
          where reason = 'competition' and ref_id = ${String(competitionId)}
        `);
        await tx.execute(sql`
          insert into app.audit_logs (user_id, action, meta)
          values (${adminId}, 'admin.tournament.settled', ${JSON.stringify({ competitionId, grossPool, platformFee, prizePool, prizeType, prizeVault, sharedEntries, prizeAward: awardRecord, cardLocksReleased: true, replayedPostings })}::jsonb)
        `);

        return {
          grossPool,
          platformFee,
          prizePool,
          prizeType,
          prizeVault,
          sharedEntries,
          prizeAward: awardRecord,
          winnersCount: cashPoolEnabled ? Math.min(3, ranked.length) : awardRecord ? 1 : 0,
          replayedPostings,
          replayed: alreadyCompleted,
        };
      });

      return res.json({
        success: true,
        message: settlement.replayed
          ? "Tournament settlement already completed and verified"
          : settlement.prizeVault
            ? settlement.prizeAward ? "Tournament settled and Prize Vault claim created" : "Tournament settled; no Prize Vault tier was unlocked"
            : "Tournament settled with final scoring snapshots and exactly-once rewards",
        winner: ranked[0] || null,
        winnersCount: settlement.winnersCount,
        settlement,
      });
    } catch (error: any) {
      const message = error?.message || "Failed to settle tournament";
      const validationMessages = [
        "Tournament must be closed before settlement",
        "Cannot settle a tournament without entries",
        "Tournament entries changed during settlement; recalculate rankings and retry",
        "Completed tournament payout state no longer matches calculated rankings",
        "Prize Vault award state no longer matches the unlocked prize",
        "Tournament entries are still open",
        "Gameweek scores are still provisional",
        "Final scoring is incomplete for one or more cards",
        "Final scoring snapshot is missing or incomplete",
        "Stored score does not match the final scoring snapshot",
      ];
      const status = message === "Tournament not found" ? 404 : validationMessages.includes(message) ? 400 : 500;
      if (status === 500) console.error("Failed to settle competition atomically:", error);
      return res.status(status).json({ message });
    }
  });
}
