import {sql} from "drizzle-orm";
// Canonical leaderboard SQL. Both live views and the leaderboard use the same
// score and deterministic order, scoped per competition, including exact ties.
export const leaderboardTotal=sql`coalesce(nullif(ce.tiebreak_meta->'scoring'->>'totalScore', '')::float, ce.total_score, 0)`;
export const leaderboardRank=sql`row_number() over (
              partition by ce.competition_id order by
                ${leaderboardTotal} desc,
                coalesce(nullif(ce.tiebreak_meta->'scoring'->>'captainBasePoints', '')::float, 0) desc,
                coalesce(nullif(ce.tiebreak_meta->'scoring'->>'goalsScored', '')::float, 0) desc,
                coalesce(nullif(ce.tiebreak_meta->'scoring'->>'assists', '')::float, 0) desc,
                coalesce(nullif(ce.tiebreak_meta->'scoring'->>'keyPasses', '')::float, 0) desc,
                coalesce(nullif(ce.tiebreak_meta->'scoring'->>'shotsOnTarget', '')::float, 0) desc,
                coalesce(nullif(ce.tiebreak_meta->'scoring'->>'defensiveActions', '')::float, 0) desc,
                coalesce(nullif(ce.tiebreak_meta->'scoring'->>'goalkeeperSaves', '')::float, 0) desc,
                coalesce(nullif(ce.tiebreak_meta->'scoring'->>'completedPasses', '')::float, 0) desc,
                coalesce(nullif(ce.tiebreak_meta->'scoring'->>'minutesPlayed', '')::float, 0) desc,
                coalesce(nullif(ce.tiebreak_meta->'scoring'->>'squadValue', '')::float, 0) asc,
                coalesce(nullif(ce.tiebreak_meta->'scoring'->>'totalXp', '')::float, 0) desc,
                coalesce(nullif(ce.tiebreak_meta->'scoring'->>'rarityPrestige', '')::float, 0) desc,
                ce.joined_at asc,
                ce.id asc
            )::int`;
