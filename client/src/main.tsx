import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./premium-shell.css";
import "./mobile-polish.css";
import "./mobile-action-slabs.css";
import "./mobile-scroll-fix.css";
import "./prize-vault-depth.css";
import "./marketplace-rarity.css";
import { patchFetchForApiBase } from "./lib/api-base";

patchFetchForApiBase();

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element #root was not found.");
}

createRoot(rootElement).render(<App />);

if ("serviceWorker" in navigator) {
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
              .filter((key) => key !== "fantasy-site-v5")
              .forEach((key) => caches.delete(key));
          });
        }
      })
      .catch((error) => {
        console.error("Service worker registration failed:", error);
      });
  });
}
