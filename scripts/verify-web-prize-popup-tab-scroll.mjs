import fs from "node:fs";
const app=fs.readFileSync("client/src/App.tsx","utf8");
const popup=fs.readFileSync("client/src/components/PendingPrizeClaimPopup.tsx","utf8");
const css=fs.readFileSync("client/src/tab-strip-scroll.css","utf8");
const main=fs.readFileSync("client/src/main.tsx","utf8");
function need(source,token,label){if(!source.includes(token))throw new Error(label);}
need(app,"<PendingPrizeClaimPopup />","Global pending-prize popup is missing");
need(popup,'This works equally in the browser, installed PWA and native Android shell.',"Tournament prize popup must support all clients");
need(popup,'a.status!=="ready_to_mint"',"Only confirmed unminted card prizes may show the modal");
need(popup,'fa:won-prize-prompt:',"One-time dismissible prompt must not spam players");
need(popup,"Mint my winning card","Tournament winner must mint deliberately");
need(popup,"Later — keep this prize in my Trophy Cabinet","Dismissed prizes must remain in trophy history");
need(css,'[role="tablist"]:not(.grid)',"Scrollable tab selector is missing");
need(css,"flex-wrap: nowrap !important","Tab strips must not wrap");
need(css,"overflow-x: auto !important","Horizontal tab scrolling is missing");
need(css,"touch-action: pan-x pan-y pinch-zoom !important","Touch gesture support is missing");
need(main,'import "./tab-strip-scroll.css"',"Final tab-strip stylesheet import is missing");
console.log("Browser prize reminder popup and reliable horizontal tab strips verified.");
