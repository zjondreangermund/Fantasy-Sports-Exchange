const LEGACY_HOST = 'fantasy-sports-exchange-production-d05c.up.railway.app';

export function redirectLegacyHostname(production: boolean, method: string, hostname: string, pathname: string): boolean {
  if (!production || !['GET', 'HEAD'].includes(method) || hostname.toLowerCase() !== LEGACY_HOST) return false;
  // Keep API clients and OAuth callbacks compatible. Browser pages and login
  // entry points must start on the public domain, where their session is stored.
  return !pathname.startsWith('/api/') || pathname === '/api/login' || pathname === '/api/auth/google';
}
