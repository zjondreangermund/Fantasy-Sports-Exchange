const LEGACY_HOST = 'fantasy-sports-exchange-production-d05c.up.railway.app';

export function redirectLegacyHostname(production: boolean, method: string, hostname: string, pathname: string, userAgent = ''): boolean {
  if (!production || !['GET', 'HEAD'].includes(method) || hostname.toLowerCase() !== LEGACY_HOST) return false;
  // Installed APKs pin their WebView to the origin bundled in that version.
  // A cross-origin redirect is opened externally by Capacitor. Keep those
  // versions on their existing origin until they install the custom-domain APK.
  // This affects navigation only; it grants no authentication or API access.
  if (/(?:^|\s)FantasyArenaNative\/\d+\.\d+\.\d+(?:\s|$)/i.test(userAgent)) return false;
  // Keep API clients and OAuth callbacks compatible. Browser pages and login
  // entry points must start on the public domain, where their session is stored.
  return !pathname.startsWith('/api/') || pathname === '/api/login' || pathname === '/api/auth/google';
}
