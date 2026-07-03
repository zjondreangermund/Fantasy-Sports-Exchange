import { sql } from "drizzle-orm";
import { db } from "../db.js";
import { fplApi } from "./fplApi.js";

function n(value: unknown) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num : 0;
}

function normalize(value: string) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function getMarketValue(playerId: number, cardId: number) {
  const result = await db.execute(sql`
    with same_player_cards as (
      select id from app.player_cards where player_id = ${playerId}
    ), sales as (
      select
        t.id,
        t.gross_amount,
        t.amount,
        t.created_at,
        pc.id as card_id
      from app.transactions t
      join same_player_cards pc on t.description ilike ('%' || 'card:' || pc.id::text || '%')
      where t.type = 'sale'
      order by t.created_at desc nulls last, t.id desc
      limit 20
    )
    select
      coalesce((select gross_amount from sales where card_id = ${cardId} order by created_at desc nulls last, id desc limit 1), 0)::float as "lastCardSale",
      coalesce((select gross_amount from sales order by created_at desc nulls last, id desc limit 1), 0)::float as "lastPlayerSale",
      coalesce((select avg(gross_amount) from sales where gross_amount > 0), 0)::float as "averageSale",
      coalesce((select count(*) from sales), 0)::int as "saleCount"
  `);
  const row = Array.isArray((result as any)?.rows) ? (result as any).rows[0] : null;
  const lastCardSale = n(row?.lastCardSale);
  const lastPlayerSale = n(row?.lastPlayerSale);
  const averageSale = n(row?.averageSale);
  return {
    lastCardSale,
    lastPlayerSale,
    averageSale,
    saleCount: n(row?.saleCount),
    value: lastCardSale || lastPlayerSale || averageSale || null,
    source: lastCardSale ? "same-card-last-sale" : lastPlayerSale ? "same-player-last-sale" : averageSale ? "same-player-average" : "no-market-sales",
  };
}

export async function buildRealCardProfile(cardId: number) {
  const cardResult = await db.execute(sql`
    select
      pc.*,
      p.name as player_name,
      p.team as player_team,
      p.position as player_position,
      p.image_url as image_url,
      p.fpl_id,
      p.code,
      p.photo,
      p.web_name,
      p.status,
      p.news
    from app.player_cards pc
    join app.players p on p.id = pc.player_id
    where pc.id = ${cardId}
    limit 1
  `);
  const card = Array.isArray((cardResult as any)?.rows) ? (cardResult as any).rows[0] : null;
  if (!card) return null;

  const bootstrap = await fplApi.bootstrap();
  const teams = Array.isArray(bootstrap?.teams) ? bootstrap.teams : [];
  const elements = Array.isArray(bootstrap?.elements) ? bootstrap.elements : [];
  const teamNameById = new Map<number, string>();
  const teamShortById = new Map<number, string>();
  for (const team of teams) {
    teamNameById.set(Number(team.id), normalize(String(team.name || team.short_name || "")));
    teamShortById.set(Number(team.id), String(team.short_name || team.name || `T${team.id}`));
  }

  const storedFplId = Number(card.fpl_id || 0);
  const playerName = normalize(String(card.player_name || ""));
  const teamName = normalize(String(card.player_team || ""));
  const matchedElement = elements.find((element: any) => {
    if (storedFplId > 0 && Number(element.id) === storedFplId) return true;
    const elementTeam = teamNameById.get(Number(element.team)) || "";
    const fullName = normalize(`${String(element.first_name || "")} ${String(element.second_name || "")}`.trim());
    const webName = normalize(String(element.web_name || ""));
    return elementTeam === teamName && (fullName === playerName || webName === playerName || fullName.includes(playerName) || playerName.includes(webName));
  });

  const market = await getMarketValue(Number(card.player_id), Number(card.id));

  if (!matchedElement) {
    return {
      source: "market-card-data",
      player: { name: card.player_name, team: card.player_team, position: card.player_position, imageUrl: card.image_url, status: card.status, news: card.news || "" },
      last10: [],
      stats: { matchesPlayed: 0, minutes: 0, goals: 0, assists: 0, cleanSheets: 0, yellowCards: 0, redCards: 0, bonus: 0, totalPoints: 0, selectedBy: null, value: market.value, valueCurrency: "N$", marketValue: market.value, marketValueSource: market.source, saleCount: market.saleCount },
    };
  }

  const summary = await fplApi.playerSummary(Number(matchedElement.id));
  const history = Array.isArray(summary?.history) ? summary.history : [];
  const last10 = history.slice(-10).map((row: any) => ({
    gameweek: Number(row.round || row.event || 0),
    opponent: teamShortById.get(Number(row.opponent_team)) || `T${row.opponent_team}`,
    points: Number(row.total_points || 0),
    minutes: Number(row.minutes || 0),
    goals: Number(row.goals_scored || 0),
    assists: Number(row.assists || 0),
    cleanSheets: Number(row.clean_sheets || 0),
    yellowCards: Number(row.yellow_cards || 0),
    redCards: Number(row.red_cards || 0),
    bonus: Number(row.bonus || 0),
    kickoffTime: row.kickoff_time || null,
    wasHome: Boolean(row.was_home),
  }));

  return {
    source: "fpl-live-market-linked",
    fplElementId: Number(matchedElement.id),
    player: {
      name: `${matchedElement.first_name || ""} ${matchedElement.second_name || ""}`.trim() || card.player_name,
      webName: matchedElement.web_name,
      team: card.player_team,
      position: card.player_position,
      imageUrl: fplApi.playerPhotoUrl(matchedElement, 250),
      status: matchedElement.status,
      news: matchedElement.news || "",
    },
    last10,
    stats: {
      matchesPlayed: Number(matchedElement.starts || 0),
      minutes: Number(matchedElement.minutes || 0),
      goals: Number(matchedElement.goals_scored || 0),
      assists: Number(matchedElement.assists || 0),
      cleanSheets: Number(matchedElement.clean_sheets || 0),
      yellowCards: Number(matchedElement.yellow_cards || 0),
      redCards: Number(matchedElement.red_cards || 0),
      bonus: Number(matchedElement.bonus || 0),
      totalPoints: Number(matchedElement.total_points || 0),
      selectedBy: matchedElement.selected_by_percent,
      value: market.value,
      valueCurrency: "N$",
      marketValue: market.value,
      marketValueSource: market.source,
      saleCount: market.saleCount,
      fplCost: Number(matchedElement.now_cost || 0) / 10,
    },
  };
}
