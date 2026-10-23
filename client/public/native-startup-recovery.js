/* Capacitor Android boot recovery. External file to honor strict script-src 'self' CSP. */
(function () {
        // Only the installed Capacitor Android shell uses this fallback.
        if (!(navigator.userAgent || "").includes("FantasyArenaNative/")) return;
        var root = document.getElementById("root");
        var recovery = document.getElementById("native-startup-recovery");
        var retry = document.getElementById("native-startup-retry");
        if (!root || !recovery || !retry) return;
        // Watch both initial boot and later app crashes that unmount React.
        // Do not interrupt normal route changes while the React root is present.
        var pendingCheck = 0;
        function hasApp() { return root.children.length > 0 || Boolean(root.textContent.trim()); }
        function checkBoot() {
          if (hasApp()) {
            recovery.hidden = true;
            if (pendingCheck) window.clearTimeout(pendingCheck);
            pendingCheck = 0;
            return;
          }
          if (pendingCheck) window.clearTimeout(pendingCheck);
          pendingCheck = window.setTimeout(function () {
            if (!hasApp()) recovery.hidden = false;
          }, 12000);
        }
        var observer = new MutationObserver(checkBoot);
        observer.observe(root, { childList: true, subtree: false });
        checkBoot();
        // Any stale service-worker cache is removed only if the user chooses Retry;
        // no automatic reload loops and no clearing login or local storage.
        retry.addEventListener("click", async function () {
          retry.disabled = true;
          retry.textContent = "Reloading…";
          try {
            if ("serviceWorker" in navigator) {
              var registrations = await navigator.serviceWorker.getRegistrations();
              await Promise.all(registrations.map(function (item) { return item.unregister(); }));
            }
            if ("caches" in window) {
              var keys = await caches.keys();
              await Promise.all(keys.map(function (key) { return caches.delete(key); }));
            }
          } catch (error) { /* Continue the reload if cache cleanup is unavailable. */ }
          var url = new URL(window.location.href);
          url.searchParams.set("nativeReload", String(Date.now()));
          window.location.replace(url.toString());
        });
      })();
