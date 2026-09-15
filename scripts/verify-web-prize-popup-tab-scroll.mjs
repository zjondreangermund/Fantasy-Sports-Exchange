import fs from "node:fs";
const app=fs.readFileSync("client/src/App.tsx","utf8");
const popup=fs.readFileSync("client/src/components/PendingPrizeClaimPopup.tsx","utf8");
const css=fs.readFileSync("client/src/tab-strip-scroll.css","utf8");
const main=fs.readFileSync("client/src/main.tsx","utf8");
function need(source,token,label){if(!source.includes(token))throw new Error(label);}
need(app,"<PendingPrizeClaimPopup />","Global pending-prize popup is missing");
need(popup,'(display-mode: standalone)',"Installed-PWA exclusion is missing");
need(popup,"claimPending","Popup must require a pending prize claim");
need(popup,"!id(row?.prizeCardId","Already-minted cards must not trigger the popup");
need(popup,"Claim my prize card","Popup claim action is missing");
need(popup,"Not now — remind me next visit","Non-destructive dismissal is missing");
need(css,'[role="tablist"]:not(.grid)',"Scrollable tab selector is missing");
need(css,"flex-wrap: nowrap !important","Tab strips must not wrap");
need(css,"overflow-x: auto !important","Horizontal tab scrolling is missing");
need(css,"touch-action: pan-x pan-y pinch-zoom !important","Touch gesture support is missing");
need(main,'import "./tab-strip-scroll.css"',"Final tab-strip stylesheet import is missing");
console.log("Browser prize reminder popup and reliable horizontal tab strips verified.");
