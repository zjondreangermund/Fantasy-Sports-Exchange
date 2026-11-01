# Fantasy Arena change audit — 1 November 2026

Verified against GitHub and Railway before this task expansion:

| Change | Merged pull request | Evidence and limits |
| --- | --- | --- |
| Notification destinations and first-kickoff team locking | #382 | Shared notices/deep links and server lineup guard; no later-fixture reopening |
| Premier League data deduplication and club dropdowns | #382 | Shared normalization and availability grouping; regression suite passes |
| Rolling 24-hour community expiry | #382 | Server read filter, expired-only cleanup and local cache pruning |
| Account, wallet, page-activity and admin visitor reports | #382 | Fixed server queries, role/ownership checks; tracking starts with deployment |
| Confirmed lineup versus historical injury handling | #383 | Fixture resolver and Isak regression; earlier live verification recorded separately |
| Investigations, conversion, voice controls and two confirmed actions | #384 | Database regression coverage; authenticated live reports were not exercised in this audit |
| Gameweek logs and removal of unverified UI-string replies | #385 | Exact screenshot question in regression coverage; unsupported-action behavior is now expanded into guided supported tasks |

All four PRs were merged. Railway reported SUCCESS for main commit `c358a3528fdc7c3cd33584f56dfebbec1b5325ff` at audit time. This is deployment evidence, not proof of every authenticated/device workflow.

Gaps found and addressed in the task expansion: “site views” phrasing did not select traffic reports; traffic originally meant homepage rather than all tracked routes; site tasks beyond two small actions were absent; the microphone Permissions-Policy blocked same-origin microphone access. The new task catalogue and validation are documented in `arena-support-assistant.md`.

Task execution is tested with PostgreSQL-compatible seeded data and real Express route dispatch. No production team, wallet, prize or administrator record is changed as part of these tests. Native/browser speech recognition remains device-dependent. Unlisted mutations remain explicitly unsupported.
