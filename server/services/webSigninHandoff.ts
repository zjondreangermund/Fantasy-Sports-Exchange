export function webSigninHandoffPage(origin: string, ticket: string, nonce: string) {
  const target = new URL('/api/auth/web/complete', origin);
  if (target.protocol !== 'https:' || !/^[A-Za-z0-9_-]{40,80}$/.test(ticket) || !/^[A-Za-z0-9+/=]{20,80}$/.test(nonce)) throw new Error('Invalid sign-in handoff');
  const action = target.href;
  return {
    // Preserve the callback origin on cross-site POSTs without exposing the
    // OAuth callback path or query. no-referrer makes form POST Origin null.
    referrerPolicy: 'strict-origin',
    csp: `default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action ${target.origin}; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'`,
    html: `<!doctype html><html><head><meta name="referrer" content="strict-origin"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Returning to Fantasy Arena</title></head><body style="background:#02040d;color:white;font:16px system-ui;padding:32px"><p>Returning to Fantasy Arena…</p><form id="handoff" method="post" action="${action}"><input type="hidden" name="ticket" value="${ticket}"><button type="submit">Continue to Fantasy Arena</button></form><script nonce="${nonce}">document.getElementById('handoff').submit();</script></body></html>`,
  };
}

export function allowedWebSigninOrigin(origin: string, callbackUrl: string, appUrl: string, requestOrigin: string) {
  try {
    const callback = new URL(callbackUrl);
    const app = new URL(appUrl);
    return callback.protocol === 'https:' && app.protocol === 'https:' && callback.pathname === '/api/auth/google/callback'
      && origin === callback.origin && requestOrigin === app.origin;
  } catch { return false; }
}
