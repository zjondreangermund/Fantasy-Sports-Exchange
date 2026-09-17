import fs from "node:fs";

const PATH = "client/src/components/native/NativeMobileShell.tsx";
const MARKER = "NATIVE_ADMIN_SAFE_LOGOUT_V1";

function required(source, needle, label) {
  if (!source.includes(needle)) throw new Error(`[native-admin-safe-logout] missing ${label}`);
}

function replaceRequired(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`[native-admin-safe-logout] anchor not found: ${label}`);
  return source.replace(from, to);
}

let source = fs.readFileSync(PATH, "utf8");
if (!source.includes(MARKER)) {
  required(source, "NATIVE_LOGOUT_SIGNUP_POLISH_V1", "native logout base patch");

  source = replaceRequired(
    source,
    'import { Link, useLocation } from "wouter";\n',
    'import { Link, useLocation } from "wouter";\nimport { useQuery } from "@tanstack/react-query";\n',
    "admin access query import",
  );

  source = replaceRequired(
    source,
    '  ShieldQuestion,\n',
    '  Shield,\n  ShieldQuestion,\n',
    "admin shield icon",
  );

  source = replaceRequired(
    source,
    'const moreItems: Array<NavItem & { description: string }> = [\n',
    `// ${MARKER}: the native app exposes the full existing Admin Command Center only\n// after the server confirms the signed-in account is an authorised administrator.\nconst moreItems: Array<NavItem & { description: string }> = [\n`,
    "feature marker",
  );

  source = replaceRequired(
    source,
    '];\n\nfunction isActive(location: string, href: string) {',
    `];\n\nconst nativeAdminItem: NavItem & { description: string } = {\n  label: "Admin",\n  href: "/admin",\n  icon: Shield,\n  description: "Full private command center",\n};\n\nfunction isActive(location: string, href: string) {`,
    "admin menu item",
  );

  source = replaceRequired(
    source,
    '  if (location.startsWith("/help") || location.startsWith("/faq")) return "Help";\n  return "Fantasy Arena";',
    '  if (location.startsWith("/help") || location.startsWith("/faq")) return "Help";\n  if (location.startsWith("/admin")) return "Admin Command";\n  return "Fantasy Arena";',
    "admin route title",
  );

  source = replaceRequired(
    source,
    '  if (location.startsWith("/account") || location.startsWith("/profile")) return "PROFILE • INBOX • REFER";\n  return "FANTASY ARENA";',
    '  if (location.startsWith("/account") || location.startsWith("/profile")) return "PROFILE • INBOX • REFER";\n  if (location.startsWith("/admin")) return "PRIVATE • USERS • FINANCE • OPS";\n  return "FANTASY ARENA";',
    "admin route subtitle",
  );

  source = replaceRequired(
    source,
    '  if (location.startsWith("/account") || location.startsWith("/profile")) return "club";\n  return "info";',
    '  if (location.startsWith("/account") || location.startsWith("/profile")) return "club";\n  if (location.startsWith("/admin")) return "admin";\n  return "info";',
    "admin route key",
  );

  source = replaceRequired(
    source,
    '  const [moreOpen, setMoreOpen] = React.useState(false);\n',
    '  const [moreOpen, setMoreOpen] = React.useState(false);\n  const [logoutReady, setLogoutReady] = React.useState(false);\n',
    "logout arm state",
  );

  source = replaceRequired(
    source,
    '  const currentRoute = routeKey(location);\n\n  React.useEffect(() => {',
    `  const currentRoute = routeKey(location);\n  const { data: adminAccess } = useQuery<{ isAdmin: boolean }>({\n    queryKey: ["/api/admin/check"],\n    retry: false,\n    staleTime: 60_000,\n  });\n  const menuItems = adminAccess?.isAdmin ? [...moreItems, nativeAdminItem] : moreItems;\n\n  React.useEffect(() => {`,
    "admin access query",
  );

  source = replaceRequired(
    source,
    '  React.useEffect(() => {\n    setMoreOpen(false);\n  }, [location]);\n\n  return (',
    `  React.useEffect(() => {\n    setMoreOpen(false);\n  }, [location]);\n\n  React.useEffect(() => {\n    if (!moreOpen) {\n      setLogoutReady(false);\n      return;\n    }\n    // Do not arm Sign out under the finger that just double-tapped More.\n    const timer = window.setTimeout(() => setLogoutReady(true), 700);\n    return () => window.clearTimeout(timer);\n  }, [moreOpen]);\n\n  return (`,
    "safe logout arming delay",
  );

  source = replaceRequired(
    source,
    '{moreItems.map((item, index) => {',
    '{menuItems.map((item, index) => {',
    "admin-aware More menu",
  );
  source = replaceRequired(
    source,
    'const wide = index === moreItems.length - 1;',
    'const wide = index === menuItems.length - 1;',
    "admin-aware wide menu tile",
  );
  source = replaceRequired(
    source,
    '                    key={item.href}\n                    href={item.href}\n                    className={`arena-menu-tile',
    '                    key={item.href}\n                    href={item.href}\n                    data-native-admin-entry={item.href === "/admin" ? "true" : undefined}\n                    className={`arena-menu-tile',
    "admin tile marker",
  );

  const logoutPattern = /            <button\n              type="button"\n              data-testid="native-logout-button"[\s\S]*?            <\/button>/;
  if (!logoutPattern.test(source)) throw new Error("[native-admin-safe-logout] existing native logout block not found");
  source = source.replace(logoutPattern, `            <div className="mt-4 flex items-center justify-end border-t border-white/[.06] pt-3">\n              <button\n                type="button"\n                data-testid="native-logout-button"\n                onClick={() => { if (window.confirm("Sign out of Fantasy Arena?")) logout(); }}\n                disabled={!logoutReady || isLoggingOut}\n                className="inline-flex h-8 w-auto items-center gap-1.5 rounded-xl border border-red-300/15 bg-red-400/[.045] px-2.5 text-[10px] font-black text-red-100/75 transition active:scale-[.98] disabled:pointer-events-none disabled:opacity-35"\n                aria-label="Sign out of Fantasy Arena"\n                title={logoutReady ? "Sign out" : "Sign out becomes available after the menu opens"}\n              >\n                <LogOut className="h-3.5 w-3.5" />\n                <span>{isLoggingOut ? "Signing out…" : "Sign out"}</span>\n              </button>\n            </div>`);

  fs.writeFileSync(PATH, source);
}

const finalSource = fs.readFileSync(PATH, "utf8");
for (const [needle, label] of [
  [MARKER, "feature marker"],
  ['queryKey: ["/api/admin/check"]', "server-backed admin visibility check"],
  ['data-native-admin-entry={item.href === "/admin" ? "true" : undefined}', "admin-only menu tile"],
  ['href: "/admin"', "full Admin Command Center route"],
  ['const [logoutReady, setLogoutReady] = React.useState(false);', "safe logout arm state"],
  ['window.setTimeout(() => setLogoutReady(true), 700)', "double-tap logout guard"],
  ['window.confirm("Sign out of Fantasy Arena?")', "logout confirmation"],
  ['className="inline-flex h-8 w-auto', "compact sign-out button"],
]) required(finalSource, needle, label);

console.log("Native Admin and safer sign-out verified: Admin appears only after /api/admin/check, the full existing admin route is reused, and Sign out is compact, delayed and confirmed.");
