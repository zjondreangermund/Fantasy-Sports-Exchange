import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = path.join(root, "server", "routes", "economyIntegrity.routes.ts");
let source = fs.readFileSync(file, "utf8");

const MARKER = "FREE_CARD_CUP_AUTO_AWARD_V1";
if (source.includes(MARKER)) {
  console.log("[free-card-cups] Verified automatic card awards already applied");
  process.exit(0);
}

function replaceOnce(from, to, label) {
  if (!source.includes(from)) throw new Error(`Free Card Cup auto-award anchor not found: ${label}`);
  source = source.replace(from, to);
}

replaceOnce(
`            coalesce(prize_type, 'goods') as "prizeType", coalesce(prize_key, '') as "prizeKey",
            coalesce(prize_description, '') as "prizeDescription", coalesce(visibility, 'public') as visibility,
            created_by_user_id as "createdByUserId"`,
`            coalesce(prize_type, 'goods') as "prizeType", coalesce(prize_key, '') as "prizeKey",
            coalesce(prize_description, '') as "prizeDescription", coalesce(visibility, 'public') as visibility,
            prize_card_rarity::text as "prizeCardRarity", created_by_user_id as "createdByUserId"`,
"settlement prize-card rarity select",
);

replaceOnce(
`            coalesce(total_score, 0)::float as "totalScore", coalesce(prize_amount, 0)::float as "prizeAmount",
            payout_posting_key as "payoutPostingKey", payout_transaction_id as "payoutTransactionId",`,
`            coalesce(total_score, 0)::float as "totalScore", coalesce(prize_amount, 0)::float as "prizeAmount",
            prize_card_id as "prizeCardId", payout_posting_key as "payoutPostingKey", payout_transaction_id as "payoutTransactionId",`,
"locked entry prize card select",
);

replaceOnce(
`        const prizeType = String(competition.prizeType || "goods").toLowerCase();
        const prizeVault = isOfficialPrizeVaultCompetition(competition);
        const cashPoolEnabled = prizeType === "cash_pool" || prizeType === "goods_plus_cash";
        const nonCashAwardEnabled = prizeVault || ["goods", "goods_plus_cash", "packs", "sponsor_prize"].includes(prizeType);
        const payoutPercentages = [0.6, 0.3, 0.1];`,
`        const prizeType = String(competition.prizeType || "goods").toLowerCase();
        const prizeVault = isOfficialPrizeVaultCompetition(competition);
        const prizeCardRarity = String(competition.prizeCardRarity || "").toLowerCase();
        // FREE_CARD_CUP_AUTO_AWARD_V1
        const freeCardCup = Number(competition.entryFee || 0) <= 0
          && Boolean(prizeCardRarity)
          && String(competition.prizeKey || "").toLowerCase().startsWith("free-");
        const cashPoolEnabled = prizeType === "cash_pool" || prizeType === "goods_plus_cash";
        const nonCashAwardEnabled = !freeCardCup && (prizeVault || ["goods", "goods_plus_cash", "packs", "sponsor_prize"].includes(prizeType));
        const payoutPercentages = [0.6, 0.3, 0.1];`,
"free card cup settlement detection",
);

const awardAnchor = `        let awardRecord: any = null;
        if (nonCashAwardEnabled && prizeAward) {`;
const awardBlock = `        let freeCardAward: any = null;
        if (freeCardCup) {
          const winner = ranked[0];
          const winnerEntryId = Number(winner.id);
          const winnerUserId = String(winner.userId || "");
          const lockedWinner = lockedEntries.find((entry: any) => Number(entry.id) === winnerEntryId);
          const existingPrizeCardId = Number(lockedWinner?.prizeCardId || 0);

          if (existingPrizeCardId > 0) {
            freeCardAward = rowsOf(await tx.execute(sql\`
              select pc.id, pc.player_id as "playerId", pc.rarity::text as rarity, p.name as "playerName"
              from app.player_cards pc
              join app.players p on p.id = pc.player_id
              where pc.id = \${existingPrizeCardId} and pc.owner_id = \${winnerUserId}
              limit 1
            \`))[0];
            if (!freeCardAward) throw new Error("Completed Free Card Cup prize card no longer belongs to the winner");
          } else {
            const supplyByRarity: Record<string, number> = { common: 1000, rare: 100, unique: 10, epic: 3, legendary: 1 };
            const maxSupply = Number(supplyByRarity[prizeCardRarity] || 0);
            if (maxSupply <= 0) throw new Error("Free Card Cup prize rarity is invalid");

            const candidates = rowsOf(await tx.execute(sql\`
              select p.id, p.name
              from app.players p
              where regexp_replace(lower(coalesce(p.league, '')), '[^a-z0-9]+', '', 'g') in ('premierleague','englishpremierleague','epl')
                and not exists (
                  select 1 from app.player_cards owned
                  where owned.owner_id = \${winnerUserId}
                    and owned.player_id = p.id
                    and owned.rarity::text = \${prizeCardRarity}
                )
                and (
                  select count(*) from app.player_cards supplied
                  where supplied.player_id = p.id and supplied.rarity::text = \${prizeCardRarity}
                ) < \${maxSupply}
              order by random()
              limit 25
            \`));

            for (const candidate of candidates) {
              const playerId = Number(candidate.id || 0);
              if (!playerId) continue;
              await tx.execute(sql\`select pg_advisory_xact_lock(94117, \${playerId})\`);
              const state = rowsOf(await tx.execute(sql\`
                select
                  (select count(*)::int from app.player_cards pc where pc.player_id = \${playerId} and pc.rarity::text = \${prizeCardRarity}) as count,
                  (select coalesce(max(pc.serial_number), 0)::int from app.player_cards pc where pc.player_id = \${playerId} and pc.rarity::text = \${prizeCardRarity}) as "maxSerial",
                  exists(select 1 from app.player_cards pc where pc.owner_id = \${winnerUserId} and pc.player_id = \${playerId} and pc.rarity::text = \${prizeCardRarity}) as owned
              \`))[0];
              if (Boolean(state?.owned) || Number(state?.count || 0) >= maxSupply) continue;

              const nextSerial = Number(state?.maxSerial || 0) + 1;
              const initials = String(candidate.name || "PLAYER")
                .split(/\\s+/)
                .filter(Boolean)
                .map((part: string) => part[0])
                .join("")
                .toUpperCase()
                .slice(0, 3) || "PLY";
              const serialId = \`\${initials}-\${prizeCardRarity.charAt(0).toUpperCase()}-\${String(nextSerial).padStart(4, "0")}\`;
              freeCardAward = rowsOf(await tx.execute(sql\`
                insert into app.player_cards
                  (player_id, owner_id, rarity, serial_id, serial_number, max_supply, level, xp, decisive_score, last_5_scores, for_sale, price, acquired_at)
                values
                  (\${playerId}, \${winnerUserId}, \${prizeCardRarity}::app.rarity, \${serialId}, \${nextSerial}, \${maxSupply}, 1, 0, 35, '[0,0,0,0,0]'::jsonb, false, 0, now())
                returning id, player_id as "playerId", rarity::text as rarity
              \`))[0];
              if (freeCardAward) {
                freeCardAward.playerName = String(candidate.name || "Player");
                await tx.execute(sql\`
                  update app.competition_entries
                  set prize_card_id = \${Number(freeCardAward.id)}
                  where id = \${winnerEntryId} and competition_id = \${competitionId}
                \`);
                break;
              }
            }
            if (!freeCardAward) throw new Error("No eligible player card is available for this Free Card Cup reward");
          }

          prizeAward = {
            key: \`free-\${String(freeCardAward.rarity || prizeCardRarity)}-card-\${Number(freeCardAward.id)}\`,
            title: \`\${String(freeCardAward.playerName || "Player")} \${String(freeCardAward.rarity || prizeCardRarity).charAt(0).toUpperCase() + String(freeCardAward.rarity || prizeCardRarity).slice(1)} Card\`,
            value: 0,
            category: "card",
            cardId: Number(freeCardAward.id),
            playerId: Number(freeCardAward.playerId),
          };

          await createNotificationOnce(tx, {
            userId: winnerUserId,
            type: "win",
            title: \`Congratulations — you won a \${String(freeCardAward.rarity || prizeCardRarity).toUpperCase()} player card\`,
            message: \`You won \${competition.name} with \${toMoney(winner.totalScore).toFixed(1)} points. Your \${prizeAward.title} has been added to Collection. Keep it, use it in eligible rarity tournaments, or list it on the Marketplace when trading is open.\`,
            dedupeKey: \`competition:\${competitionId}:entry:\${winnerEntryId}:free-card-award\`,
          });
        }

        let awardRecord: any = null;
        if (nonCashAwardEnabled && prizeAward) {`;
replaceOnce(awardAnchor, awardBlock, "automatic free card award");

fs.writeFileSync(file, source);
console.log("[free-card-cups] Applied automatic card ownership rewards for Free Card Cups");
