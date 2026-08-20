import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = path.join(root, "server", "routes", "economyIntegrity.routes.ts");
let source = fs.readFileSync(file, "utf8");

const MARKER = "FREE_CARD_CUP_AUTO_AWARD_V2_ALL_PLAYERS";
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
        // FREE_CARD_CUP_AUTO_AWARD_V2_ALL_PLAYERS
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
              select pc.id, pc.player_id as "playerId", pc.rarity::text as rarity,
                     p.name as "playerName", p.team as "playerTeam", p.fpl_id as "fplId"
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

            let livePlayers: any[] = [];
            let liveTeams: any[] = [];
            try {
              const [playersPayload, bootstrap] = await Promise.all([fplApi.getPlayers(), fplApi.bootstrap()]);
              livePlayers = Array.isArray(playersPayload) ? playersPayload : [];
              liveTeams = Array.isArray(bootstrap?.teams) ? bootstrap.teams : [];
            } catch (error) {
              console.warn("Live FPL player pool unavailable during Free Card Cup settlement; using the complete local Premier League pool.", error);
            }

            const currentTeamIds = new Set<number>(liveTeams.map((team: any) => Number(team?.id)).filter((id: number) => Number.isInteger(id) && id > 0));
            const currentPlayers = livePlayers.filter((player: any) => {
              const fplId = Number(player?.id);
              const teamId = Number(player?.team);
              return Number.isInteger(fplId) && fplId > 0 && (!currentTeamIds.size || currentTeamIds.has(teamId));
            });

            // Fisher-Yates: every current FPL player has an equal position in the draw.
            for (let i = currentPlayers.length - 1; i > 0; i -= 1) {
              const j = Math.floor(Math.random() * (i + 1));
              [currentPlayers[i], currentPlayers[j]] = [currentPlayers[j], currentPlayers[i]];
            }

            const teamMap = new Map<number, any>(liveTeams.map((team: any) => [Number(team?.id), team] as [number, any]));
            const positionMap: Record<number, "GK" | "DEF" | "MID" | "FWD"> = { 1: "GK", 2: "DEF", 3: "MID", 4: "FWD" };

            const tryMintForPlayer = async (candidate: any) => {
              const fplId = Number(candidate?.id || candidate?.fplId || 0);
              let playerId = Number(candidate?.localPlayerId || 0);
              let playerName = String(candidate?.name || "");
              let playerTeam = String(candidate?.teamName || "");

              if (!playerId && fplId > 0) {
                await tx.execute(sql\`select pg_advisory_xact_lock(94116, \${fplId})\`);
                let local = rowsOf(await tx.execute(sql\`
                  select id, name, team, fpl_id as "fplId"
                  from app.players
                  where fpl_id = \${fplId}
                  order by id
                  limit 1
                  for update
                \`))[0];

                if (!local) {
                  const teamName = String(teamMap.get(Number(candidate?.team))?.name || "Unknown");
                  const position = positionMap[Number(candidate?.element_type)] || "MID";
                  const fullName = (String(candidate?.first_name || "").trim() + " " + String(candidate?.second_name || "").trim()).trim()
                    || String(candidate?.web_name || "Premier League Player");
                  const photoUrl = fplApi.playerPhotoUrl(candidate, 250);
                  const overall = Math.max(55, Math.min(95, Math.round(Number(candidate?.now_cost || 50) + 30)));
                  local = rowsOf(await tx.execute(sql\`
                    insert into app.players
                      (name, team, league, position, nationality, age, overall, image_url, fpl_id, code, photo, web_name,
                       status, news, now_cost, selected_by_percent, total_points, form, synced_at)
                    values
                      (\${fullName}, \${teamName}, 'Premier League', \${position}, 'Unknown', 24, \${overall}, \${photoUrl},
                       \${fplId}, \${Number(candidate?.code || 0) || null}, \${photoUrl}, \${String(candidate?.web_name || fullName)},
                       \${String(candidate?.status || "a")}, \${String(candidate?.news || "")}, \${Number(candidate?.now_cost || 0)},
                       \${Number(candidate?.selected_by_percent || 0)}, \${Number(candidate?.total_points || 0)}, \${Number(candidate?.form || 0)}, now())
                    returning id, name, team, fpl_id as "fplId"
                  \`))[0];
                }
                playerId = Number(local?.id || 0);
                playerName = String(local?.name || playerName || "Player");
                playerTeam = String(local?.team || playerTeam || "Premier League");
              }

              if (!playerId) return null;
              await tx.execute(sql\`select pg_advisory_xact_lock(94117, \${playerId})\`);
              const state = rowsOf(await tx.execute(sql\`
                select
                  (select count(*)::int from app.player_cards pc where pc.player_id = \${playerId} and pc.rarity::text = \${prizeCardRarity}) as count,
                  (select coalesce(max(pc.serial_number), 0)::int from app.player_cards pc where pc.player_id = \${playerId} and pc.rarity::text = \${prizeCardRarity}) as "maxSerial",
                  exists(select 1 from app.player_cards pc where pc.owner_id = \${winnerUserId} and pc.player_id = \${playerId} and pc.rarity::text = \${prizeCardRarity}) as owned
              \`))[0];
              if (Boolean(state?.owned) || Number(state?.count || 0) >= maxSupply) return null;

              const nextSerial = Number(state?.maxSerial || 0) + 1;
              const initials = String(playerName || "PLAYER")
                .split(/\\s+/)
                .filter(Boolean)
                .map((part: string) => part[0])
                .join("")
                .toUpperCase()
                .slice(0, 3) || "PLY";
              const serialId = initials + "-" + prizeCardRarity.charAt(0).toUpperCase() + "-" + playerId + "-" + String(nextSerial).padStart(4, "0");
              const minted = rowsOf(await tx.execute(sql\`
                insert into app.player_cards
                  (player_id, owner_id, rarity, serial_id, serial_number, max_supply, level, xp, decisive_score, last_5_scores, for_sale, price, acquired_at)
                values
                  (\${playerId}, \${winnerUserId}, \${prizeCardRarity}, \${serialId}, \${nextSerial}, \${maxSupply}, 1, 0, 35, '[0,0,0,0,0]'::jsonb, false, 0, now())
                returning id, player_id as "playerId", rarity::text as rarity
              \`))[0];
              if (!minted) return null;
              minted.playerName = playerName || "Player";
              minted.playerTeam = playerTeam || "Premier League";
              minted.fplId = fplId || null;
              return minted;
            };

            // Primary draw: every player in every current Premier League/FPL squad.
            for (const candidate of currentPlayers) {
              freeCardAward = await tryMintForPlayer(candidate);
              if (freeCardAward) break;
            }

            // Resilient fallback if live FPL is temporarily unavailable or a current row
            // has not yet been mapped locally. Still draws randomly from the full local EPL pool.
            if (!freeCardAward) {
              const localCandidates = rowsOf(await tx.execute(sql\`
                select p.id as "localPlayerId", p.name, p.team as "teamName", p.fpl_id as "fplId"
                from app.players p
                where regexp_replace(lower(coalesce(p.league, '')), '[^a-z0-9]+', '', 'g') in ('premierleague','englishpremierleague','epl')
                order by random()
              \`));
              for (const candidate of localCandidates) {
                freeCardAward = await tryMintForPlayer(candidate);
                if (freeCardAward) break;
              }
            }

            if (!freeCardAward) throw new Error("No eligible player card is available across the current Premier League player pool for this Free Card Cup reward");

            await tx.execute(sql\`
              update app.competition_entries
              set prize_card_id = \${Number(freeCardAward.id)}
              where id = \${winnerEntryId} and competition_id = \${competitionId}
            \`);
          }

          prizeAward = {
            key: "free-" + String(freeCardAward.rarity || prizeCardRarity) + "-card-" + Number(freeCardAward.id),
            title: String(freeCardAward.playerName || "Player") + " " + (String(freeCardAward.rarity || prizeCardRarity).charAt(0).toUpperCase() + String(freeCardAward.rarity || prizeCardRarity).slice(1)) + " Card",
            value: 0,
            category: "card",
            cardId: Number(freeCardAward.id),
            playerId: Number(freeCardAward.playerId),
            playerTeam: String(freeCardAward.playerTeam || "Premier League"),
            randomizedAcrossAllCurrentPlayers: true,
          };

          await tx.execute(sql\`
            update app.competition_entries
            set tiebreak_meta = jsonb_set(coalesce(tiebreak_meta, '{}'::jsonb), '{settlement,prizeAward}', \${JSON.stringify(prizeAward)}::jsonb, true)
            where id = \${winnerEntryId} and competition_id = \${competitionId}
          \`);

          await createNotificationOnce(tx, {
            userId: winnerUserId,
            type: "win",
            title: "Congratulations — you won a " + String(freeCardAward.rarity || prizeCardRarity).toUpperCase() + " player card",
            message: "You won " + competition.name + " with " + toMoney(winner.totalScore).toFixed(1) + " points. Your randomized " + prizeAward.title + " (" + String(freeCardAward.playerTeam || "Premier League") + ") has been added to Collection. The draw uses the full current Premier League player pool across all clubs.",
            dedupeKey: "competition:" + competitionId + ":entry:" + winnerEntryId + ":free-card-award",
          });
        }

        let awardRecord: any = freeCardAward ? {
          competitionId,
          entryId: Number(ranked[0]?.id || 0),
          userId: String(ranked[0]?.userId || ""),
          gameWeek: Number(competition.gameWeek),
          rarity: String(freeCardAward.rarity || prizeCardRarity),
          prizeKey: String(prizeAward?.key || "free-card"),
          prizeTitle: String(prizeAward?.title || "Player Card"),
          prizeValue: 0,
          prizeCategory: "card",
          status: "awarded",
          cardId: Number(freeCardAward.id),
          playerId: Number(freeCardAward.playerId),
          playerTeam: String(freeCardAward.playerTeam || "Premier League"),
        } : null;
        if (nonCashAwardEnabled && prizeAward) {`;
replaceOnce(awardAnchor, awardBlock, "automatic all-player free card award");

fs.writeFileSync(file, source);
console.log("[free-card-cups] Applied randomized automatic card rewards across the full current Premier League player pool");
