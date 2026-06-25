# Fantasy Arena Refactor Audit — Phase 1

Repository: `Fantasy-Sports-Exchange`
Branch audited: `main`

## Refactor Rule

This audit does not rebuild the app. The goal is to identify the current production wiring first, then clean safely in small commits.

## Executive Summary

Fantasy Arena is working, but the frontend currently has several overlapping concepts:

- Multiple card render paths exist.
- Production routes and sidebar labels do not yet match the desired simplified product structure.
- Some pages are production-facing, while others are experiments/labs that should be moved out of the main user flow.
- Player image handling already has a fallback pipeline, but the public data model still exposes several image-like names across adapters/types.
- Page-level UI is feature-rich, but some areas are heavier than needed for a clean Sorare / EA FC Ultimate Team / Topps Chrome / Panini Digital style product.

## Production Entry Points

### App Shell

Active production entry file:

- `client/src/App.tsx`

Findings:

- Uses `wouter` routes.
- Uses `React.lazy` for page-level lazy loading.
- Wraps the authenticated app with:
  - `AppSidebar`
  - `RouteSceneBackground`
  - `StadiumAmbientLayer`
  - `LivePulseDock`
  - `MatchdayQuickDock`
  - `MobileNavDock`
  - `FloatingEventNotifications`
  - `FloatingSupportWidget`
- This is functional, but the shell has too many always-mounted visual/support layers for a performance-first mobile product.

Recommended change later:

- Keep the shell.
- Do not rebuild it.
- Move optional overlays behind route checks or lazy/dynamic loading.

## Routes Audit

Routes currently wired in `client/src/App.tsx`:

| Route | Page | Status | Notes |
|---|---|---|---|
| `/` | `dashboard` | Active | Main dashboard route |
| `/dashboard` | `dashboard` | Active duplicate | Same page as `/`; keep redirect/alias only if intentional |
| `/analytics` | `analytics` | Active but cleanup candidate | Not in requested final sidebar |
| `/live-lineup` | `live-lineup` | Active | Should likely become part of `Play` or `Lineups` flow |
| `/onboarding` | `onboarding` | Active | Needed for new users |
| `/onboarding-packs` | `onboarding-packs` | Active onboarding | Keep only if still used in onboarding sequence |
| `/onboarding-tunnel` | `onboarding-tunnel` | Active onboarding | Could be experiment unless required |
| `/card-reveal` | `card-reveal` | Active onboarding/rewards | Keep but route should be internal, not primary nav |
| `/competitions` | `competitions` | Active | Should map to `Play` or `Leagues` depending product language |
| `/premier-league` | `premier-league` | Active | Sidebar labels this as Leagues |
| `/card-lab` | `card-lab` | Active experiment | Should not be in production sidebar |
| `/collection` | `collection` | Active | Core product page |
| `/marketplace` | `marketplace-v2` | Active | Core product page |
| `/auctions` | `auctions` | Active but hidden from sidebar | Decide whether active product feature or archive |
| `/wallet` | `wallet` | Active | Core product page |
| `/account` | `account` | Active | Should be renamed/treated as Profile or Settings |
| `/admin` | `admin` | Active admin-only | Keep gated |

Recommended route cleanup later:

- Keep one canonical dashboard route.
- Keep hidden/internal onboarding/reveal routes.
- Remove `Card Lab` from normal user navigation.
- Decide whether `/analytics` and `/auctions` are production features or admin/lab routes.

## Sidebar Audit

Active file:

- `client/src/components/app-sidebar.tsx`

Current sidebar items:

- Dashboard
- Live Lineup
- Tournaments
- My Team
- Leagues
- Analytics
- Marketplace
- Wallet
- Account
- Card Lab
- Admin, only when admin check passes

Target sidebar from master task:

- Dashboard
- Play
- Collection
- Marketplace
- Leagues
- Wallet
- Profile
- Settings

Findings:

- `My Team` currently maps to `/collection`; should become `Collection`.
- `Live Lineup` and `Tournaments` should likely be consolidated under `Play` or kept as child flows.
- `Account` should become `Profile` or split into Profile / Settings.
- `Card Lab` is an experiment and should not be a normal production nav item.
- `Analytics` is not part of the requested final sidebar.

Recommended change later:

- Update sidebar labels and grouping only after route ownership is confirmed.
- Avoid deleting pages until imports and user flows are verified.

## Card System Audit

### Active / Production Card Components

#### `PremiumFootballCard`

File:

- `client/src/components/PremiumFootballCard.tsx`

Status:

- Active.
- This should become the single production card component.

Used by:

- `CollectionPlayerCard`
- `CardShowcase`

Findings:

- Contains rarity chrome colours.
- Handles `image`, `imageUrl`, `photo`, and `imageCandidates`.
- Has local fallback behavior when image candidates fail.
- Already memoized on export.

Recommended direction:

- Keep this component.
- Move helper logic out into smaller card subcomponents only after usages are unified.
- Eventually place under `client/src/components/cards/PremiumFootballCard.tsx`.

#### `CollectionPlayerCard`

File:

- `client/src/components/CollectionPlayerCard.tsx`

Status:

- Active wrapper.
- Used by `collection.tsx` and `card-reveal.tsx`.

Finding:

- It is only a thin wrapper around `PremiumFootballCard`.

Recommended direction:

- Keep temporarily for compatibility.
- Later replace imports with `PremiumFootballCard` directly, then delete wrapper.

#### `CardShowcase`

File:

- `client/src/components/CardShowcase.tsx`

Status:

- Active wrapper.
- Used by Marketplace purchase dialog.

Finding:

- Converts `PlayerCardWithPlayer` through `toFantasyCardData`, then renders `PremiumFootballCard`.

Recommended direction:

- Keep temporarily.
- Later decide whether this is a display wrapper or fold into a reusable card presentation component.

### Duplicate / Legacy Card Components

#### `UnifiedPlayerCard`

File:

- `client/src/components/cards/UnifiedPlayerCard.tsx`

Status:

- Active indirectly through marketplace card grid components.
- Uses legacy `Card3D`.

Finding:

- Despite its name, it is not the unified production card. It adapts data into `Card3D`.

Recommended direction:

- Replace `UnifiedPlayerCard` internals with `PremiumFootballCard`, or remove it after marketplace uses `PremiumFootballCard` directly.

#### `Card3D`

File:

- `client/src/components/Card3D.tsx`

Status:

- Legacy/duplicate card renderer.
- Still referenced by `UnifiedPlayerCard`.

Recommended direction:

- Do not delete yet.
- First migrate marketplace and any remaining imports to `PremiumFootballCard`.
- Delete only after search confirms zero production imports.

#### `PlayerTile`

File:

- `client/src/components/PlayerTile.tsx`

Status:

- Used by `analytics.tsx` and `live-lineup.tsx`.

Recommended direction:

- Review whether those pages need compact player rows.
- If yes, keep as non-card list item.
- If it visually competes with the card system, rename to `PlayerListItem` or replace with a compact `PremiumFootballCard` mode.

## Pages Audit

| Page | Current status | Cleanup action |
|---|---|---|
| Dashboard | Active | Keep, simplify content density later |
| Marketplace | Active via `marketplace-v2` | Keep, migrate card display to `PremiumFootballCard` everywhere |
| Collection | Active | Keep, already uses `PremiumFootballCard` via wrapper |
| Live Matches / Live Lineup | Active as `/live-lineup` | Keep under Play; audit `PlayerTile` usage |
| Lineups | Active inside collection/live-lineup flows | Should become clearer product flow |
| Leagues | Active as `/premier-league` and `/competitions` | Naming overlap needs cleanup |
| Profile | Not clearly separated | Current `/account` likely covers this |
| Wallet | Active | Keep |
| Settings | Not clearly separated | May need split from `/account`, but no new page until account file is audited |
| Analytics | Active but not target nav | Move to admin/lab or remove from sidebar |
| Card Lab | Active experiment | Remove from production sidebar after confirming no dependency |
| Auctions | Route exists but not sidebar | Decide if product feature; otherwise archive |

## Asset Audit — Initial Findings

Known asset categories from code references:

- Player images via `/api/players/:id/photo`.
- Fallback image: `/players/fallback.png`.
- Legacy fallback reference: `/images/player-1.png` appears in `UnifiedPlayerCard`.
- Card rarity visuals appear to be mostly CSS/gradient-based inside `PremiumFootballCard`.

Recommended next audit command set:

- Search `/client/public` and `/client/src/assets` for duplicate player placeholders.
- Search all CSS files for old card classes.
- Search for `/images/player-1.png`, `/players/fallback`, `rarity`, `card-bg`, `foil`, and `chrome`.

## Database / Player Image Model Audit

Active DB player model:

- `shared/schema.ts`
- `players.imageUrl` maps to database column `image_url`.

Current image aliases still appear in app types/adapters:

- `image`
- `imageUrl`
- `photo`
- `photoUrl`
- `image_url`
- `imageCandidates`

Findings:

- The database model is already cleanest with `players.imageUrl`.
- The adapter currently supports many aliases to survive inconsistent data.
- `toFantasyCardData` returns multiple image fields to `PremiumFootballCard`.
- `buildCardImageCandidates` is the correct central image fallback pipeline.

Recommended standard:

- Database canonical field: `players.imageUrl`.
- UI canonical field: `PlayerCardData.image` as the chosen display image.
- Fallback list: `PlayerCardData.imageCandidates` generated only by adapter/helper.
- Avoid passing `photo`, `photoUrl`, and `image_url` deeper into components except in data-normalization helpers.

## Performance Audit — Initial Findings

Current positives:

- Page components are lazy-loaded through `React.lazy`.
- Some heavy card wrappers are memoized.
- Collection uses pagination via `visibleCount` instead of rendering all cards at once.

Risks:

- Authenticated app always mounts multiple background/overlay components.
- Marketplace filters call `toFantasyCardData` inside filter loops.
- Marketplace currently renders list rows instead of cards, while dialogs use `CardShowcase`, creating mixed render paths.
- Collection computes showcase arrays and values in render scope; some can be memoized.
- Card image fallback state is per-card; acceptable, but should be kept simple and memo-friendly.

Recommended performance order:

1. Unify card rendering.
2. Memoize marketplace mapped card data once per listings response.
3. Move optional overlays behind route-aware lazy loading.
4. Audit bundle after dead components are removed.

## Safe Cleanup Plan

### Commit 1 — Documentation only

- Add this audit file.
- No production code changes.

### Commit 2 — Card render path unification

Files likely changed:

- `client/src/components/cards/UnifiedPlayerCard.tsx`
- `client/src/components/cards/PlayerCard.tsx`
- possibly `client/src/pages/marketplace-v2.tsx`

Goal:

- Make marketplace card components use `PremiumFootballCard`.
- Keep visual behavior working.
- Do not delete `Card3D` yet.

### Commit 3 — Sidebar simplification

Files likely changed:

- `client/src/components/app-sidebar.tsx`
- possibly route labels only, not route removal yet.

Goal:

- Remove experimental items from primary nav.
- Rename `My Team` to `Collection`.
- Rename `Account` to `Profile` unless settings split is already available.

### Commit 4 — Dead import verification

Goal:

- Search for remaining imports of `Card3D`, `UnifiedPlayerCard`, `CollectionPlayerCard`, and `PlayerTile`.
- Delete only files with zero production references.

### Commit 5 — Image model standardization

Files likely changed:

- `client/src/lib/fantasy-card-adapter.ts`
- `client/src/lib/card-image.ts`
- `client/src/components/cards/types.ts`
- `client/src/components/PremiumFootballCard.tsx`

Goal:

- Keep DB `imageUrl`.
- Standardize UI to `image` + `imageCandidates`.
- Keep fallback behavior.

## Do Not Delete Yet

Do not delete these until a second search confirms no production imports:

- `client/src/components/Card3D.tsx`
- `client/src/components/cards/UnifiedPlayerCard.tsx`
- `client/src/components/PlayerTile.tsx`
- `client/src/components/CollectionPlayerCard.tsx`
- `client/src/components/CardShowcase.tsx`

## Phase 1 Decision

Proceed with architecture cleanup in this order:

1. Card system first.
2. Sidebar and route simplification second.
3. Asset deletion third.
4. Database/image field cleanup fourth.
5. Performance optimization after duplicate rendering paths are removed.
