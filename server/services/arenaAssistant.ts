import {marketFilter,searchAssistantMarket,assistantTradeHistory} from './assistantCommerce.js';
import {featureHelp} from '../../shared/assistant-features.js';
import {parseAssistantTask,assistantTaskDefinitions} from '../../shared/assistant-tasks.js';
import {assistantGameweekLog} from './assistantGameweekLog.js';
import {investigationContext,investigateEntry,investigateSettlement,footballInvestigation,type AssistantConnections} from './assistantInvestigations.js';
import {AssistantError,assistantRequestRefusal,assistantTopics,assistantWindow,assistantUserSearch,scopedAssistantUser} from './assistantPolicy.js';
import {assistantKnowledge} from './assistantKnowledge.js';
import {supportWalletSnapshot,type AssistantQuery} from './supportWalletSnapshot.js';
export type AssistantSection={title:string;rows:any[];note?:string;hasMore?:boolean};
export type AssistantInput={actorId:string;admin:boolean;question:string;userId?:string;userSearch?:string;previousTopics?:unknown;period?:any;offset?:number;context?:unknown};
const money=(v:any)=>`N$${Number(v||0).toFixed(2)}`;
const like=(v:string)=>'%'+v.replace(/[\\%_]/g,'\\$&')+'%';
export function createArenaAssistant(q:AssistantQuery,connections:AssistantConnections={}){
  const exists=async(table:string)=>Boolean((await q('SELECT to_regclass($1) AS present',['app.'+table]))[0]?.present);
  return async function answer(input:AssistantInput){
    const question=String(input.question||'').trim();
    if(!question||question.length>2000)throw new AssistantError('Enter a question of up to 2,000 characters.');
    scopedAssistantUser(input.actorId,input.admin,input.userId);
    if(!input.admin&&/admin (?:reports?|logs?|analytics|dashboard|inbox)|all (?:users|wallets|accounts)|(?:other|another) (?:user|account)|platform (?:revenue|profit|totals)|support inbox/i.test(question))throw new AssistantError('Private administrator information is not available in Member Help.',403);
    const task=parseAssistantTask(question,(input.context as any)?.taskDraft);
    if(task){
      if(assistantTaskDefinitions[task.kind].admin&&!input.admin)throw new AssistantError('This task requires administrator access.',403);
      if(input.userId&&input.userId!==input.actorId)return {answer:'Site tasks run only for your signed-in account. Switch to My account before preparing this task. Administrators cannot submit teams or change profiles on someone else’s behalf.',sections:[],topics:[],asOf:new Date().toISOString()};
      return {answer:`I can prepare “${assistantTaskDefinitions[task.kind].label}”. Choose the required details below, then review the preview before confirming. Nothing has been submitted or changed yet.`,taskDraft:task,context:{taskDraft:task},sections:[],topics:[],asOf:new Date().toISOString()};
    }
    if(/^(?:hi|hello|hey|thanks|thank you)[!. ]*$/i.test(question))return {answer:/thank/i.test(question)?'You’re welcome.':'Hello. I can check recorded site information or help prepare a supported task. What would you like to do?',sections:[],topics:[],asOf:new Date().toISOString()};
    const refusal=assistantRequestRefusal(question);
    if(refusal)return {...refusal,sections:[],topics:[],notes:[],followUps:[],asOf:new Date().toISOString(),scope:'Capability limit'};
    const topics=assistantTopics(question,input.previousTopics),period=assistantWindow(question,input.period);
    const context:any=investigationContext(question,input.context),followUps:string[]=[];
    let target=scopedAssistantUser(input.actorId,input.admin,input.userId);
    if(topics.some(t=>['visitors','overview','support','gameweek'].includes(t))&&!input.admin)throw new AssistantError('Visitor, platform, operational logs and support-inbox reports are available to administrators only.',403);
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
    const accountTopics=topics.some(t=>['wallet','activity','entries','cards','loans','notifications','settlement','trades','profile','rewards','auctions'].includes(t));
    let account:any;
    if(accountTopics){
      account=(await q('SELECT id,name,manager_team_name AS "teamName",created_at AS "joinedAt",is_banned AS "isBanned" FROM app.users WHERE id=$1',[target]))[0];
      if(!account)throw new AssistantError('Account not found.',404);
      if(account.isBanned)answers.push('This account is banned. That restriction can prevent account actions.');
    }
    await q(`INSERT INTO app.audit_logs(user_id,action,meta) VALUES($1,'assistant.read',$2::jsonb)`,[input.actorId,JSON.stringify({topics,targetUserId:accountTopics?target:null,period,offset})]);
    if(topics.includes('gameweek')){
      const report=await assistantGameweekLog(q,input.admin,question);answers.push(report.answer);sections.push(...report.sections);followUps.push(...report.followUps);links.push({label:'Admin Sync Centre',href:'/admin'});
    }
    if(topics.includes('market')){
      const filter=marketFilter(question,(input.context as any)?.marketplace);context.marketplace=filter;
      const report=await searchAssistantMarket(q,filter,offset,target);answers.push(report.answer);sections.push(...report.sections);links.push(...report.links);followUps.push('Only Rare cards','Under N$100');
    }
    if(topics.includes('trades')){
      const report=await assistantTradeHistory(q,target,question,period,offset);answers.push(report.answer);sections.push(...report.sections);links.push({label:'Wallet transactions',href:'/wallet'});
    }
    if(topics.includes('tournaments')){
      const rows=await q(`SELECT c.id,c.name,c.tier,c.status,c.game_week AS "gameweek",c.entry_fee AS "entryFee",c.start_date AS "startDate" FROM app.competitions c WHERE coalesce(c.visibility,'public')='public' AND c.name NOT LIKE '[TEST]%' AND c.status::text IN ('open','active') ORDER BY c.game_week,c.id LIMIT 101 OFFSET $1`,[offset]);
      add('Current public tournaments',rows,'Recorded open/active status is not proof that entry is still allowed. The first-kickoff guard is rechecked at submission.',true);
      answers.push(rows.length?'These public tournaments are recorded as open or active. Open Play to check the current deadline, select five eligible cards and a captain, then review the entry fee.':'No public tournaments are currently recorded as open or active. Check Play again for the next gameweek.');links.push({label:'Open Play',href:'/competitions'});
    }
    if(topics.includes('profile')){add('Account profile',account?[{name:account.name,teamName:account.teamName,joinedAt:account.joinedAt}]:[]);answers.push('Your recorded profile is below. Ask to rename your manager team to prepare a reviewed change.');links.push({label:'Account',href:'/account'});}
    if(topics.includes('auctions')){
      if(await exists('auctions')){
        const rows=await q(`SELECT a.id,p.name AS player,p.team,pc.rarity,a.start_price AS "startPrice",a.buy_now_price AS "buyNowPrice",a.ends_at AS "endsAt",(SELECT max(b.amount) FROM app.auction_bids b WHERE b.auction_id=a.id) AS "highestBid" FROM app.auctions a JOIN app.player_cards pc ON pc.id=a.card_id JOIN app.players p ON p.id=pc.player_id WHERE a.status='live' AND a.starts_at<=now() AND a.ends_at>now() ORDER BY a.ends_at,a.id LIMIT 101 OFFSET $1`,[offset]);add('Live card auctions',rows,'Current public auction snapshot; not a bid reservation.',true);
        add('Your auction bids',await q(`SELECT b.id,b.auction_id AS "auctionId",b.amount,b.created_at AS "createdAt",a.status FROM app.auction_bids b JOIN app.auctions a ON a.id=b.auction_id WHERE b.bidder_user_id=$1 ORDER BY b.created_at DESC,b.id DESC LIMIT 101 OFFSET $2`,[target,offset]),'Your latest bids across all dates.',true);
        answers.push(rows.length?'Current live auctions and your recorded bids are below. Check the auction page for its latest price and deadline before confirming a bid.':'No card auctions currently meet the live status and deadline checks. Your recorded bids, if any, are below.');
      }else answers.push('Auction records are unavailable on this installation.');
      links.push({label:'Auctions',href:'/auctions'});
    }
    if(topics.includes('rewards')){
      add('Recorded tournament prizes',await q(`SELECT e.id AS "entryId",c.name,c.game_week AS "gameweek",c.status,e.rank,e.prize_amount AS "recordedPrizeAmount",e.prize_card_id AS "prizeCardId" FROM app.competition_entries e JOIN app.competitions c ON c.id=e.competition_id WHERE e.user_id=$1 AND (coalesce(e.prize_amount,0)>0 OR e.prize_card_id IS NOT NULL) ORDER BY e.joined_at DESC,e.id DESC LIMIT 101 OFFSET $2`,[target,offset]),'Recorded prize amounts/card IDs are evidence of allocation, not proof of cash payout or delivery.',true);
      await optional('competition_prize_awards','Prize Vault awards',`SELECT entry_id AS "entryId",prize_title AS title,prize_value AS value,status,created_at AS "createdAt" FROM app.competition_prize_awards WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100`,[target]);
      answers.push('Recorded prizes and award statuses are below. Open Trophy Cabinet to check claim options and delivery status; a rank alone does not establish a paid prize.');links.push({label:'Trophy Cabinet',href:'/trophy-cabinet'});
    }
    if(topics.includes('football')){
      try{const owned=/\bmy (?:team|squad|players|cards)\b/i.test(question)?await q('SELECT DISTINCT p.name FROM app.player_cards pc JOIN app.players p ON p.id=pc.player_id WHERE pc.owner_id=$1',[target]):undefined;const report=await footballInvestigation(connections,context,question,owned?.map(r=>r.name));answers.push(report.answer);sections.push(...report.sections);followUps.push(...report.followUps);}
      catch{answers.push('Current football availability could not be verified. Try again shortly; older reports are not proof of current absence.');}
      links.push({label:'Premier League availability',href:'/premier-league'});
    }
    if(topics.includes('settlement')){
      const report=await investigateSettlement(q,target,input.admin,context,connections);answers.push(report.answer);sections.push(...report.sections);followUps.push(...report.followUps);
      links.push({label:'Tournament records',href:input.admin?'/admin':'/my-entries'});
    }
    if(topics.includes('entries')&&(/why|cannot|can't|cant|unable|failed|trouble|investigat|diagnos|blocked/.test(question.toLowerCase())||context.entryId)){
      const report=await investigateEntry(q,target,context,connections);answers.push(report.answer);sections.push(...report.sections);followUps.push(...report.followUps);
    }
    if(topics.includes('visitors')){
      // VISIT_METRICS_NOT_PAGE_CLICKS_V1: visits are distinct browser
      // sessions, not a count of pages or background requests. Ignore any
      // browser associated with a configured administrator.
      const adminVisitorIds=String(process.env.ADMIN_USER_IDS||'').split(',').map(v=>v.trim()).filter(Boolean);
      const adminVisitorEmails=String(process.env.ADMIN_EMAILS||'lbcplaya@gmail.com').split(',').map(v=>v.trim().toLowerCase()).filter(Boolean);
      const visitorParams=[period.from,period.to,adminVisitorIds,adminVisitorEmails];
      const excludeAdminBrowsers=`and not exists(
        select 1 from app.page_activity ap join app.users au on au.id=ap.user_id
        where ap.visitor_id=p.visitor_id
          and (ap.user_id=any($3::text[]) or lower(coalesce(au.email,''))=any($4::text[]))
      )`;
      const siteTraffic=(await q(`SELECT count(*)::int AS "sitePageViews",count(distinct p.session_id)::int AS "siteVisitSessions",count(distinct p.visitor_id)::int AS "siteBrowserVisitors" FROM app.page_activity p WHERE p.event='page_view' AND p.created_at >= $1::timestamptz AND p.created_at < $2::timestamptz ${excludeAdminBrowsers}`,visitorParams))[0]||{};
      add('Site-wide traffic',[siteTraffic],'Distinct browser sessions are visits; page views are route openings, not unique people. Configured admin browsers and heartbeat events are excluded. Cookies approximate browsers, not verified humans.');
      add('Most viewed pages',await q(`SELECT p.path,count(*)::int AS "pageViews",count(distinct p.session_id)::int AS sessions,count(distinct p.visitor_id)::int AS "browserVisitors" FROM app.page_activity p WHERE p.event='page_view' AND p.created_at >= $1::timestamptz AND p.created_at < $2::timestamptz ${excludeAdminBrowsers} GROUP BY p.path ORDER BY count(*) DESC,p.path LIMIT 100`,visitorParams));
      answers.push(`Site-wide, excluding admin browsers: ${siteTraffic.siteVisitSessions||0} recorded visits (browser sessions), ${siteTraffic.siteBrowserVisitors||0} distinct browsers and ${siteTraffic.sitePageViews||0} page views. These are observations, not proof of distinct people.`);

      const summary=(await q(`WITH first_seen AS (SELECT p.visitor_id,min(p.created_at) AS first_at FROM app.page_activity p WHERE p.event='page_view' ${excludeAdminBrowsers} GROUP BY p.visitor_id)
        SELECT count(*)::int AS "homepageViews",count(distinct p.session_id)::int AS "homepageSessions",
          count(distinct p.visitor_id)::int AS "uniqueHomepageVisitors",
          count(distinct p.visitor_id) FILTER(WHERE f.first_at >= $1::timestamptz)::int AS "firstSeenHomepageVisitors"
        FROM app.page_activity p JOIN first_seen f USING(visitor_id) WHERE p.path='/' AND p.event='page_view' AND p.created_at >= $1::timestamptz AND p.created_at < $2::timestamptz ${excludeAdminBrowsers}`,visitorParams))[0]||{};
      const registered=(await q('SELECT count(*)::int AS count FROM app.users WHERE created_at >= $1::timestamptz AND created_at < $2::timestamptz',[period.from,period.to]))[0]?.count||0;
      const since=(await q('SELECT min(created_at) AS since FROM app.page_activity'))[0]?.since;
      add('Homepage traffic',[{...summary,newAccountsRegistered:registered,recordingSince:since}]);
      add('Recently active accounts',await q(`SELECT a.user_id AS "userId",u.manager_team_name AS "teamName",u.name,max(a.created_at) AS "lastSeen" FROM app.page_activity a JOIN app.users u ON u.id=a.user_id WHERE a.event='page_view' AND a.created_at > now()-interval '2 minutes' AND a.user_id <> all($1::text[]) AND lower(coalesce(u.email,'')) <> all($2::text[]) GROUP BY a.user_id,u.manager_team_name,u.name ORDER BY "lastSeen" DESC LIMIT 100`,[adminVisitorIds,adminVisitorEmails]),'Only accounts that actually opened a page in the last two minutes, excluding administrators. Heartbeats alone do not count.');
      add('Older marketing funnel records',await q(`SELECT meta->>'event' AS event,count(*)::int AS events,count(DISTINCT meta->>'visitorId')::int AS "browserVisitors" FROM app.audit_logs WHERE action='marketing.funnel' AND created_at >= $1::timestamptz AND created_at < $2::timestamptz GROUP BY meta->>'event'`,[period.from,period.to]),'Legacy funnel counts are separate and are not added to page tracking totals.');
      answers.push(`Homepage: ${summary.homepageSessions||0} recorded visits, ${summary.homepageViews||0} page views, ${summary.uniqueHomepageVisitors||0} distinct browser visitors, ${summary.firstSeenHomepageVisitors||0} first seen in the retained tracking history. ${registered} accounts registered in this period. Browser visitors and registrations are different metrics. Page history begins ${since||'when the first tracking event arrives'} and is retained for 90 days; cookies and multiple devices affect visitor counts.`);
      // Ordered browser cohort: attribution only when the same retained browser later identifies one account.
      const funnel=(await q(`WITH cohort AS (
        SELECT p.visitor_id,min(p.created_at) AS landed_at FROM app.page_activity p
        WHERE p.path='/' AND p.event='page_view' AND p.created_at >= $1::timestamptz AND p.created_at < $2::timestamptz ${excludeAdminBrowsers} GROUP BY p.visitor_id
      ), identity AS (
        SELECT c.visitor_id,c.landed_at,min(a.user_id) AS user_id,count(DISTINCT a.user_id) AS accounts
        FROM cohort c LEFT JOIN app.page_activity a ON a.visitor_id=c.visitor_id AND a.user_id IS NOT NULL AND a.created_at>=c.landed_at AND a.created_at<$2::timestamptz
        GROUP BY c.visitor_id,c.landed_at
      ), linked AS (
        SELECT i.*,u.created_at AS registered_at FROM identity i LEFT JOIN app.users u ON u.id=i.user_id AND i.accounts=1 AND u.created_at>=i.landed_at AND u.created_at<$2::timestamptz
      ) SELECT count(*)::int AS "homepageBrowsers",count(*) FILTER(WHERE registered_at IS NOT NULL)::int AS "linkedNewAccounts",
        count(*) FILTER(WHERE accounts>1)::int AS "sharedBrowserIdentities",
        count(*) FILTER(WHERE registered_at IS NOT NULL AND EXISTS(SELECT 1 FROM app.competition_entries e WHERE e.user_id=linked.user_id AND e.joined_at>=registered_at AND e.joined_at<$2::timestamptz))::int AS "enteredAfterSignup"
        FROM linked`,visitorParams))[0]||{};
      add('Observed homepage conversion cohort',[{...funnel,unlinkedOrNotRegistered:Math.max(0,Number(funnel.homepageBrowsers||0)-Number(funnel.linkedNewAccounts||0))}], 'Homepage browsers first observed within the selected period, linked to exactly one account on the same browser before period end. Existing accounts and shared browsers are excluded from signup conversion. Unlinked visitors may have registered on another device; this is observed attribution, not proof of abandonment.');
      if(await exists('user_onboarding'))add('New-account onboarding cohort',await q(`SELECT count(*)::int AS "newAccounts",count(*) FILTER(WHERE o.completed)::int AS "starterSelectionCompletedNow",count(*) FILTER(WHERE EXISTS(SELECT 1 FROM app.competition_entries e WHERE e.user_id=u.id AND e.joined_at>=u.created_at AND e.joined_at<$2::timestamptz))::int AS "enteredByPeriodEnd" FROM app.users u LEFT JOIN app.user_onboarding o ON o.user_id=u.id WHERE u.created_at >= $1::timestamptz AND u.created_at < $2::timestamptz`,[period.from,period.to]),'Starter completion is the current onboarding flag; it has no completion timestamp and cannot establish ordering or historical completion by the period end.');
      answers.push('Conversion evidence separates linked homepage browsers from all new accounts. Unknown links and untimestamped onboarding flags are labelled; recorded counts cannot explain why someone left.');
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
      if(context.paymentReference){
        const matches=await q(`SELECT id,type,status,amount,fee_amount AS "feeAmount",net_amount AS "netAmount",external_transaction_id AS "paymentReference",source_type AS "sourceType",created_at AS "createdAt" FROM app.transactions WHERE user_id=$1 AND external_transaction_id=$2 ORDER BY created_at DESC LIMIT 100`,[target,context.paymentReference]);
        add('Payment reference trace',matches,'Exact reference match for the selected account, across all dates. References are not accepted as proof that a bank or provider paid.');
        if(!matches.length)answers.push('No transaction with that payment reference was found in this account. Confirm the reference and account; no posting can be inferred.');
        if(await exists('deposit_verifications'))add('Linked payment reviews',await q(`SELECT d.id,d.transaction_id AS "transactionId",d.status,d.gross_amount AS "grossAmount",d.fee_amount AS "feeAmount",d.net_amount AS "netAmount",d.created_at AS "createdAt",d.reviewed_at AS "reviewedAt" FROM app.deposit_verifications d JOIN app.transactions t ON t.id=d.transaction_id AND t.user_id=d.user_id WHERE d.user_id=$1 AND t.external_transaction_id=$2 LIMIT 100`,[target,context.paymentReference]));
        answers.push(...matches.map(t=>`Transaction #${t.id}: ${t.status}; recorded amount ${money(t.amount)}, fee ${money(t.feeAmount)}, net ${money(t.netAmount)}. ${t.status==='completed'?'Completed is the recorded ledger status; reconciliation below checks the wallet.':'This status does not establish a completed wallet credit. Review the linked request before any correction.'}`));
      }else if(/missing|not.*(?:show|reflect|arriv)|trace|investigat|why/i.test(question))followUps.push('Trace payment reference “…”');
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
      answers.push('Latest loan contract statuses, recorded charges and expiry dates are below. To accept an offer or manage a loan, use Marketplace’s loan controls. Chat can search open loan offers; it does not accept or cancel a loan for you.');links.push({label:'Marketplace loans',href:'/marketplace'});
    }
    if(topics.includes('notifications')){
      add('Notifications',await q(`SELECT id,title,message,read,created_at AS "createdAt" FROM app.notifications WHERE user_id=$1 ORDER BY created_at DESC,id DESC LIMIT 101 OFFSET $2`,[target,offset]),'Latest inbox records across all dates. An inbox record alone does not prove push delivery.',true);
      const notificationId=Number(question.match(/notification\s*#?\s*(\d+)/i)?.[1]||0);
      const diagnosis:Array<Record<string,unknown>>=[];
      for(const [table,title] of [['notification_push_deliveries','Web push job status'],['notification_native_push_deliveries','Android push job status']]){
        // Fixed allowlist; no table name or SQL can come from the question.
        if(await exists(table))add(title,await q(`SELECT d.status,count(*)::int AS count,max(d.sent_at) AS "lastSentAt" FROM app.${table} d JOIN app.notifications n ON n.id=d.notification_id WHERE n.user_id=$1 GROUP BY d.status`,[target]),'Queue/provider status across all dates. Sent means provider acceptance, not proof that a person saw or opened it.');
      }
      for(const [table,channel] of [['notification_push_deliveries','web'],['notification_native_push_deliveries','android']]){
        if(await exists(table)){
          const jobs=await q(`SELECT n.id AS "notificationId",n.read,d.status,d.attempts,d.next_attempt_at AS "nextAttemptAt",d.sent_at AS "sentAt",d.updated_at AS "updatedAt",CASE WHEN d.last_error LIKE '%(401)%' THEN 'provider_authorization' WHEN d.last_error LIKE '%(403)%' THEN 'provider_permission' WHEN d.last_error LIKE '%(404)%' OR d.last_error LIKE '%(410)%' THEN 'subscription_expired' WHEN d.last_error IS NOT NULL THEN 'delivery_error' ELSE NULL END AS "errorCategory" FROM app.${table} d JOIN app.notifications n ON n.id=d.notification_id WHERE n.user_id=$1 AND ($2::bigint=0 OR n.id=$2) ORDER BY d.updated_at DESC LIMIT 100`,[target,notificationId]);
          diagnosis.push(...jobs.map(row=>({...row,channel,nextStep:row.status==='failed'?'Review notification settings and delivery configuration.':row.status==='pending'?'Queued; check the next attempt time.':row.status==='sent'?'Provider accepted; device display and human attention remain unknown.':'Inspect the recorded job status.'})));
        }
      }
      add('Notification delivery investigation',diagnosis,'Latest 100 jobs per channel, or an exact notification number. Error categories omit raw provider responses and credentials. Read is the inbox flag, not proof of a push being seen.');
      if(!diagnosis.length)answers.push('No matching push jobs were recorded. An inbox notification can exist without a registered push subscription.');
      followUps.push('Investigate notification #…');
      answers.push('To mark an inbox notification as read, open Preview an action below. Review the account and notification number before confirming.');
      answers.push('These are the account’s inbox records. They do not establish that a push was delivered or opened.');links.push({label:'Inbox',href:'/account?tab=inbox'});
    }
    if(topics.includes('support')){
      await optional('support_requests','Support inbox',`SELECT id,category,subject,status,created_at AS "createdAt" FROM app.support_requests ORDER BY created_at DESC LIMIT 100`,[]);
      answers.push('Latest support request subjects and statuses are below. To update a request status, open Preview an action below, select the support request number and review the proposed status before confirming.');links.push({label:'Admin support inbox',href:'/admin'});
    }
    if(topics.includes('help')){
      answers.push(...knowledge.answers);
      const features=featureHelp(question);
      if(!knowledge.answers.length&&features.length){answers.push(...features.map(f=>f.label+': '+f.description));links.push(...features.map(f=>({label:f.label,href:f.href})));}
      if(!knowledge.answers.length&&!features.length)answers.push('I can’t answer that reliably with the connected information. Tell me which site feature or record you mean, or ask “What can you do?” to see the available tools.');
      if(knowledge.sources.length)add('Help sources',knowledge.sources.map(source=>({source})));
    }
    const hasMore=sections.some(s=>s.hasMore);
    return {context,followUps:[...new Set(followUps)],answer:[...new Set(answers)].join('\n\n'),sections,notes,links:[...new Map(links.filter(link=>input.admin||link.href!=='/admin').map(link=>[link.href,link])).values()],account,topics,period,asOf:new Date().toISOString(),nextOffset:hasMore&&offset<10000?offset+100:null,offset,scope:account?`Account ${account.teamName||account.name||account.id}`:topics.includes('help')?'Site help':topics.includes('market')||topics.includes('tournaments')||topics.includes('football')?'Live site information':'Account report',limits:'Up to 100 rows per section. Current balances and latest-record sections are labelled separately from period-specific records. Totals and wallet reconciliation use their full stated scope.'};
  };
}
