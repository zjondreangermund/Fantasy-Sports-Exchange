import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./premium-shell.css";
import "./mobile-action-slabs.css";
import "./prize-vault-depth.css";
import "./marketplace-rarity.css";
import "./unified-scroll.css";
import "./card-image-sizing.css";
import "./onboarding-card-clipping-fix.css";
import "./legal-tabs-slider.css";
import "./native-mobile.css";
import "./push-notification-visibility.css";
import { patchFetchForApiBase } from "./lib/api-base";
import { initializeSiteView, isNativeMobileApp } from "./lib/site-view";
import { captureGw4MetaHomepageVisit } from "./lib/gw4-promo";

initializeSiteView();
patchFetchForApiBase();
captureGw4MetaHomepageVisit();

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element #root was not found.");
}

createRoot(rootElement).render(<App />);

if ("serviceWorker" in navigator) {
  if (isNativeMobileApp()) {
    // A previous desktop/PWA-style app session may have registered the web
    // worker inside Android WebView. Remove it once so the native shell uses the
    // WebView/network cache directly and does not render stale website chrome.
    navigator.serviceWorker.getRegistrations()
      .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
      .catch(() => {});
  } else {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) =>
          Promise.all(
            registrations.map((registration) => {
              const activeUrl = registration.active?.scriptURL || "";
              if (!activeUrl.endsWith("/sw.js")) {
                return registration.unregister();
              }
              return Promise.resolve(false);
            }),
          ),
        )
        .then(() => navigator.serviceWorker.register("/sw.js"))
        .then((registration) => registration.update())
        .then(() => {
          if ("caches" in window) {
            caches.keys().then((keys) => {
              keys
                .filter((key) => key !== "fantasy-site-v18-lion-jpg")
                .forEach((key) => caches.delete(key));
            });
          }
        })
        .catch((error) => {
          console.error("Service worker registration failed:", error);
        });
    });
  }
}
