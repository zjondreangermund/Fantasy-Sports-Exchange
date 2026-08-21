# Normal-user card forensics

Production startup runs `scripts/run-normal-user-card-forensics.mjs` before taking the next ownership snapshot or resetting the four explicit test accounts.

The wrapper runs two read-only audits and performs only in-container source normalization needed for those audits. It never writes card ownership. The four test accounts remain excluded from normal-user forensic scope.

Any actual ownership recovery remains backup-gated through `CARD_RECOVERY_SOURCE_DATABASE_URL` and requires the separate explicit `CARD_RECOVERY_APPLY=true` flag in the recovery script. Do not enable apply from normal startup.
