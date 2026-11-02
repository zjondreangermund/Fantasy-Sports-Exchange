# Foreground popups and simpler Game Rules

All shared Dialog, AlertDialog, Sheet and Drawer content and their dropdown/help surfaces register when their real DOM nodes mount. The stack assigns each newly opened surface a layer above the active parent, including captain prompts with an explicit minimum layer. Closing a surface releases its layer. This also handles Select/Popover positioning wrappers without relying on per-page z-index guesses.

Existing custom native/web overlays use `PopupPortal` to render under `document.body`, outside transformed, clipped or isolated app/page containers. Radix FocusScope and DismissableLayer let child overlays receive focus and clicks without accidentally closing the parent; the support chat yields its manual keyboard handler to a foreground child. Guided-help introduction cards hide while a popup is open.

Covered custom surfaces include community/help, install and push prompts, card profiles/intelligence, lineup editing, native entry/leaderboard/trade/market/update/more panels, collection selling and onboarding pack inspection. Existing automatic welcome, reward, mint, replacement and prize dialogs inherit the shared dialog fix. Welcome-message copy, trigger conditions and read behavior remain unchanged.

Only the Game Rules document is rewritten in plain language. Its Deadlines section is unchanged word for word. Card eligibility, rarity requirements, scoring, ranking, prizes and delivery conditions are preserved; the outdated goalkeeper Utility claim and submit-immediately-final wording are aligned with the existing server rules. Other legal documents are unchanged.

`npm run test:popups` covers opening order, nested controls, explicit captain layers, focus handoff, 500 close/reopen cycles and a source-tree audit of custom modal portals. CI runs it after build preparation. Browser validation uses the real shared popup and SignupWelcomePopup components against mocked notification/auth data, with a transformed, clipped page and a high-layer header; it does not send production notifications or claim to exercise every authenticated device workflow.
