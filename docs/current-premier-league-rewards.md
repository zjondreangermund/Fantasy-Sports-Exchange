# Current Premier League reward eligibility

New weekly, prize, referral and replacement cards must match both the current official FPL roster and an active API-Football squad record for a current Premier League club and season. FPL is used for identity and membership only, never tournament scoring. Its mint roster cache is five minutes; API squad verification must be at most 48 hours old. Historical-season fallback records cannot authorize a reward.

Local departure flags, active external loans and recorded transfers outside the league also exclude a player. The database checks current membership again at mint time, including first assignment of unowned inventory, to catch changes after selection. Existing owned-card transfers are not new mints.

When current membership cannot be verified, claims fail without consuming the weekly entitlement or issuing a prize card. Already-issued rewards replay the original card ID; they are never silently rerolled. Existing departure replacement claims remain available. Injury does not make a current Premier League player ineligible. Position balancing, rarity, supply limits and duplicate restrictions remain in effect.

Run `npm run test:rewards` for transactional regression coverage, including stale identities, departures, historical seasons, loans, transfers, stale squads, outages, replay identity and mint-time races. CI repeats this after build preparation.
