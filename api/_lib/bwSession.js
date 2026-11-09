import { createHmac, timingSafeEqual } from 'node:crypto';

const SECRET = process.env.BW_SECRET;
if (!SECRET) console.warn('[bw] BW_SECRET non impostato: sessioni non firmate');
const COOKIE_NAME = 'bw_session';

// Parse "7d" "12h" "45m" "90s" -> ms (clamp 60s..90d, default 7d)
export function parseTtl(str) {
  if (!str) return 7 * 24 * 60 * 60 * 1000;
  const m = String(str).trim().match(/^(\d+(?:\.\d+)?)\s*([dhms])?$/i);
  if (!m) return 7 * 24 * 60 * 60 * 1000;
  const val = parseFloat(m[1]);
  const unit = (m[2] || 'd').toLowerCase();
  const mult = { d: 24 * 60 * 60 * 1000, h: 60 * 60 * 1000, m: 60 * 1000, s: 1000 }[unit];
  let ms = Math.round(val * mult);
  const MIN = 60 * 1000;
  const MAX = 90 * 24 * 60 * 60 * 1000;
  if (ms < MIN) ms = MIN;
  if (ms > MAX) ms = MAX;
  return ms;
}

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
function b64urlDecode(str) {
  const pad = str.length % 4;
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad === 2 ? 2 : pad === 3 ? 1 : 0);
  return Buffer.from(b64, 'base64');
}

function sign(payload) {
  if (!SECRET) throw Object.assign(new Error('BW_SECRET missing'), { statusCode: 500 });
  const hmac = createHmac('sha256', SECRET).update(payload).digest();
  return b64url(hmac);
}

export function signSession(session) {
  const payload = b64url(JSON.stringify(session));
  const sig = sign(payload);
  return `${payload}.${sig}`;
}

export function verifySession(token) {
  if (!token || !SECRET) return null;
  const [payloadB64, sig] = token.split('.');
  if (!payloadB64 || !sig) return null;
  const expected = sign(payloadB64);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  let session;
  try { session = JSON.parse(b64urlDecode(payloadB64).toString()); } catch { return null; }
  if (!session || typeof session.exp !== 'number') return null;
  if (Date.now() > session.exp) return null;
  return session;
}

export function serializeSessionCookie(token, maxAgeSec) {
  return `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAgeSec}`;
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

export function parseCookie(header, name) {
  if (!header) return null;
  const cookies = header.split(';').map(c => c.trim());
  for (const c of cookies) {
    const [k, ...v] = c.split('=');
    if (k === name) return v.join('=');
  }
  return null;
}

export async function requireBwSession(request) {
  const cookie = request.headers.cookie || request.headers.Cookie || '';
  const token = parseCookie(cookie, COOKIE_NAME);
  return verifySession(token);
}

export function makeSession(ttlMs) {
  const now = Date.now();
  return { iat: now, exp: now + ttlMs };
}
