import fs from "node:fs";

const admin = fs.readFileSync("client/src/pages/admin.tsx", "utf8");
const liveData = fs.readFileSync("client/src/pages/admin-live-data.tsx", "utf8");
const prizeVault = fs.readFileSync("client/src/pages/prize-vault.tsx", "utf8");
const playerProfile = fs.readFileSync("client/src/components/cards/CardProfileModal.tsx", "utf8");
const tournaments = fs.readFileSync("client/src/pages/competitions-vault.tsx", "utf8");
const dialog = fs.readFileSync("client/src/components/ui/dialog.tsx", "utf8");

function requireText(source, expected, message) {
  if (!source.includes(expected)) throw new Error(message);
}

requireText(dialog, "<DialogPortal>", "All shared popups must render in a viewport-level portal.");
requireText(dialog, "<DialogOverlay />", "All shared popups must provide a dismissible background.");
requireText(dialog, "fixed left-1/2 top-1/2", "Shared popups must remain centered in the viewport.");

requireText(admin, "setUserDialogOpen(true)", "Selecting an Admin user must open their profile immediately.");
requireText(admin, "<Dialog open={userDialogOpen && Boolean(selectedUserId)}", "Admin user details must be shown inside a popup.");
requireText(admin, "<Dialog open={cardDialogOpen}", "Admin card ownership details must be shown inside a popup.");
requireText(admin, "<Dialog open={Boolean(workspacePanel)}", "Admin management tools must open inside popup workspaces.");
requireText(admin, "function WorkspaceLauncher(", "Admin Finance and Ops must use compact workspace launchers.");
requireText(admin, 'workspacePanel === "backoffice" ? <AdminBackofficePanel />', "Backoffice controls must remain available in their popup.");
requireText(admin, 'workspacePanel === "integrity" ? <AdminIntegrityPanel />', "Integrity controls must remain available in their popup.");
requireText(admin, 'max-h-[min(40dvh,26rem)]', "Admin user lists must remain bounded instead of lengthening the page.");

requireText(liveData, "<Dialog open={Boolean(selectedFixtureId)}", "Selected fixtures must open in a popup instead of below the page.");
requireText(liveData, "setSelectedFixtureId(null)", "Fixture popups must close cleanly.");
requireText(liveData, "<Dialog open={open} onOpenChange={setOpen}>", "Selected fixture players must open their scoring details in a popup.");
if (liveData.includes("{selectedFixtureId && <Card")) throw new Error("Fixture details must not append a card at the bottom of Admin Live Data.");

requireText(prizeVault, "<Dialog open={Boolean(selectedId && selected)}", "Prize Vault selections must open a centered detail popup.");
requireText(prizeVault, 'if (!open) setSelectedId("")', "Prize detail popups must close by clicking the background.");
const prizeDialogOffset = prizeVault.indexOf("<Dialog open={Boolean(selectedId && selected)}");
const prizeSpotlightOffset = prizeVault.indexOf("<Spotlight item={selected} />");
if (prizeSpotlightOffset < prizeDialogOffset) throw new Error("Prize details must not be rendered below the full prize ladder.");

requireText(playerProfile, 'if (event.target === event.currentTarget) onClose()', "Player profiles must close when the background is clicked.");
requireText(playerProfile, 'event.key === "Escape"', "Player profiles must close when Escape is pressed.");
requireText(playerProfile, 'profileView === "matches"', "Player match logs must be accessible without scrolling down the page.");
requireText(playerProfile, 'profileView === "season"', "Player season stats must be accessible without scrolling down the page.");
requireText(playerProfile, "max-h-[92dvh]", "Player profiles must fit inside the visible viewport.");

requireText(tournaments, "<Dialog open={Boolean(expandedPlayer)}", "Tournament player scoring must open in its own popup.");
requireText(tournaments, "How points were earned", "Tournament player scoring popups must preserve exact scoring actions.");

console.log("Centered popup workspaces verified: Admin users/cards/operations, Prize Vault details, fixture/player scores and compact player profiles.");
