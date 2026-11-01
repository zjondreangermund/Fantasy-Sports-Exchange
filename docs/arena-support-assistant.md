# Arena support assistant

Signed-in users open Arena Help for server-backed support. Desktop, mobile web and native shells share the same widget. The administrator role is checked on the server for every request.

## Reports and help

- Administrators: homepage views, distinct browser visitors, first-seen visitors within retained history, new account registrations, recent activity, platform totals and support inbox status.
- Account investigations: recorded page visits and actions; current wallet balances, deposits, withdrawals, transactions, fees, auction reservations and ledger discrepancies; entries, ranks, selected-card scoring records, owned cards, active card locks, loans and notifications.
- Members can inspect only their own account. Administrators can select another account by ID, email or manager name. Ambiguous names require selection.
- Questions can combine supported subjects. Follow-ups keep the selected account and date range. Dates support Namibia-time today/yesterday, this/last week, this/last month, last N days, and YYYY-MM-DD ranges, up to 90 days.
- Long account lists support 100-record pages. Aggregate totals and wallet reconciliation do not sum only the visible page.
- Help uses canonical scoring/economy/tournament constants and an opt-in index of explicitly authored public help. Unsupported questions are reported as unverified. No external LLM subscription or key is required.

Example questions:

- “How many new users visited the homepage today?”
- “What did Bob do while online?”
- “Why are funds locked in this wallet?”
- “Show transaction #123.”
- “Why can’t I enter a tournament?”
- “Show my entries and missing scoring records.”
- “What happened to my notification?”

The assistant reads operational evidence. It does not approve deposits, pay withdrawals, change balances, settle competitions, or create/delete account records. Its reads are audited by actor, topic, target account and period. SQL is parameterized and drawn from fixed queries. Bank account numbers, verification tokens, push tokens and credentials are not returned.

## Activity and expiry

Page tracking stores route paths (without query strings or fragments), session/visitor identifiers, authenticated identity when present, and event time. It does not capture form fields or keystrokes. Heartbeats are sent only from visible pages; recent activity does not prove human attention. Tracking retains 90 days and starts after deployment. It cannot reconstruct unrecorded past visits. Browser cookies approximate visitors; they are not guaranteed unique people.

Community Live uses rolling per-message 24-hour expiry. Server reads immediately exclude expired content; scheduled cleanup removes expired messages and related mention notifications. Cached history and reply previews are also pruned. Editing a message does not renew its age. Build preparation must not replace this behavior with a room-wide reset that deletes newer messages.

## Validation

`npm run test:assistant`, `node scripts/test-entry-recovery.mjs`, `npm run check`, and `npm run build` validate the combined change. Local PostgreSQL-compatible integration checks additionally exercised every report query with seeded records, including cross-account isolation and reconciliation. Production data and browser/device behavior still require observation after deployment.

## Connected investigations and actions

- Entry investigations join tournament status and verified first kickoff with the selected entry’s captain, distinct footballers, stored positions, rarity rules, ownership, sale listings and other active locks. Use `Investigate entry #10` or `Why can’t I enter tournament #5?`. A new failed submission without a saved entry has no recorded five-card selection: the assistant asks for more evidence and does not invent it. Current provider player identity is rechecked by the normal save route.
- Wallet investigations accept `Trace payment reference “REF”` and join that account’s exact transaction to deposit review, fees, posting status and reconciliation. References never grant access to another account.
- Football questions use API-Football fixture availability, including confirmed starters/bench and separate earlier reports, with source dates and stale-provider warnings. Ask `Is Isak starting?` or `Is player “Salah” starting?`. Broad availability reports show at most 100 rows per category; use a player name to narrow them. Match selection does not establish medical clearance.
- Settlement diagnostics inspect accessible tournament entry scoring snapshots, missing/provisional score rows and matching season/gameweek unfinished fixtures. A final zero score is valid evidence, not a missing score. These checks never authorize or trigger settlement.
- Notification diagnostics show per-job channel, queue state, attempts, next attempt and sanitized provider error categories. Provider acceptance and inbox read flags do not prove a person saw a push. Raw provider errors and credentials are omitted.
- Admin conversion reports build a retained homepage-browser cohort and link only browsers identifying exactly one account after landing. New-account and onboarding cohorts remain separate; onboarding completion has no timestamp, and unlinked browsers do not prove abandonment.
- Follow-up prompts ask for entry/tournament/player/payment identifiers. Account, time range and investigation identifiers carry forward; an explicit new tournament clears an older entry selection. Changing account search clears the earlier conversation context.
- Optional browser speech recognition puts the transcript in the input for review. It never auto-sends a question or confirms an action. Browser support and microphone permission are required; the browser’s speech provider may process audio.

The `Preview an action` control connects two explicit operations: mark a selected account’s inbox notification read, or (admin only) update a support request status. The server stores the proposed operation for ten minutes, bound to its actor/account and expected record state. Confirmation rechecks authorization and state inside one transaction with the change, audit record and consumed preview. Replays are idempotent; expired or changed records require a fresh preview. Support-status updates send no message. Payments, wallet corrections, team edits and settlements remain on their existing pages and controls. No model-generated SQL or arbitrary action names are executed.

`npm run test:assistant` includes PostgreSQL-compatible PGlite integration tests for the connected queries, cross-account isolation, deadline uncertainty, valid zero scores, conversion attribution, action expiry, state conflicts and replay protection. This assistant remains a bounded evidence service: unsupported questions and absent records are labelled unverified rather than answered from guesses.

## Gameweek logs and help grounding

“Please check the latest game week log”, “Show GW9 log” and sync-history questions route to an admin-only operational report. Latest means the live/latest started stored API-Football Premier League round in the current season; if fixture context is unavailable the latest started stored tournament is explicitly labelled as an unverified fallback. Requested weeks are restricted to the current season. Reports include fixture sync dates, current tournament/scoring snapshots, recorded competition operations and latest provider sync jobs. Provider jobs have no gameweek foreign key and are labelled as all-gameweek records. This does not read unrecorded console output or trigger any write or sync.

Generic UI string scraping is removed. Only explicit `data-assistant-guide` annotations are eligible for indexed guide excerpts, labelled “Site guide”. Conditional toasts, error strings and empty states cannot become claims about current account/gameweek state. Unsupported questions produce an unverified response.

Unsupported operation requests are checked before report routing. Asking the bot to enter/submit a team or settle/pay/change a record returns a direct capability refusal without unrelated account queries. The two connected actions direct users to preview/confirm controls; chat text never executes them. Unverified help questions receive a short “I can’t answer that reliably” response.
