import {AssistantError,assistantTopics,assistantWindow,assistantUserSearch,scopedAssistantUser} from './assistantPolicy.js';
import {assistantKnowledge} from './assistantKnowledge.js';
import {supportWalletSnapshot,type AssistantQuery} from './supportWalletSnapshot.js';
export type AssistantSection={title:string;rows:any[];note?:string;hasMore?:boolean};
export type AssistantInput={actorId:string;admin:boolean;question:string;userId?:string;userSearch?:string;previousTopics?:unknown;period?:any;offset?:number};
const money=(v:any)=>`N$${Number(v||0).toFixed(2)}`;
const like=(v:string)=>'%'+v.replace(/[\\%_]/g,'\\$&')+'%';
export function createArenaAssistant(q:AssistantQuery){
  const exists=async(table:string)=>Boolean((await q('SELECT to_regclass($1) AS present',['app.'+table]))[0]?.present);
  return async function answer(input:AssistantInput){
    const question=String(input.question||'').trim();
    if(!question||question.length>2000)throw new AssistantError('Enter a question of up to 2,000 characters.');
    const topics=assistantTopics(question,input.previousTopics),period=assistantWindow(question,input.period);
    let target=scopedAssistantUser(input.actorId,input.admin,input.userId);
    if(topics.some(t=>['visitors','overview','support'].includes(t))&&!input.admin)throw new AssistantError('Visitor, platform and support-inbox reports are available to administrators only.',403);
    const search=assistantUserSearch(question,input.userSearch);
    if(search){
      if(!input.admin)throw new AssistantError('Only administrators can search other accounts.',403);
      const candidates=await q(`SELECT id,name,manager_team_name AS "teamName",email FROM app.users WHERE id=$1 OR lower(email)=lower($1) OR name ILIKE $2 ESCAPE '\\' OR manager_team_name ILIKE $2 ESCAPE '\\' ORDER BY id LIMIT 11`,[search,like(search)]);
      const selected=candidates.find(row=>row.id===input.userId);
      if(candidates.length!==1&&!selected)return {answer:candidates.length?'Choose the correct account before I inspect its records.':'No matching account was found. Try an email, account ID or manager name.',candidates,topics,period,sections:[],links:[]};
      target=String((selected||candidates[0]).id);
    }
    if(input.admin&&!input.userId&&!search&&/\b(user|customer|someone|their|his|her)\b/i.test(question)&&!topics.every(t=>['visitors','overview','help'].includes(t)))return {answer:'Choose the account using the manager/email search first, so I investigate the correct person.',candidates:[],topics,period,sections:[],links:[]};
    const offset=Math.min(10000,Math.max(0,Math.floor(Number(input.offset)||0)));
    const params=[target,period.from,period.to,offset],sections:AssistantSection[]=[],answers:string[]=[],notes:string[]=[];
    const knowledge=assistantKnowledge(question),links=[...knowledge.links];
    const add=(title:string,records:any[],note?:string,paged=false)=>{const hasMore=paged&&records.length>100;sections.push({title,rows:records.slice(0,100),note,hasMore});};
    const optional=async(table:string,title:string,query:string,values:any[])=>{if(await exists(table))add(title,await q(query,values));else notes.push(`${title} are not available on this installation.`);};
    const accountTopics=topics.some(t=>['wallet','activity','entries','cards','loans','notifications'].includes(t));
    let account:any;
    if(accountTopics){
      account=(await q('SELECT id,name,manager_team_name AS "teamName",created_at AS "joinedAt",is_banned AS "isBanned" FROM app.users WHERE id=$1',[target]))[0];
      if(!account)throw new AssistantError('Account not found.',404);
      if(account.isBanned)answers.push('This account is banned. That restriction can prevent account actions.');
    }
    await q(`INSERT INTO app.audit_logs(user_id,action,meta) VALUES($1,'assistant.read',$2::jsonb)`,[input.actorId,JSON.stringify({topics,targetUserId:accountTopics?target:null,period,offset})]);
    if(topics.includes('visitors')){
      const summary=(await q(`WITH first_seen AS (SELECT visitor_id,min(created_at) AS first_at FROM app.page_activity GROUP BY visitor_id)
        SELECT count(*) FILTER(WHERE a.event='page_view')::int AS "homepageViews",
          count(DISTINCT a.visitor_id) FILTER(WHERE a.event='page_view')::int AS "uniqueHomepageVisitors",
          count(DISTINCT a.visitor_id) FILTER(WHERE a.event='page_view' AND f.first_at >= $1::timestamptz)::int AS "firstSeenHomepageVisitors"
        FROM app.page_activity a JOIN first_seen f USING(visitor_id) WHERE a.path='/' AND a.created_at >= $1::timestamptz AND a.created_at < $2::timestamptz`,[period.from,period.to]))[0]||{};
      const registered=(await q('SELECT count(*)::int AS count FROM app.users WHERE created_at >= $1::timestamptz AND created_at < $2::timestamptz',[period.from,period.to]))[0]?.count||0;
      const since=(await q('SELECT min(created_at) AS since FROM app.page_activity'))[0]?.since;
      add('Homepage traffic',[{...summary,newAccountsRegistered:registered,recordingSince:since}]);
      add('Recently active accounts',await q(`SELECT a.user_id AS "userId",u.manager_team_name AS "teamName",u.name,max(a.created_at) AS "lastSeen" FROM app.page_activity a JOIN app.users u ON u.id=a.user_id WHERE a.created_at > now()-interval '2 minutes' GROUP BY a.user_id,u.manager_team_name,u.name ORDER BY "lastSeen" DESC LIMIT 100`),'Current activity, independent of the report period. A recent heartbeat does not prove human attention.');
      add('Older marketing funnel records',await q(`SELECT meta->>'event' AS event,count(*)::int AS events,count(DISTINCT meta->>'visitorId')::int AS "browserVisitors" FROM app.audit_logs WHERE action='marketing.funnel' AND created_at >= $1::timestamptz AND created_at < $2::timestamptz GROUP BY meta->>'event'`,[period.from,period.to]),'Legacy funnel counts are separate and are not added to page tracking totals.');
      answers.push(`Homepage: ${summary.homepageViews||0} page views, ${summary.uniqueHomepageVisitors||0} distinct browser visitors, ${summary.firstSeenHomepageVisitors||0} first seen in the retained tracking history. ${registered} accounts registered in this period. Browser visitors and registrations are different metrics. Page history begins ${since||'when the first tracking event arrives'} and is retained for 90 days; cookies and multiple devices affect visitor counts.`);
      links.push({label:'Admin reports',href:'/admin'});
    }
    if(topics.includes('overview')){
      add('Current platform totals',await q(`SELECT (SELECT count(*)::int FROM app.users) AS users,(SELECT count(*)::int FROM app.player_cards WHERE owner_id IS NOT NULL) AS "ownedCards",(SELECT count(*)::int FROM app.competition_entries) AS entries,(SELECT coalesce(sum(balance),0)::float FROM app.wallets) AS "availableWalletFunds",(SELECT coalesce(sum(locked_balance),0)::float FROM app.wallets) AS "lockedWalletFunds"`),'Current all-time counts. Wallet balances are customer funds, not platform profit.');
      add('Transaction totals in selected period',await q(`SELECT type,status,count(*)::int AS count,sum(amount)::float AS amount,sum(fee_amount)::float AS "recordedFees" FROM app.transactions WHERE created_at >= $1::timestamptz AND created_at < $2::timestamptz GROUP BY type,status ORDER BY type,status`,[period.from,period.to]));
      answers.push('Current platform totals and period-specific transaction totals are below. Gross deposits and wallet funds must not be treated as revenue or profit.');links.push({label:'Admin',href:'/admin'});
    }
    if(topics.includes('wallet')){
      const wallet=(await q('SELECT balance,locked_balance AS "lockedBalance" FROM app.wallets WHERE user_id=$1',[target]))[0];
      add('Current wallet',wallet?[wallet]:[],'Current values, independent of the selected transaction period.');
      add('Transactions',await q(`SELECT id,type,amount,gross_amount AS "grossAmount",fee_amount AS "feeAmount",net_amount AS "netAmount",status,source_type AS "sourceType",external_transaction_id AS "paymentReference",description,created_at AS "createdAt" FROM app.transactions WHERE user_id=$1 AND created_at >= $2::timestamptz AND created_at < $3::timestamptz ORDER BY created_at DESC,id DESC LIMIT 101 OFFSET $4`,params),'Selected period; rows are paged, while totals below use the whole period.',true);
      add('Transaction totals',await q(`SELECT type,status,count(*)::int AS count,sum(amount)::float AS amount,sum(fee_amount)::float AS "fees" FROM app.transactions WHERE user_id=$1 AND created_at >= $2::timestamptz AND created_at < $3::timestamptz GROUP BY type,status`,params.slice(0,3)));
      const txId=Number(question.match(/transaction\s*#?\s*(\d+)/i)?.[1]||0);
      if(Number.isSafeInteger(txId)&&txId>0)add('Requested transaction',await q(`SELECT id,type,amount,status,fee_amount AS "feeAmount",net_amount AS "netAmount",description,external_transaction_id AS "paymentReference",created_at AS "createdAt" FROM app.transactions WHERE user_id=$1 AND id=$2`,[target,txId]),'Exact transaction lookup, independent of date range; limited to this account.');
      await optional('deposit_verifications','Latest deposit reviews',`SELECT id,transaction_id AS "transactionId",gross_amount AS "grossAmount",fee_amount AS "feeAmount",net_amount AS "netAmount",status,created_at AS "createdAt",reviewed_at AS "reviewedAt" FROM app.deposit_verifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100`,[target]);
      add('Latest withdrawal requests',await q(`SELECT id,amount,fee,net_amount AS "netAmount",status,payment_method AS "paymentMethod",release_after AS "releaseAfter",reviewed_at AS "reviewedAt",created_at AS "createdAt" FROM app.withdrawal_requests WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100`,[target]),'Latest requests across all dates. Bank account numbers and verification credentials are omitted.');
      const reconciliation=await supportWalletSnapshot(q,target);add('Wallet reconciliation',[reconciliation],'Checks all recorded ledger history and outstanding holds in one database snapshot.');
      if(reconciliation.available)await optional('auction_escrow_holds','Active auction reservations',`SELECT id,auction_id AS "auctionId",amount,hold_transaction_id AS "transactionId",status,created_at AS "createdAt" FROM app.auction_escrow_holds WHERE bidder_user_id=$1 AND status='held' ORDER BY created_at DESC LIMIT 100`,[target]);
      answers.push(wallet?`Available ${money(wallet.balance)}; locked ${money(wallet.lockedBalance)}. ${reconciliation.available?`Reconciliation: ${reconciliation.status}; wallet/ledger difference ${money(reconciliation.totalDelta)}, locked attribution difference ${money(reconciliation.lockedDelta)}.`:'Full reconciliation is unavailable.'}`:'There is no wallet record for this account.');
      const deposits=sections.find(s=>s.title==='Latest deposit reviews')?.rows||[];
      const pending=deposits.filter(row=>row.status==='pending');
      if(pending.length)answers.push(`${pending.length} of the latest deposit requests are pending verification. These requests have not yet made their net amount spendable.`);
      const unresolved=sections.find(s=>s.title==='Latest withdrawal requests')?.rows.filter(row=>['pending','approved','failed'].includes(row.status))||[];
      if(unresolved.length)answers.push(`${unresolved.length} of the latest withdrawals are unresolved. Their amounts can remain reserved; inspect the status, review and release dates below.`);
      if(reconciliation.available&&reconciliation.status==='review')answers.push('The reconciliation flags need review. They do not prove money was lost, and no balances have been changed.');
      answers.push(...knowledge.answers.filter(text=>/Deposits|withdraw|Marketplace|Pending deposits/.test(text)));links.push({label:'Wallet',href:'/wallet'});
    }
    if(topics.includes('activity')){
      const lastSeen=(await q(`SELECT max(created_at) AS "lastSeen",coalesce(max(created_at)>now()-interval '2 minutes',false) AS "recentlyActive" FROM app.page_activity WHERE user_id=$1`,[target]))[0]||{};
      add('Current activity',[lastSeen]);
      add('Recorded page visits',await q(`SELECT path,session_id AS "sessionId",created_at AS "visitedAt" FROM app.page_activity WHERE user_id=$1 AND event='page_view' AND created_at >= $2::timestamptz AND created_at < $3::timestamptz ORDER BY created_at DESC,id DESC LIMIT 101 OFFSET $4`,params),'Selected period. Visits before this tracker was enabled cannot be reconstructed.',true);
      add('Recorded account actions',await q(`SELECT action,left(coalesce(meta->>'reason',meta->>'message',''),300) AS "recordedReason",meta->>'competitionId' AS "competitionId",created_at AS "createdAt" FROM app.audit_logs WHERE user_id=$1 AND action<>'assistant.read' AND created_at >= $2::timestamptz AND created_at < $3::timestamptz ORDER BY created_at DESC,id DESC LIMIT 101 OFFSET $4`,params),'Only recorded actions are evidence; an open page does not prove a task was completed.',true);
      answers.push(`Last observed: ${lastSeen.lastSeen||'not recorded'}. ${lastSeen.recentlyActive?'A visible-page event was received in the last two minutes; this suggests recent activity, not guaranteed attention.':'No visible-page event was received in the last two minutes.'} Recorded pages and action names are below.`);links.push({label:'Admin activity',href:'/admin'});
    }
    if(topics.includes('entries')){
      add('Tournament entries',await q(`SELECT e.id,c.id AS "competitionId",c.name,c.game_week AS "gameweek",c.tier,c.status,e.entry_fee_paid AS "entryFeePaid",e.total_score AS "totalScore",e.rank,e.prize_amount AS "prizeAmount",e.captain_id AS "captainId",e.joined_at AS "joinedAt" FROM app.competition_entries e JOIN app.competitions c ON c.id=e.competition_id WHERE e.user_id=$1 ORDER BY e.joined_at DESC,e.id DESC LIMIT 101 OFFSET $2`,[target,offset]),'Latest entries across all dates. Prize/rank fields alone do not establish payment or complete settlement.',true);
      if(await exists('player_gameweek_scores')){
        const scoring=await q(`SELECT e.id AS "entryId",c.game_week AS "gameweek",p.name AS player,pc.id AS "cardId",s.score,s.source,s.is_final AS "isFinal",(s.player_id IS NULL) AS "scoreMissing",s.updated_at AS "updatedAt" FROM app.competition_entries e JOIN app.competitions c ON c.id=e.competition_id CROSS JOIN LATERAL jsonb_array_elements_text(e.lineup_card_ids) chosen(card_id) JOIN app.player_cards pc ON pc.id=chosen.card_id::integer JOIN app.players p ON p.id=pc.player_id LEFT JOIN app.player_gameweek_scores s ON s.player_id=p.id AND s.game_week=c.game_week WHERE e.user_id=$1 ORDER BY e.joined_at DESC,e.id DESC,pc.id LIMIT 100`,[target]);
        add('Latest entry scoring records',scoring,'Up to 100 selected-card score records. Missing rows are unknown, not zero. Final flags and sources alone do not establish that every fixture or settlement check is complete.');
        const missing=scoring.filter(row=>row.scoreMissing).length;
        if(missing)answers.push(`${missing} of the listed selected-card records have no synchronized gameweek score. Missing scores must be investigated before interpreting points or settlement.`);
      }
      answers.push('Tournament entries, scores, ranks, captains and recorded prize amounts are below. For entry problems, check the captain, five different eligible players, card sale/lock status and available wallet funds. Teams cannot be edited after the first kickoff of that gameweek.');links.push({label:'My Entries',href:'/my-entries'},{label:'Trophy Cabinet',href:'/trophy-cabinet'});
    }
    if(topics.includes('cards')){
      add('Owned cards',await q(`SELECT pc.id,p.id AS "playerId",p.name,p.team,p.position,p.status,p.news,pc.rarity,pc.for_sale AS "forSale",pc.price FROM app.player_cards pc JOIN app.players p ON p.id=pc.player_id WHERE pc.owner_id=$1 ORDER BY pc.id DESC LIMIT 101 OFFSET $2`,[target,offset]),'Each card ID is a separate collectible; the same footballer may have multiple cards.',true);
      await optional('card_locks','Active card locks',`SELECT card_id AS "cardId",reason,ref_id AS "reference",expires_at AS "expiresAt" FROM app.card_locks WHERE user_id=$1 AND (expires_at IS NULL OR expires_at>now()) ORDER BY card_id LIMIT 100`,[target]);
      answers.push('Owned card, player availability and active lock records are below. A card listed for sale or locked in another unresolved activity may be unavailable for entry.');links.push({label:'Collection',href:'/collection'},{label:'Marketplace',href:'/marketplace'});
    }
    if(topics.includes('loans')){
      await optional('card_loans','Loan contracts',`SELECT id,card_id AS "cardId",CASE WHEN original_owner_id=$1 THEN 'owner' ELSE 'borrower' END AS role,status,price_per_gameweek AS "pricePerGameweek",gameweeks,gross_amount AS "grossAmount",fee_amount AS "feeAmount",starts_at AS "startsAt",expires_at AS "expiresAt",returned_at AS "returnedAt" FROM app.card_loans WHERE original_owner_id=$1 OR borrower_user_id=$1 ORDER BY created_at DESC LIMIT 100`,[target]);
      answers.push('Latest loan contract statuses, recorded charges and expiry dates are below. The assistant does not create or cancel loans.');links.push({label:'Marketplace loans',href:'/marketplace'});
    }
    if(topics.includes('notifications')){
      add('Notifications',await q(`SELECT id,title,message,read,created_at AS "createdAt" FROM app.notifications WHERE user_id=$1 ORDER BY created_at DESC,id DESC LIMIT 101 OFFSET $2`,[target,offset]),'Latest inbox records across all dates. An inbox record alone does not prove push delivery.',true);
      for(const [table,title] of [['notification_push_deliveries','Web push job status'],['notification_native_push_deliveries','Android push job status']]){
        // Fixed allowlist; no table name or SQL can come from the question.
        if(await exists(table))add(title,await q(`SELECT d.status,count(*)::int AS count,max(d.sent_at) AS "lastSentAt" FROM app.${table} d JOIN app.notifications n ON n.id=d.notification_id WHERE n.user_id=$1 GROUP BY d.status`,[target]),'Queue/provider status across all dates. Sent means provider acceptance, not proof that a person saw or opened it.');
      }
      answers.push('These are the account’s inbox records. They do not establish that a push was delivered or opened.');links.push({label:'Inbox',href:'/account?tab=inbox'});
    }
    if(topics.includes('support')){
      await optional('support_requests','Support inbox',`SELECT id,category,subject,status,created_at AS "createdAt" FROM app.support_requests ORDER BY created_at DESC LIMIT 100`,[]);
      answers.push('Latest support request subjects and statuses are below. No request status was changed.');links.push({label:'Admin support inbox',href:'/admin'});
    }
    if(topics.includes('help')){
      answers.push(...knowledge.answers);
      if(!knowledge.answers.length)answers.push('I could not verify an answer from the connected site help. I can investigate wallets, transactions, account activity, tournament entries, owned cards, loans, notifications, and admin visitor/platform reports. Name the feature or select the relevant account; missing data is not treated as zero or as proof of failure.');
      add('Help sources',knowledge.sources.map(source=>({source})));
    }
    const hasMore=sections.some(s=>s.hasMore);
    return {answer:[...new Set(answers)].join('\n\n'),sections,notes,links:[...new Map(links.filter(link=>input.admin||link.href!=='/admin').map(link=>[link.href,link])).values()],account,topics,period,asOf:new Date().toISOString(),nextOffset:hasMore&&offset<10000?offset+100:null,offset,scope:account?`Account ${account.teamName||account.name||account.id}`:'Platform report',limits:'Up to 100 rows per section. Current balances and latest-record sections are labelled separately from period-specific records. Totals and wallet reconciliation use their full stated scope.'};
  };
}
