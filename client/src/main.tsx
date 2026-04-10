import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { patchFetchForApiBase } from "./lib/api-base";

patchFetchForApiBase();

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
					})
				)
			)
			.then(() => navigator.serviceWorker.register("/sw.js"))
			.then((registration) => registration.update())
			.then(() => {
				if ("caches" in window) {
					caches.keys().then((keys) => {
						keys
							.filter((key) => key !== "fantasy-site-v2")
							.forEach((key) => caches.delete(key));
					});
				}
			})
			.catch((error) => {
				console.error("Service worker registration failed:", error);
			});
	});
}

createRoot(document.getElementById("root")!).render(<App />);
