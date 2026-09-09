import fs from "node:fs";

const file = "scripts/apply-common-reward-position-balance.mjs";
let source = fs.readFileSync(file, "utf8");
const marker = "DESKTOP_ONLY_INSTALL_APP_COMPAT_V1";

if (!source.includes(marker)) {
  const oldBlock = `  source = replaceRequired(\n    source,\n    '<div className="flex shrink-0 items-center gap-1.5"><button type="button" onClick={() => setSiteView(',\n    '<div className="flex shrink-0 items-center gap-1.5"><InstallAppButton /><button type="button" onClick={() => setSiteView(',\n    "authenticated Install App control",\n  );`;

  const newBlock = `  // ${marker}\n  // Browser traffic is desktop-only now, so the retired mobile/desktop toggle\n  // may already be gone by the time this idempotent build patch runs. Keep the\n  // signed-in Install App control in either layout.\n  if (!source.includes("<InstallAppButton />")) {\n    const legacyInstallAnchor = '<div className="flex shrink-0 items-center gap-1.5"><button type="button" onClick={() => setSiteView(';\n    const desktopOnlyInstallAnchor = '<div className="flex shrink-0 items-center gap-1.5"><ThemeToggle /></div>';\n    if (source.includes(legacyInstallAnchor)) {\n      source = source.replace(legacyInstallAnchor, '<div className="flex shrink-0 items-center gap-1.5"><InstallAppButton /><button type="button" onClick={() => setSiteView(');\n    } else if (source.includes(desktopOnlyInstallAnchor)) {\n      source = source.replace(desktopOnlyInstallAnchor, '<div className="flex shrink-0 items-center gap-1.5"><InstallAppButton /><ThemeToggle /></div>');\n    } else {\n      throw new Error("Common reward position-balance anchor not found: authenticated Install App control");\n    }\n  }`;

  if (!source.includes(oldBlock)) throw new Error("[desktop-only-install-app] legacy Install App patch block not found");
  source = source.replace(oldBlock, newBlock);
  fs.writeFileSync(file, source);
  console.log("[desktop-only-install-app] Install App patch now supports the desktop-only website header.");
} else {
  console.log("[desktop-only-install-app] compatibility already applied.");
}
