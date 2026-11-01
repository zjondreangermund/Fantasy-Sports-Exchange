import {arenaHelpIndex} from '../../shared/arena-help-index.js';
import {CAPTAIN_BONUS_PERCENT,TOURNAMENT_CARD_COUNT,TOURNAMENT_LINEUP_SLOTS,TOURNAMENT_RARITY_REQUIREMENTS} from '../../shared/game-rules.js';
import {DEPOSIT_FEE_POLICY_TEXT,WITHDRAWAL_FEE_POLICY_TEXT,WITHDRAWAL_PAYOUT_SLA_TEXT,MARKETPLACE_FEE_RATE,MARKETPLACE_FLOOR_BY_RARITY,TOURNAMENT_ENTRY_BY_RARITY} from '../../shared/card-economy.js';
export function assistantKnowledge(question:string){
  const q=question.toLowerCase();
  const answers:string[]=[];const links:Array<{label:string;href:string}>=[];
  if(/team|lineup|captain|entry|tournament|kickoff|edit/.test(q)){
    answers.push(`A team needs ${TOURNAMENT_CARD_COUNT} distinct players in ${TOURNAMENT_LINEUP_SLOTS.join(', ')} slots. Utility must be DEF, MID or FWD. Choose a captain; the captain bonus is ${CAPTAIN_BONUS_PERCENT}%. Submitted teams and captains can be edited in My Entries before the first Premier League kickoff of that gameweek. After the first kickoff, later fixtures do not reopen editing. The server checks the deadline again when saving.`);
    if(/rarity|rare|common|unique|epic|legendary|entry|tournament/.test(q))answers.push(...Object.values(TOURNAMENT_RARITY_REQUIREMENTS).map(rule=>rule.description));
    links.push({label:'My Entries',href:'/my-entries'},{label:'Choose a tournament',href:'/competitions'});
  }
  if(/fee|wallet|deposit|withdraw|balance|payment|money|funds/.test(q)){
    answers.push(DEPOSIT_FEE_POLICY_TEXT,WITHDRAWAL_FEE_POLICY_TEXT,WITHDRAWAL_PAYOUT_SLA_TEXT,`Marketplace sales charge ${MARKETPLACE_FEE_RATE*100}%. Pending deposits are not spendable until verified. Withdrawal and auction reservations can move funds into locked balance. A discrepancy requires review; this assistant does not change balances or approve payments.`);
    links.push({label:'Wallet',href:'/wallet'});
  }
  if(/point|score|scoring|rating/.test(q)){
    answers.push('Fantasy Arena tournament points use synchronized Premier League player actions. Card rarity does not multiply football points, and provider match rating is excluded from tournament scoring. A missing scoring record is not proof that a player earned zero points. Settlement should wait until required scoring records are ready.');

    links.push({label:'Scoring rules',href:'/scoring-rules'});
  }
  if(/injur|availability|suspend|premier/.test(q)){answers.push('Open Premier League → Availability. Clubs expand with a dropdown arrow; each player is shown once per club for the relevant fixture. Confirmed starters/substitutes override older injury flags; earlier reports are labelled separately. Injury alerts open My Entries. Teams remain locked after the gameweek’s first kickoff.');links.push({label:'Premier League availability',href:'/premier-league'});}
  if(/floor|minimum.*(?:listing|card)|entry fee|entry price/.test(q)){
    answers.push(`Current configured marketplace floors: ${Object.entries(MARKETPLACE_FLOOR_BY_RARITY).map(([rarity,amount])=>`${rarity}: N$${amount}`).join(', ')}. Tournament entry fees configured by rarity: ${Object.entries(TOURNAMENT_ENTRY_BY_RARITY).map(([rarity,amount])=>`${rarity}: N$${amount}`).join(', ')}. Always check the displayed tournament/listing price before confirming.`);
  }
  if(/community|chat|message.*expir/.test(q))answers.push('Community Live messages expire 24 hours after being sent. Editing or replying does not extend the expiry. Expired messages are hidden immediately from server reads and periodically removed from stored and cached history.');
  if(/prize|reward|settle|claim/.test(q)){answers.push('A recorded prize amount or tournament rank alone does not prove that a cash payment or prize claim was completed. Use the tournament state, transaction history and Trophy Cabinet together.');links.push({label:'Trophy Cabinet',href:'/trophy-cabinet'},{label:'Prize Vault',href:'/prize-vault'});}
  // Only explicitly authored help may be quoted. Toasts and conditionally rendered UI
  // strings are not observations about the signed-in account or current gameweek.
  const words=q.match(/[a-z0-9]{3,}/g)?.filter(w=>!['the','how','what','does','can','you','why','are','and','with','that','this','please','check','latest'].includes(w))||[];
  const matches=arenaHelpIndex.filter(item=>item.kind==='authored-help').map(item=>({...item,score:words.filter(word=>item.answer.toLowerCase().includes(word)).length})).filter(item=>item.score>=2).sort((a,b)=>b.score-a.score).slice(0,3);
  if(!answers.length)answers.push(...matches.map(item=>`Site guide: ${item.answer}`));
  return {answers,links,sources:matches.map(item=>item.source)};
}
