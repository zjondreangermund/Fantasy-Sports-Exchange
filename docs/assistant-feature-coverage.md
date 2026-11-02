# Assistant feature coverage — 2 November 2026

The source code is not exposed to the chatbot or to members. Reviewed feature descriptions in `shared/assistant-features.ts` explain the public product; fixed, parameterized server tools retrieve current records. This avoids quoting error messages as facts or granting arbitrary SQL/code execution. Adding a new site feature still requires an explicit data tool or reviewed guide; this is not an unrestricted general-purpose AI or a promise to answer every possible question.

| Area | Connected evidence / controls |
| --- | --- |
| Marketplace | Current listed cards; player/club text, position, rarity and maximum price; own listings; lowest price first; 100-row pagination; named marketplace links open the existing search filter |
| Loans | Current open offers with weekly price and duration; own contracts, charges and expiry; accept/cancel controls remain on Marketplace |
| Purchases and sales | Account-scoped ledger records and whole-period totals; modern and legacy transaction types; card identity when recorded; no counterparty IDs or transaction-description leakage |
| Cards | Owned collectibles and active locks; existing reviewed listing/unlisting/watch tasks |
| Team availability | Provider freshness, current fixture absences and confirmed selection; deduplicated player/fixture rows and club groups; own collection filter; absence of evidence never becomes “fit” |
| Play | Public open/active tournament discovery; existing entry diagnostics, score records, first-kickoff guard and preview/confirm team submission/edit tasks |
| Auctions | Live status plus start/end time checks; public card/price information and own bids; auction page retains bid confirmation |
| Prizes | Recorded allocations and Prize Vault award statuses; existing claim task; no claim of delivery from rank/amount alone |
| Wallet | Existing balances, holds, transaction/reference traces, deposit/withdrawal review and reconciliation |
| Account / notifications | Profile details; existing rename, inbox and preference tasks; push evidence distinguishes provider acceptance from device display |
| Guidance | Reviewed navigation and capability catalogue across Marketplace, Loans, Collection, Tournaments, Entries, Availability, Wallet, Auctions, Rewards, Vault, Inbox, Account, Community, Install, Scoring and Support |
| Admin | Separate authenticated audience, visitor/activity/platform reports, sync/settlement investigation and tasks; server authorization plus identity-bound, fail-closed tab visibility |

Examples are suggestions, not the only accepted wording. “My buys”, “What did I buy?”, “My purchases”, “My sales” and “Cards I sold” select trade reports. “Is Saka available on the marketplace?” searches public sale listings, not the signed-in member's collection or football injury reports. “Only Rare cards” and “Under N$85” preserve an immediately preceding marketplace search. Unsupported questions explicitly decline rather than inventing records.

Security and behavior are exercised by `test-assistant-discovery.mjs` using PostgreSQL-compatible seeded data, in addition to the existing assistant/channel regression suites. No production account records or purchases are changed by these tests. Admin-tab screenshots taken while signed in as an authorized administrator are expected to include Admin Assistant, even when Member Help is selected.
