import { sql } from "drizzle-orm";
import { db } from "../db.js";

export const NON_REAL_MARKETPLACE_OWNER_IDS = [
  "demo-buyer-1",
  "demo-seller-1",
  "demo-admin-1",
] as const;

const nonRealOwnerIds = sql.join(
  NON_REAL_MARKETPLACE_OWNER_IDS.map((ownerId) => sql`${ownerId}`),
  sql`, `,
);

export async function unlistNonRealMarketplaceListings(): Promise<number> {
  const result = await db.execute(sql`
    UPDATE app.player_cards AS card
    SET for_sale = false, price = 0
    WHERE card.for_sale = true
      AND (
        card.owner_id IS NULL
        OR card.owner_id IN (${nonRealOwnerIds})
        OR NOT EXISTS (
          SELECT 1
          FROM app.users AS real_owner
          WHERE real_owner.id = card.owner_id
        )
      )
    RETURNING id
  `);
  const rows = Array.isArray((result as any)?.rows) ? (result as any).rows : [];
  return rows.length;
}
