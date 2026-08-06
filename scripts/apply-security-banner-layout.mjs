import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const write = (file, content) => fs.writeFileSync(path.join(root, file), content);

function replaceOnce(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`Security banner layout patch anchor not found: ${label}`);
  return source.replace(from, to);
}

// Measure the production/read-only banner and expose its real height to the app shell.
{
  const file = "client/src/components/SecurityModeBanner.tsx";
  let source = read(file);

  source = replaceOnce(
    source,
    'import { useEffect, useState } from "react";',
    'import { useEffect, useRef, useState } from "react";',
    "SecurityModeBanner React imports",
  );

  source = replaceOnce(
    source,
    '  const [status, setStatus] = useState<PublicSecurityStatus | null>(null);',
    '  const [status, setStatus] = useState<PublicSecurityStatus | null>(null);\n  const bannerRef = useRef<HTMLElement | null>(null);',
    "SecurityModeBanner ref",
  );

  const statusGuard = '  if (!status?.readOnly) return null;';
  const measuredOffsetEffect = `  useEffect(() => {
    const rootElement = document.documentElement;

    if (!status?.readOnly) {
      rootElement.style.setProperty("--security-banner-offset", "0px");
      rootElement.removeAttribute("data-security-banner-visible");
      return;
    }

    const banner = bannerRef.current;
    if (!banner) return;

    const updateOffset = () => {
      const rect = banner.getBoundingClientRect();
      const offset = Math.max(0, Math.ceil(rect.bottom + 8));
      rootElement.style.setProperty("--security-banner-offset", \`${"${offset}"}px\`);
      rootElement.setAttribute("data-security-banner-visible", "true");
    };

    updateOffset();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateOffset) : null;
    observer?.observe(banner);
    window.addEventListener("resize", updateOffset);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateOffset);
      rootElement.style.setProperty("--security-banner-offset", "0px");
      rootElement.removeAttribute("data-security-banner-visible");
    };
  }, [status?.readOnly]);

${statusGuard}`;

  source = replaceOnce(source, statusGuard, measuredOffsetEffect, "SecurityModeBanner measured offset effect");
  source = replaceOnce(
    source,
    '    <aside\n      className="pointer-events-none fixed inset-x-2 top-2 z-[160]',
    '    <aside\n      ref={bannerRef}\n      className="pointer-events-none fixed inset-x-2 top-2 z-[160]',
    "SecurityModeBanner ref attachment",
  );

  write(file, source);
}

// Keep the main header and page chrome below the fixed production message.
{
  const file = "client/src/App.tsx";
  let source = read(file);
  const original = '        <div className={`app-content relative isolate flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden ${isPlayRoute ? "play-route-content" : ""}`}>'.trim();
  const replacement = `        <div
          className={\`app-content relative isolate box-border flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden \${isPlayRoute ? "play-route-content" : ""}\`}
          style={{ paddingTop: "var(--security-banner-offset, 0px)" }}
        >`.trim();
  source = replaceOnce(source, original, replacement, "App content security offset");
  write(file, source);
}

// Move both desktop and mobile sidebars below the banner. The mobile sidebar is
// rendered through a portal, so it must consume the root CSS variable directly.
{
  const file = "client/src/components/ui/sidebar.tsx";
  let source = read(file);

  source = replaceOnce(
    source,
    `function Sidebar({
  side = "left",
  variant = "sidebar",
  collapsible = "offcanvas",
  className,
  children,
  ...props`,
    `function Sidebar({
  side = "left",
  variant = "sidebar",
  collapsible = "offcanvas",
  className,
  children,
  style,
  ...props`,
    "Sidebar style prop",
  );

  source = replaceOnce(
    source,
    `          style={
            {
              "--sidebar-width": SIDEBAR_WIDTH_MOBILE,
            } as React.CSSProperties
          }`,
    `          style={
            {
              "--sidebar-width": SIDEBAR_WIDTH_MOBILE,
              top: "var(--security-banner-offset, 0px)",
              bottom: "auto",
              height: "calc(100dvh - var(--security-banner-offset, 0px))",
              ...style,
            } as React.CSSProperties
          }`,
    "Mobile sidebar security offset",
  );

  source = replaceOnce(
    source,
    '          "fixed inset-y-0 z-10 hidden h-svh w-[var(--sidebar-width)] transition-[left,right,width] duration-200 ease-linear md:flex",',
    '          "fixed z-10 hidden w-[var(--sidebar-width)] transition-[left,right,width] duration-200 ease-linear md:flex",',
    "Desktop sidebar fixed geometry",
  );

  source = replaceOnce(
    source,
    `          className
        )}
        {...props}
      >`,
    `          className
        )}
        style={{
          top: "var(--security-banner-offset, 0px)",
          bottom: "auto",
          height: "calc(100dvh - var(--security-banner-offset, 0px))",
          ...style,
        }}
        {...props}
      >`,
    "Desktop sidebar security offset",
  );

  write(file, source);
}

console.log("[layout] Applied production-banner offsets to app header and sidebars");
