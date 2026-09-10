import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function write(path, source) {
  fs.writeFileSync(path, source);
}

function replaceRequired(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`[marketplace-clubs] ${label} anchor not found`);
  return source.replace(from, to);
}

// MARKETPLACE_CLUB_IDENTITIES_V1
// Public sale listings carry the seller's Fantasy Arena club name. Do not expose
// the account email/name as a marketplace identity fallback.
{
  const path = "server/routes/marketplace.routes.ts";
  let source = read(path);
  source = replaceRequired(
    source,
    "p.form as player_form from app.player_cards pc join app.players p on p.id = pc.player_id where pc.for_sale = true",
    "p.form as player_form, coalesce(nullif(trim(u.manager_team_name), ''), 'Unnamed Club') as seller_club_name from app.player_cards pc join app.players p on p.id = pc.player_id left join app.users u on u.id = pc.owner_id where pc.for_sale = true",
    "sale listing seller club",
  );
  write(path, source);
}

// Loan listings already joined the owner. Make the public identity explicitly the
// Fantasy Arena club name and remove the old email fallback.
{
  const path = "server/routes/loanMarket.routes.ts";
  let source = read(path);
  source = replaceRequired(
    source,
    "coalesce(u.manager_team_name, u.name, u.email, 'Manager') as owner_name",
    "coalesce(nullif(trim(u.manager_team_name), ''), 'Unnamed Club') as owner_name, coalesce(nullif(trim(u.manager_team_name), ''), 'Unnamed Club') as owner_club_name",
    "loan listing lender club",
  );
  write(path, source);
}

// Native marketplace: show the seller/lender club directly in the listing row and
// again in the buy/loan confirmation sheet. Club names are searchable too.
{
  const path = "client/src/components/native/NativeMarketPage.tsx";
  let source = read(path);

  const loanNameBlock = `function loanName(loan: LoanListing) {\n  return String(loan.player_name || loan.playerName || loan.card?.player?.name || "Player");\n}`;
  const identityHelpers = `${loanNameBlock}\n\n// MARKETPLACE_CLUB_IDENTITIES_V1\nfunction sellerClubName(card: any) {\n  return String(card?.seller_club_name || card?.sellerClubName || "Unnamed Club");\n}\n\nfunction lenderClubName(loan: LoanListing) {\n  return String(loan?.owner_club_name || loan?.ownerClubName || loan?.owner_name || loan?.ownerName || "Unnamed Club");\n}`;
  source = replaceRequired(source, loanNameBlock, identityHelpers, "native club-name helpers");

  source = replaceRequired(
    source,
    'return `${card.player?.name || ""} ${card.player?.team || ""} ${card.player?.position || ""} ${card.rarity || ""}`.toLowerCase().includes(needle);',
    'return `${card.player?.name || ""} ${card.player?.team || ""} ${card.player?.position || ""} ${card.rarity || ""} ${sellerClubName(card)}`.toLowerCase().includes(needle);',
    "native sale search by club",
  );
  source = replaceRequired(
    source,
    'return `${loanName(loan)} ${loan.team || loan.card?.player?.team || ""} ${loan.position || loan.card?.player?.position || ""} ${loan.owner_name || ""}`.toLowerCase().includes(needle);',
    'return `${loanName(loan)} ${loan.team || loan.card?.player?.team || ""} ${loan.position || loan.card?.player?.position || ""} ${lenderClubName(loan)}`.toLowerCase().includes(needle);',
    "native loan search by club",
  );

  source = replaceRequired(
    source,
    '<p className="mt-1 truncate text-[11px] font-semibold text-slate-500">{card.player?.team || "Premier League"} · {card.player?.position || "—"}</p>',
    '<p className="mt-1 truncate text-[11px] font-semibold text-slate-500">{card.player?.team || "Premier League"} · {card.player?.position || "—"}</p><p className="mt-1 truncate text-[9px] font-bold text-violet-200/80">Seller club: {sellerClubName(card)}</p>',
    "native sale listing club label",
  );
  source = replaceRequired(
    source,
    '<p className="mt-1 truncate text-[10px] text-slate-500">{card.player?.team || loan.team || "Premier League"} · {Number(loan.gameweeks || 1)} GW</p><p className="mt-1 text-[9px] font-bold text-cyan-200">{money(loanPricePerGw(loan))} / GW{mine ? " · YOUR LISTING" : ""}</p>',
    '<p className="mt-1 truncate text-[10px] text-slate-500">{card.player?.team || loan.team || "Premier League"} · {Number(loan.gameweeks || 1)} GW</p><p className="mt-1 truncate text-[9px] font-bold text-violet-200/80">Lender club: {lenderClubName(loan)}</p><p className="mt-1 text-[9px] font-bold text-cyan-200">{money(loanPricePerGw(loan))} / GW{mine ? " · YOUR LISTING" : ""}</p>',
    "native loan listing club label",
  );
  source = replaceRequired(
    source,
    '<p className="mt-1 text-xs text-slate-500">{selected.player?.team || "Premier League"} · {selected.player?.position || "—"}</p><p className="mt-2 text-lg font-black text-emerald-200">{money(selectedPrice)}</p>',
    '<p className="mt-1 text-xs text-slate-500">{selected.player?.team || "Premier League"} · {selected.player?.position || "—"}</p><p className="mt-1 text-[10px] font-bold text-violet-200">Seller club: {sellerClubName(selected)}</p><p className="mt-2 text-lg font-black text-emerald-200">{money(selectedPrice)}</p>',
    "native buy sheet seller club",
  );
  source = replaceRequired(
    source,
    '<p className="mt-1 text-xs text-slate-500">{loanCard(selectedLoan).player?.team || "Premier League"} · {loanCard(selectedLoan).player?.position || "—"}</p><p className="mt-2 text-lg font-black text-emerald-200">{money(selectedLoanTotal)} total</p>',
    '<p className="mt-1 text-xs text-slate-500">{loanCard(selectedLoan).player?.team || "Premier League"} · {loanCard(selectedLoan).player?.position || "—"}</p><p className="mt-1 text-[10px] font-bold text-violet-200">Lender club: {lenderClubName(selectedLoan)}</p><p className="mt-2 text-lg font-black text-emerald-200">{money(selectedLoanTotal)} total</p>',
    "native loan sheet lender club",
  );
  write(path, source);
}

// Desktop sale marketplace uses the same club identity returned by the API.
{
  const path = "client/src/pages/marketplace.tsx";
  let source = read(path);
  source = replaceRequired(
    source,
    'return String((card as any).ownerUsername || (card as any).ownerName || "Fantasy Arena");',
    'return String((card as any).seller_club_name || (card as any).sellerClubName || (card as any).ownerClubName || "Unnamed Club");',
    "desktop sale club resolver",
  );
  source = replaceRequired(source, '<SmallStat label="Seller" value={getOwner(card)} />', '<SmallStat label="Seller club" value={getOwner(card)} />', "desktop seller club label");
  source = replaceRequired(
    source,
    'const matchesSearch = cardMatchesSearch(search, card, fantasy.name, fantasy.team, fantasy.club, fantasy.position);',
    'const matchesSearch = cardMatchesSearch(search, card, fantasy.name, fantasy.team, fantasy.club, fantasy.position, getOwner(card));',
    "desktop sale club search",
  );
  write(path, source);
}

// Desktop loan marketplace already displayed the owner identity; make it explicit
// that this is the lender's club and show it again in the confirmation dialog.
{
  const path = "client/src/components/marketplace/LoanMarketPanel.tsx";
  let source = read(path);
  source = replaceRequired(
    source,
    'return String(loan.owner_name || loan.ownerName || "Manager");',
    'return String(loan.owner_club_name || loan.ownerClubName || loan.owner_name || loan.ownerName || "Unnamed Club");',
    "desktop lender club resolver",
  );
  source = replaceRequired(source, 'Lender: {loanOwnerName(loan)}', 'Lender club: {loanOwnerName(loan)}', "desktop lender club label");
  source = replaceRequired(
    source,
    '<p className="text-sm text-white/45">{confirmingLoan.team || "Club"} • {confirmingLoan.position || "Player"}</p>\n                  <p className="mt-2 font-black text-emerald-300">{money(loanTotal(confirmingLoan))}</p>',
    '<p className="text-sm text-white/45">{confirmingLoan.team || "Club"} • {confirmingLoan.position || "Player"}</p>\n                  <p className="mt-1 text-xs font-bold text-violet-200">Lender club: {loanOwnerName(confirmingLoan)}</p>\n                  <p className="mt-2 font-black text-emerald-300">{money(loanTotal(confirmingLoan))}</p>',
    "desktop loan confirmation club",
  );
  write(path, source);
}

const saleRoute = read("server/routes/marketplace.routes.ts");
const loanRoute = read("server/routes/loanMarket.routes.ts");
const nativeMarket = read("client/src/components/native/NativeMarketPage.tsx");
const desktopMarket = read("client/src/pages/marketplace.tsx");
const desktopLoans = read("client/src/components/marketplace/LoanMarketPanel.tsx");
const checks = [
  [saleRoute.includes("seller_club_name") && saleRoute.includes("left join app.users u on u.id = pc.owner_id"), "sale API does not expose seller club"],
  [loanRoute.includes("owner_club_name") && !loanRoute.includes("u.email, 'Manager'"), "loan API club identity/privacy update missing"],
  [nativeMarket.includes("Seller club: {sellerClubName(card)}") && nativeMarket.includes("Lender club: {lenderClubName(loan)}"), "native listing club labels missing"],
  [nativeMarket.includes("Seller club: {sellerClubName(selected)}") && nativeMarket.includes("Lender club: {lenderClubName(selectedLoan)}"), "native confirmation club labels missing"],
  [desktopMarket.includes('label="Seller club"') && desktopMarket.includes("seller_club_name"), "desktop sale club label missing"],
  [desktopLoans.includes("Lender club: {loanOwnerName(loan)}") && desktopLoans.includes("owner_club_name"), "desktop loan club label missing"],
];
const failures = checks.filter(([ok]) => !ok).map(([, message]) => message);
if (failures.length) throw new Error(`[marketplace-clubs] verification failed: ${failures.join("; ")}`);

console.log("[marketplace-clubs] Sale and loan listings now identify the seller/lender by Fantasy Arena club name on native and desktop marketplaces.");
