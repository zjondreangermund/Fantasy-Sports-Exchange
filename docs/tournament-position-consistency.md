# Tournament player position consistency

Fantasy Arena’s collectible/selection role and API-Football’s match-role classification are different concepts. A provider can classify Doku as FWD or Neco Williams as MID while the official fantasy roster used by tournament selection classifies them as MID and DEF respectively.

The submitted-team score-detail endpoint previously gave provider match roles precedence over tournament positions. Loan listings did the same; the API-only profile fallback could also overwrite a card’s role. This made one player display differently across views.

`shared/tournament-position.ts` now supplies the display precedence for these paths: valid official fantasy roster role, stored tournament role, then provider role only if neither is available. The existing verified player-identity resolver selects the official record; there are no player-name exceptions. Unknown roles remain unknown. Auction and pack-auction card reads also align to the same official roster position.

Score-detail labels now match the positions shown in Collection, selection and My Entries. Provider match positions remain separate inputs to the existing API-Football scoring engine. Saved scores, captain bonuses, settled snapshots, card ownership, lineup ordering and selection rules are not rewritten by this display fix. A provider’s raw position in the football match-data centre still describes its real match role, rather than a fantasy roster slot.

`npm run test:positions` exercises the real entry-detail and loan HTTP handlers, Doku/Williams disagreements, 68 synthetic identities, all official/stored/provider role combinations, nested auction cards, missing official-source fallback, and unchanged scoring inputs/final snapshots. CI repeats it after build transforms so preparation scripts cannot silently restore the conflicting precedence. These are fixture-based regressions, not a claim that every private production account was inspected.
