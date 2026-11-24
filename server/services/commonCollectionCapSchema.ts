import { sql } from 'drizzle-orm';
import { db } from '../db.js';

// Protect all acquisition paths, including transfers/referrals. Legacy excess
// stays owned until the manager chooses which ten to keep; never auto-delete.
export async function ensureCommonCollectionCapSchema() {
  await db.execute(sql.raw(`
    CREATE OR REPLACE FUNCTION app.enforce_common_collection_cap() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.owner_id IS NULL OR NEW.rarity::text <> 'common' THEN RETURN NEW; END IF;
      IF TG_OP='UPDATE' THEN
        IF OLD.owner_id IS NOT DISTINCT FROM NEW.owner_id AND OLD.rarity::text='common' THEN RETURN NEW; END IF;
      END IF;
      PERFORM pg_advisory_xact_lock(hashtext('common-cap:' || NEW.owner_id));
      IF (SELECT count(*) FROM app.player_cards WHERE owner_id=NEW.owner_id AND rarity::text='common' AND id<>NEW.id) >= 10 THEN
        RAISE EXCEPTION 'Common collection limit is 10. Choose a Common replacement or reduce your collection first. Other rarities are unaffected.';
      END IF;
      RETURN NEW;
    END $$;
  `));
  await db.execute(sql.raw(`DROP TRIGGER IF EXISTS common_collection_cap_guard ON app.player_cards;`));
  await db.execute(sql.raw(`CREATE TRIGGER common_collection_cap_guard BEFORE INSERT OR UPDATE OF owner_id,rarity ON app.player_cards
      FOR EACH ROW EXECUTE FUNCTION app.enforce_common_collection_cap();
  `));
}
