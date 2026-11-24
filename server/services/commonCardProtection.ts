import { sql } from "drizzle-orm";
const rowsOf = (r:any):any[] => r?.rows || (Array.isArray(r) ? r : []);
export async function findBlockedCards(executor: any, userId: string, cardIds: number[], includeSavedDraft = true) {
  if (!cardIds.length) return [];
  // Drizzle expands JavaScript arrays into SQL records. Bind one typed array
  // literal instead so PostgreSQL never attempts to cast a record to integer[].
  const cardIdArray = `{${Array.from(new Set(cardIds.filter(id => Number.isInteger(id) && id > 0))).sort((a,b) => a-b).join(",")}}`;
  return rowsOf(await executor.execute(sql`
    SELECT DISTINCT blocked.card_id AS "cardId", blocked.reason
    FROM (
      SELECT cl.card_id, 'competition_lock'::text AS reason
      FROM app.card_locks cl
      WHERE cl.card_id = ANY(${cardIdArray}::int[])
        AND (cl.expires_at IS NULL OR cl.expires_at > now())
        AND (cl.reason::text <> 'competition' OR EXISTS (
          SELECT 1 FROM app.competitions locked_competition
          WHERE locked_competition.id::text=cl.ref_id
            AND locked_competition.status::text NOT IN ('completed','cancelled')
        ))
      UNION ALL
      SELECT a.card_id, 'auction'::text AS reason
      FROM app.auctions a
      WHERE a.card_id = ANY(${cardIdArray}::int[]) AND a.status::text IN ('draft', 'live')
      UNION ALL
      SELECT so.offered_card_id, 'pending_swap'::text AS reason
      FROM app.swap_offers so
      WHERE so.offered_card_id = ANY(${cardIdArray}::int[]) AND so.status::text = 'pending'
      UNION ALL
      SELECT so.requested_card_id, 'pending_swap'::text AS reason
      FROM app.swap_offers so
      WHERE so.requested_card_id = ANY(${cardIdArray}::int[]) AND so.status::text = 'pending'
      UNION ALL
      SELECT l.card_id, 'loan'::text AS reason
      FROM app.card_loans l
      WHERE l.card_id = ANY(${cardIdArray}::int[]) AND l.status IN ('open', 'active')
      UNION ALL
      SELECT entry_card.value::int AS card_id, 'submitted_tournament'::text AS reason
      FROM app.competition_entries ce JOIN app.competitions competition ON competition.id=ce.competition_id
      CROSS JOIN LATERAL jsonb_array_elements_text(
        CASE WHEN jsonb_typeof(ce.lineup_card_ids)='array' THEN ce.lineup_card_ids ELSE '[]'::jsonb END
      ) AS entry_card(value)
      WHERE ce.user_id=${userId} AND competition.status::text NOT IN ('completed','cancelled')
        AND entry_card.value::int=ANY(${cardIdArray}::int[])
      UNION ALL
      SELECT lineup_card.value::int AS card_id, 'active_lineup'::text AS reason
      FROM app.lineups lineup
      CROSS JOIN LATERAL jsonb_array_elements_text(
        CASE WHEN jsonb_typeof(lineup.card_ids) = 'array' THEN lineup.card_ids ELSE '[]'::jsonb END
      ) AS lineup_card(value)
      WHERE ${includeSavedDraft}::boolean AND lineup.user_id = ${userId} AND lineup_card.value::int = ANY(${cardIdArray}::int[])
    ) blocked
    ORDER BY blocked.card_id, blocked.reason
  `));
}

