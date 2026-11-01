# Arena support assistant

Signed-in users open Arena Help for server-backed support. Desktop, mobile web and native shells share the same widget. The administrator role is checked on the server for every request.

## Reports and help

- Administrators: homepage views, distinct browser visitors, first-seen visitors within retained history, new account registrations, recent activity, platform totals and support inbox status.
- Account investigations: recorded page visits and actions; current wallet balances, deposits, withdrawals, transactions, fees, auction reservations and ledger discrepancies; entries, ranks, selected-card scoring records, owned cards, active card locks, loans and notifications.
- Members can inspect only their own account. Administrators can select another account by ID, email or manager name. Ambiguous names require selection.
- Questions can combine supported subjects. Follow-ups keep the selected account and date range. Dates support Namibia-time today/yesterday, this/last week, this/last month, last N days, and YYYY-MM-DD ranges, up to 90 days.
- Long account lists support 100-record pages. Aggregate totals and wallet reconciliation do not sum only the visible page.
- Help uses canonical scoring/economy/tournament constants and a generated index of public UI explanations. Unsupported questions are reported as unverified. No external LLM subscription or key is required.

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
