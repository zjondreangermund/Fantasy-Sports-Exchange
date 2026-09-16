import pg from "pg";

const { Client } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to install tournament rarity enforcement");
}

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
});

function invalidRuleSql(alias = "stats") {
  return `
    case ${alias}.tier
      when 'common' then not (${alias}.card_count = 5 and ${alias}.distinct_card_count = 5 and ${alias}.common_count = 5)
      when 'rare' then not (${alias}.card_count = 5 and ${alias}.distinct_card_count = 5 and ${alias}.rare_count >= 4 and (${alias}.common_count + ${alias}.rare_count) = 5)
      when 'unique' then not (${alias}.card_count = 5 and ${alias}.distinct_card_count = 5 and ${alias}.unique_count >= 3 and (${alias}.common_count + ${alias}.rare_count + ${alias}.unique_count) = 5)
      when 'epic' then not (${alias}.card_count = 5 and ${alias}.distinct_card_count = 5 and ${alias}.epic_count >= 2 and (${alias}.common_count + ${alias}.rare_count + ${alias}.unique_count + ${alias}.epic_count) = 5)
      when 'legendary' then not (${alias}.card_count = 5 and ${alias}.distinct_card_count = 5 and ${alias}.legendary_count >= 1 and (${alias}.common_count + ${alias}.rare_count + ${alias}.unique_count + ${alias}.epic_count + ${alias}.legendary_count) = 5)
      else true
    end
  `;
}

await client.connect();

try {
  await client.query(`
    create or replace function app.enforce_competition_entry_rarity_requirement()
    returns trigger
    language plpgsql
    as $$
    declare
      v_tier text;
      v_json_count integer := 0;
      v_card_count integer := 0;
      v_distinct_card_count integer := 0;
      v_common_count integer := 0;
      v_rare_count integer := 0;
      v_unique_count integer := 0;
      v_epic_count integer := 0;
      v_legendary_count integer := 0;
      v_valid boolean := false;
      v_requirement text := '';
    begin
      select c.tier::text into v_tier
      from app.competitions c
      where c.id = new.competition_id;

      if v_tier is null then
        raise exception 'Tournament rarity validation failed: competition % was not found', new.competition_id;
      end if;

      if new.lineup_card_ids is null or jsonb_typeof(new.lineup_card_ids) <> 'array' then
        raise exception 'Tournament rarity validation failed: lineup must contain exactly five card IDs';
      end if;

      v_json_count := jsonb_array_length(new.lineup_card_ids);

      select
        count(*)::int,
        count(distinct pc.id)::int,
        count(*) filter (where pc.rarity::text = 'common')::int,
        count(*) filter (where pc.rarity::text = 'rare')::int,
        count(*) filter (where pc.rarity::text = 'unique')::int,
        count(*) filter (where pc.rarity::text = 'epic')::int,
        count(*) filter (where pc.rarity::text = 'legendary')::int
      into
        v_card_count,
        v_distinct_card_count,
        v_common_count,
        v_rare_count,
        v_unique_count,
        v_epic_count,
        v_legendary_count
      from jsonb_array_elements_text(new.lineup_card_ids) as entry(value)
      join app.player_cards pc
        on pc.id = case when entry.value ~ '^[0-9]+$' then entry.value::integer else null end;

      if v_json_count <> 5 or v_card_count <> 5 or v_distinct_card_count <> 5 then
        raise exception 'Tournament rarity validation failed: every entry requires five different valid cards';
      end if;

      case v_tier
        when 'common' then
          v_valid := v_common_count = 5;
          v_requirement := '5 Common cards';
        when 'rare' then
          v_valid := v_rare_count >= 4 and (v_common_count + v_rare_count) = 5;
          v_requirement := 'at least 4 Rare cards; the fifth may be Common or Rare';
        when 'unique' then
          v_valid := v_unique_count >= 3 and (v_common_count + v_rare_count + v_unique_count) = 5;
          v_requirement := 'at least 3 Unique cards; the other two may be Common, Rare or Unique';
        when 'epic' then
          v_valid := v_epic_count >= 2 and (v_common_count + v_rare_count + v_unique_count + v_epic_count) = 5;
          v_requirement := 'at least 2 Epic cards; the other three may be Common, Rare, Unique or Epic';
        when 'legendary' then
          v_valid := v_legendary_count >= 1 and (v_common_count + v_rare_count + v_unique_count + v_epic_count + v_legendary_count) = 5;
          v_requirement := 'at least 1 Legendary card; the other four may be any rarity';
        else
          raise exception 'Tournament rarity validation failed: unsupported tournament rarity %', v_tier;
      end case;

      if not v_valid then
        raise exception 'Invalid % tournament lineup: requires %', upper(v_tier), v_requirement;
      end if;

      return new;
    end;
    $$;

    drop trigger if exists competition_entries_rarity_guard on app.competition_entries;
    create trigger competition_entries_rarity_guard
      before insert or update of competition_id, lineup_card_ids
      on app.competition_entries
      for each row
      execute function app.enforce_competition_entry_rarity_requirement();
  `);

  const audit = await client.query(`
    with stats as (
      select
        ce.id as entry_id,
        ce.competition_id,
        c.tier::text as tier,
        c.status::text as status,
        jsonb_array_length(case when jsonb_typeof(ce.lineup_card_ids) = 'array' then ce.lineup_card_ids else '[]'::jsonb end)::int as json_count,
        count(pc.id)::int as card_count,
        count(distinct pc.id)::int as distinct_card_count,
        count(*) filter (where pc.rarity::text = 'common')::int as common_count,
        count(*) filter (where pc.rarity::text = 'rare')::int as rare_count,
        count(*) filter (where pc.rarity::text = 'unique')::int as unique_count,
        count(*) filter (where pc.rarity::text = 'epic')::int as epic_count,
        count(*) filter (where pc.rarity::text = 'legendary')::int as legendary_count
      from app.competition_entries ce
      join app.competitions c on c.id = ce.competition_id
      left join lateral jsonb_array_elements_text(
        case when jsonb_typeof(ce.lineup_card_ids) = 'array' then ce.lineup_card_ids else '[]'::jsonb end
      ) as entry(value) on true
      left join app.player_cards pc
        on pc.id = case when entry.value ~ '^[0-9]+$' then entry.value::integer else null end
      where c.status::text in ('open', 'upcoming', 'active')
      group by ce.id, ce.competition_id, c.tier::text, c.status::text, ce.lineup_card_ids
    )
    select entry_id, competition_id, tier, status
    from stats
    where json_count <> 5 or ${invalidRuleSql("stats")}
    order by competition_id, entry_id
    limit 50
  `);

  if (audit.rows.length > 0) {
    console.warn(
      `Tournament rarity guard installed. Found ${audit.rows.length} existing open/upcoming/active entries that predate the guard and need review:`,
      audit.rows,
    );
  } else {
    console.log("Tournament rarity guard installed: paid, FREE, public, private and user-created tournament entries all enforce their tier requirements.");
  }
} finally {
  await client.end();
}
