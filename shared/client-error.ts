export type ClientErrorDetails = {
  source: 'runtime' | 'unhandledrejection' | 'resource';
  name: string;
  message: string;
  file: string;
  line: number;
  column: number;
  frames: string[];
};

// Never serialize arbitrary rejection objects, request bodies or browser state.
function text(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/https?:\/\/[^\s)]+/gi, '[link]')
    .replace(/\b(?:Bearer\s+)[^\s,;]+/gi, 'Bearer [redacted]')
    .replace(/\b(password|token|secret|authorization|cookie|api[_-]?key)\b["']?\s*[=:]\s*(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi, '$1=[redacted]')
    .replace(/\/[\w/.-]+\?[^\s)]+/g, '[path parameters omitted]')
    .replace(/\b[^\s@]+@[^\s@]+\.[^\s@]+\b/g, '[email]')
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, '[redacted]')
    .replace(/[\x00-\x1f]/g, ' ').slice(0, max);
}

function file(value: unknown): string {
  if (typeof value !== 'string') return '';
  try {
    const url = new URL(value, 'https://playfantasyarena.com');
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    // Retain code locations only, never user/account routes or URL parameters.
    if (!/\.(?:js|mjs|cjs|tsx?|jsx)$/i.test(url.pathname)) return '';
    return text(url.pathname, 240);
  } catch { return ''; }
}

const coordinate = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? Math.min(value, 10_000_000) : 0;

export function sanitizeClientError(value: unknown): ClientErrorDetails | null {
  if (!value || typeof value !== 'object') return null;
  const input = value as Partial<ClientErrorDetails>;
  if (!['runtime', 'unhandledrejection', 'resource'].includes(String(input.source))) return null;
  return {
    source: input.source!, name: text(input.name, 80), message: text(input.message, 400),
    file: file(input.file), line: coordinate(input.line), column: coordinate(input.column),
    frames: Array.isArray(input.frames) ? input.frames.slice(0, 8).filter((frame): frame is string => typeof frame === 'string')
      .map(frame => {
        const match = frame.match(/^(.*):(\d+):(\d+)$/);
        if (!match) return '';
        const path = file(match[1]);
        return path ? `${path}:${coordinate(Number(match[2]))}:${coordinate(Number(match[3]))}` : '';
      }).filter(Boolean) : [],
  };
}

export function describeClientError(source: ClientErrorDetails['source'], reason: unknown, location: {file?: string; line?: number; column?: number} = {}): ClientErrorDetails {
  let name = '', message = '', stack = '';
  // Accessors on third-party rejection objects can themselves throw.
  try {
    if (reason instanceof Error) { name = reason.name; message = reason.message; stack = reason.stack || ''; }
    else if (typeof reason === 'string') message = reason;
    else message = 'Non-Error rejection (payload omitted)';
  } catch { message = 'Error details unavailable'; }
  const frames = stack.split('\n').slice(1, 20).map(line => {
    const match = line.match(/(?:\(|@|\s)((?:https?:\/\/|\/)[^\s)]+:\d+:\d+)\)?$/);
    return match?.[1] || '';
  }).filter(Boolean);
  return sanitizeClientError({ source, name, message, file: location.file || '', line: location.line || 0, column: location.column || 0, frames })!;
}
