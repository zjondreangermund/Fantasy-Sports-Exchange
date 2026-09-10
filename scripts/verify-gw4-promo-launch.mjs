import fs from "node:fs";

function read(path) { return fs.readFileSync(path, "utf8"); }
function need(source, text, label) { if (!source.includes(text)) throw new Error(`[gw4-promo] missing ${label}`); }

const app = read("client/src/App.tsx");
const onboarding = read("client/src/pages/onboarding.tsx");
const install = read("client/src/components/InstallAppButton.tsx");
const main = read("client/src/main.tsx");
const wallet = read("client/src/pages/wallet.tsx");
const nativeWallet = read("client/src/components/native/NativeWalletPage.tsx");
const admin = read("client/src/pages/admin.tsx");
const routes = read("server/routes.ts");
const promoRoutes = read("server/routes/gw4Promo.routes.ts");
const fpl = read("server/services/fplApi.ts");
const serverIndex = read("server/index.ts");
const cardImage = read("client/src/lib/card-image.ts");
const promoPage = read("client/src/pages/gw4-free-promo.tsx");

need(app, 'Gw4FreePromoPage = React.lazy', "GW4 public landing import");
need(app, '<Route path="/gw4-free" component={Gw4FreePromoPage}', "GW4 public route");
need(app, 'GW4_PROMO_TARGET', "post-signup tournament target");
need(app, 'tournament_open_after_signup', "post-signup tournament-open tracking");
need(onboarding, 'getPostSignupTarget()', "Starter Draft campaign return");
need(onboarding, 'queryClient.setQueryData(["/api/onboarding/status"]', "immediate onboarding completion state");
need(promoPage, 'promo_click', "ad landing click tracking");
need(promoPage, 'promo_signup_click', "signup CTA tracking");
need(promoPage, 'We’ll take you straight to the tournament tab afterwards.', "campaign destination promise");

need(routes, 'registerGw4PromoRoutes(app, { requireAuth, isAdmin });', "promo route registration");
need(promoRoutes, 'marketing.auth_started', "existing/new auth-attempt attribution");
need(promoRoutes, 'marketing.signup_completed', "new-account attribution");
need(promoRoutes, 'marketing.login_completed', "returning-login separation");
need(promoRoutes, 'app_download_click', "APK download tracking");
need(promoRoutes, 'app_install_first_open', "native first-open tracking");
need(promoRoutes, 'app_install_account_linked', "installed account linking");
need(install, 'sendGw4PromoEvent("app_download_click"', "Install App download event");
need(main, 'reportNativeFirstOpen();', "native first launch reporting");
need(app, 'reportNativeAccountLinked', "native installation-to-user linking");

need(admin, '<Gw4PromoAnalyticsCard />', "campaign-specific admin analytics");
need(promoRoutes, 'Normal tournament', "campaign isolation explanation");
need(wallet, 'data-wallet-coming-soon', "desktop wallet transparency label");
need(nativeWallet, 'data-native-wallet-coming-soon', "native wallet transparency label");

need(fpl, 'premierleague25/photos/players/${dimensions}/${id}.png', "current Premier League player URL");
need(cardImage, 'premierleague25/photos/players/250x250/${match[1]}.png', "client PL card fallback URL");
need(serverIndex, 'CURRENT_PL_PLAYER_PHOTO_FALLBACKS', "proxy legacy/current PL fallback list");

if (app.includes('>Desktop view<') || app.includes('>Mobile view<') || app.includes('Switch to desktop site view')) {
  throw new Error("[gw4-promo] retired desktop/mobile product wording is still user-visible");
}

console.log("GW4 promo verified: ad-only acquisition funnel, tournament deep return, app install attribution, wallet launch transparency and current player-photo fallbacks.");
