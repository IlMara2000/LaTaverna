import { createHmac, timingSafeEqual } from 'node:crypto';

const DEFAULT_TTL = 7 * 24 * 60 * 60;

export function parseTtl(v) {
  const m = String(v || '').match(/^(\d+)([smhd])$/i);
  if (!m) return DEFAULT_TTL;
  const n = parseInt(m[1], 10);
  const u = m[2].toLowerCase();
  const mul = { s: 1, m: 60, h: 3600, d: 86400 }[u];
  const ttl = n * mul;
  if (ttl < 60) return 60;
  if (ttl > 90 * 86400) return 90 * 86400;
  return ttl;
}

function secret() {
  const s = process.env.BW_SECRET || process.env.BW_PASSWORD;
  if (!s) throw Object.assign(new Error('bw_secret_not_configured'), { statusCode: 503 });
  return s;
}

export function signSession(payload) {
  const data = JSON.stringify(payload);
  const sig = createHmac('sha256', secret()).update(data).digest('hex');
  return Buffer.from(JSON.stringify({ data, sig })).toString('base64url');
}

export function verifySession(token) {
  if (!token) return null;
  try {
    const raw = Buffer.from(token, 'base64url').toString('utf8');
    const { data, sig } = JSON.parse(raw);
    const expected = createHmac('sha256', secret()).update(data).digest('hex');
    const got = Buffer.from(sig, 'hex');
    const exp = Buffer.from(expected, 'hex');
    if (got.length !== exp.length || !timingSafeEqual(got, exp)) return null;
    const obj = JSON.parse(data);
    if (!obj || typeof obj !== 'object') return null;
    if (obj.exp && Date.now() > obj.exp) return null;
    return obj;
  } catch { return null; }
}

export function serializeSessionCookie(token) {
  const isProd = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
  const parts = [`bw_session=${token}`, 'Path=/bw', 'HttpOnly', 'SameSite=Lax', 'Max-Age=2592000'];
  if (isProd) parts.push('Secure');
  return parts.join('; ');
}

export function clearSessionCookie() {
  return 'bw_session=; Path=/bw; HttpOnly; SameSite=Lax; Max-Age=0';
}

export function parseCookie(header) {
  if (!header) return {};
  const out = {};
  for (const pair of header.split(';')) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    const k = pair.slice(0, idx).trim();
    const v = pair.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

export async function requireBwSession(request) {
  const cookies = parseCookie(request.headers.cookie);
  const token = cookies.bw_session;
  const session = verifySession(token);
  if (!session) return null;
  return session;
}

export function makeSession(ttl) {
  const now = Date.now();
  return { sub: 'bw-user', iat: now, exp: now + ttl * 1000 };
}
