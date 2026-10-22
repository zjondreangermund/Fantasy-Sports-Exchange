import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = path.join(root, "server", "routes", "economyIntegrity.routes.ts");
let source = fs.readFileSync(file, "utf8");

const MARKER = "FREE_CARD_CUP_AUTO_AWARD_V3_TOP3_CLAIMS";
if (source.includes(MARKER)) {
  console.log("[free-card-cups] Verified all-player randomized card awards already applied");
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
        // FREE_CARD_CUP_AUTO_AWARD_V2_ALL_PLAYERS\n        // FREE_CARD_CUP_AUTO_AWARD_V3_TOP3_CLAIMS
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
const awardBlock = `        // FREE_CARD_CUP_AUTO_AWARD_V3_TOP3_CLAIMS
        // TOURNAMENT_WINNER_MANUAL_MINT_V1: the settlement RECORDS the
        // reward entitlement. Only a manager pressing Mint creates the card.
        let freeCardAward: any = null;
        if (freeCardCup) {
          for (let index = 0; index < Math.min(3, ranked.length); index += 1) {
            const placed = ranked[index];
            const placedEntryId = Number(placed.id);
            const placedUserId = String(placed.userId || "");
            const placedRank = index + 1;
            const rarity = index === 0 ? "rare" : "common";
            const oldEntry = lockedEntries.find((entry: any) => Number(entry.id) === placedEntryId);
            const existingCardId = Number(oldEntry?.prizeCardId || 0);
            const placedPrize = {
              key: "free-common-card-rank-" + placedRank,
              title: index === 0 ? "Random Rare Player Card" : "Random Common Player Card",
              value: 0, category: "card", rarity, rank: placedRank,
              claimPending: existingCardId <= 0,
              cardId: existingCardId || null,
            };
            if (index === 0) {
              prizeAward = placedPrize;
              freeCardAward = {rarity,cardId:existingCardId||null,claimed:existingCardId>0};
            }
            await tx.execute(sql\`
              update app.competition_entries
              set tiebreak_meta = jsonb_set(coalesce(tiebreak_meta, '{}'::jsonb), '{settlement,prizeAward}', \${JSON.stringify(placedPrize)}::jsonb, true)
              where id = \${placedEntryId} and competition_id = \${competitionId}
            \`);
            await tx.execute(sql\`
              insert into app.competition_prize_awards
                (competition_id, entry_id, user_id, game_week, rarity, prize_key, prize_title, prize_value, prize_category, status, metadata)
              values
                (\${competitionId}, \${placedEntryId}, \${placedUserId}, \${Number(competition.gameWeek)},
                 \${rarity}, \${String(placedPrize.key)}, \${String(placedPrize.title)}, 0, 'card',
                 \${existingCardId>0?'claimed':'pending_claim'},
                 \${JSON.stringify({rank:placedRank,freeCommonCup:true,oneCardOnly:true})}::jsonb)
              on conflict (competition_id, entry_id) do nothing
            \`);
            await createNotificationOnce(tx,{
              userId:placedUserId,type:index===0?"win":"runner_up",
              title:index===0?"🏆 Congratulations — 1st place Rare card":
                "🎉 Congratulations — #" + placedRank + " wins a Common card",
              message:"You finished #" + placedRank + " in " + competition.name +
                " with " + toMoney(placed.totalScore).toFixed(1) +
                " points. Your winning " + rarity.toUpperCase() +
                " player card is waiting. Open your Trophy Cabinet and tap Mint to reveal your random Premier League player. This reward is yours even if you mint later.",
              dedupeKey:"competition:" + competitionId + ":entry:" + placedEntryId + ":free-card-claim-ready",
            });
          }
        }
        let awardRecord: any = freeCardAward ? {
          competitionId,
          entryId:Number(ranked[0].id),userId:String(ranked[0].userId||""),
          gameWeek:Number(competition.gameWeek),
          rarity:"rare",prizeKey:String(prizeAward?.key||"free-common-card-rank-1"),
          prizeTitle:String(prizeAward?.title||"Random Rare Player Card"),
          prizeValue:0,prizeCategory:"card",
          status:freeCardAward.claimed?"claimed":"pending_claim",
          cardId:freeCardAward.cardId,
        } : null;
        if (nonCashAwardEnabled && prizeAward) {`;
replaceOnce(awardAnchor, awardBlock, "automatic all-player free card award");

fs.writeFileSync(file, source);
console.log("[free-card-cups] Applied randomized automatic card rewards across the full current Premier League player pool");
