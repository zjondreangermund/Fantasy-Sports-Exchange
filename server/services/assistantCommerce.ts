import type {AssistantQuery} from './supportWalletSnapshot.js';
export type MarketFilter={term:string;rarity?:string;position?:string;maxPrice?:number;channel:'sale'|'loan';ownOnly?:boolean};
const literal=(term:string)=>'%'+term.replace(/[\\%_]/g,'\\$&')+'%';
export function marketFilter(question:string,previous?:any):MarketFilter {
  const q=question.toLowerCase().replace(/[’‘]/g,"'");
  const follow=/^(?:and |only |under |below |less than |cheaper |show more|what about (?:rare|common|epic|unique|legendary)|(?:rare|common|epic|unique|legendary)\b)/.test(q);
  const prior=follow&&previous&&typeof previous.term==='string'?previous:undefined;
  const quoted=question.match(/["“]([^"”]{1,80})["”]/)?.[1];
  const max=question.match(/(?:under|below|less than|max(?:imum)?(?: price)?(?: of)?|cheaper than)\s*N?\$?\s*(\d+(?:\.\d{1,2})?)/i);
  const words=q.replace(/(?:under|below|less than|max(?:imum)?(?: price)?(?: of)?|cheaper than)\s*n?\$?\s*\d+(?:\.\d{1,2})?/g,' ').replace(/[^\p{L}\p{N}'-]+/gu,' ').split(/\s+/);
  const stop=new Set('is are there any do does you have can could would will please find search check look for me show list tell if whether a an the on in at of to from with player players footballer cards card marketplace market available availability sale sell selling listed listings buy purchase own my our show currently latest now whats do i get has got anyone someone loan loans borrow borrowing open offers offer cheapest price prices cost how much currently now today only and what about than rare common epic unique legendary gk def mid fwd goalkeeper goalkeepers defender defenders midfielder midfielders forward forwards'.split(' '));
  const term=(quoted||words.filter(w=>w&&!stop.has(w)).join(' ')||prior?.term||'').slice(0,80);
  const rarity=q.match(/\b(common|rare|epic|unique|legendary)\b/)?.[1]||(['common','rare','epic','unique','legendary'].includes(prior?.rarity)?prior.rarity:undefined);
  const position=q.match(/\b(gk|def|mid|fwd)\b/i)?.[1]?.toUpperCase()||(/goalkeepers?/.test(q)?'GK':/defenders?/.test(q)?'DEF':/midfielders?/.test(q)?'MID':/forwards?/.test(q)?'FWD':['GK','DEF','MID','FWD'].includes(prior?.position)?prior.position:undefined);
  return {term,rarity,position,ownOnly:/\bmy (?:listings|listed|cards? for sale|sale listings)\b/.test(q)||prior?.ownOnly===true,maxPrice:max?Math.min(1e9,Number(max[1])):Number.isFinite(prior?.maxPrice)?Math.max(0,Math.min(1e9,prior.maxPrice)):undefined,channel:/loan|borrow/.test(q)?'loan':prior?.channel==='loan'?'loan':'sale'};
}
export async function searchAssistantMarket(q:AssistantQuery,filter:MarketFilter,offset:number,target:string){
  const tokens=filter.term.split(/\s+/).filter(Boolean).slice(0,8).map(literal);
  const params:any[]=[tokens,filter.rarity||null,filter.position||null,filter.maxPrice??null,offset,filter.ownOnly?target:null];
  const loan=filter.channel==='loan';
  if(loan&&!(await q("SELECT to_regclass('app.card_loans') AS present"))[0]?.present)return {answer:'Loan offers are unavailable on this installation.',sections:[],links:[]};
  // Fixed SQL and bound literal tokens; no question can supply SQL, a table or private owner data.
  const records=await q(`SELECT pc.id AS "cardId",p.name AS player,p.team,p.position,pc.rarity,${loan?'l.id AS "loanId",l.price_per_gameweek AS "pricePerGameweek",l.gameweeks':'pc.price'},count(*) OVER()::int AS "matchingListings"
    FROM app.player_cards pc JOIN app.players p ON p.id=pc.player_id ${loan?'JOIN app.card_loans l ON l.card_id=pc.id':''}
    WHERE ${loan?"l.status='open'":"pc.for_sale=true"} AND pc.owner_id IS NOT NULL AND ($6::text IS NULL OR pc.owner_id=$6)
    AND NOT EXISTS(SELECT 1 FROM unnest($1::text[]) term WHERE concat_ws(' ',p.name,p.team,p.position,pc.rarity) NOT ILIKE term ESCAPE '\\')
    AND ($2::text IS NULL OR pc.rarity::text=$2) AND ($3::text IS NULL OR p.position::text=$3)
    AND ($4::numeric IS NULL OR ${loan?'l.price_per_gameweek':'pc.price'} <= $4)
    ORDER BY ${loan?'l.price_per_gameweek':'pc.price'} ASC,pc.id ASC LIMIT 101 OFFSET $5`,params);
  const total=records[0]?.matchingListings??0;
  const summary=filter.term?` matching “${filter.term}”`:'';
  const href='/marketplace'+(filter.term?'?search='+encodeURIComponent(filter.term):'');
  return {answer:records.length?`${total} current ${loan?'loan offers':'sale listings'}${summary}. Showing the lowest listed prices first. These are listed offers, not a reservation or guarantee that a purchase/loan will succeed; the marketplace rechecks status, locks and price.`:`No current ${loan?'loan offers':'sale listings'}${summary} matched these filters${offset?' on this page':''}. This does not mean the footballer is absent from the site. Try a surname, club or broader filter.`,sections:[{title:loan?'Matching loan offers':'Matching marketplace listings',rows:records.slice(0,100).map(({matchingListings,...r})=>r),hasMore:records.length>100,note:'Current database listing snapshot, independent of the account report date range. Each card ID is a distinct offer.'}],links:[{label:'Open Marketplace'+(filter.term?' search':''),href}]};
}
export async function assistantTradeHistory(q:AssistantQuery,target:string,question:string,period:{from:string;to:string},offset:number){
  const sale=/\b(sales?|sold|selling|proceeds)\b/i.test(question),buy=/\b(buys?|bought|purchases?|spen[td])\b/i.test(question);
  const types=sale&&!buy?['marketplace_sale','sale','auction_sale']:buy&&!sale?['marketplace_buy','purchase']:['marketplace_buy','purchase','marketplace_sale','sale','auction_sale'];
  const values=[target,period.from,period.to,types,offset];
  const rows=await q(`SELECT t.id,t.type,t.status,t.amount,t.gross_amount AS "grossAmount",t.fee_amount AS "feeAmount",t.net_amount AS "netAmount",t.created_at AS "createdAt",pc.id AS "cardId",p.name AS player,p.team,pc.rarity
    FROM app.transactions t LEFT JOIN app.player_cards pc ON pc.id=substring(t.description from 'card:([0-9]{1,9})(?:[^0-9]|$)')::integer LEFT JOIN app.players p ON p.id=pc.player_id
    WHERE t.user_id=$1 AND t.created_at >= $2::timestamptz AND t.created_at < $3::timestamptz AND t.type::text=ANY($4::text[]) ORDER BY t.created_at DESC,t.id DESC LIMIT 101 OFFSET $5`,values);
  const totals=await q(`SELECT type,status,count(*)::int AS count,sum(amount)::float AS amount,sum(fee_amount)::float AS fees FROM app.transactions WHERE user_id=$1 AND created_at >= $2::timestamptz AND created_at < $3::timestamptz AND type::text=ANY($4::text[]) GROUP BY type,status ORDER BY type,status`,values.slice(0,4));
  return {answer:rows.length?`Your recorded ${sale&&!buy?'sales':buy&&!sale?'purchases':'purchases and sales'} are below. Totals cover the full selected period; status distinguishes completed trades from other ledger records. Card details appear where the transaction identifies a card.`:'No matching trade transactions were recorded for this account in the selected period. Try a wider date range; this is not an all-time absence claim.',sections:[{title:sale&&!buy?'Sales history':buy&&!sale?'Purchase history':'Trade history',rows:rows.slice(0,100),hasMore:rows.length>100},{title:'Trade totals',rows:totals}]};
}
