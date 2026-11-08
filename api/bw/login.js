import { readJsonBody, sendJson, publicErrorMessage } from '../_lib/http.js';
import { signSession, serializeSessionCookie, makeSession, parseTtl } from '../_lib/bwSession.js';

const EXPECTED = process.env.BW_PASSWORD;
if (!EXPECTED) console.warn('[bw] BW_PASSWORD non impostato: login sempre fallisce');

const TTL = parseTtl(process.env.BW_SESSION_TTL);

// brute-force: 5 tentativi per IP ogni 15 min (in-memory, reset a ogni deploy)
const ATTEMPTS = new Map();
function checkRate(ip) {
  if (!ip) return true;
  const now = Date.now();
  const win = ATTEMPTS.get(ip) || { count: 0, since: now };
  if (now - win.since > 15 * 60 * 1000) { win.count = 0; win.since = now; }
  win.count++;
  ATTEMPTS.set(ip, win);
  return win.count <= 5;
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return sendJson(response, 405, { ok: false, error: 'method_not_allowed' });
  }
  try {
    const { password } = await readJsonBody(request);
    const ip = request.headers['x-real-ip'] || request.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
    if (!checkRate(ip)) {
      return sendJson(response, 429, { ok: false, error: 'too_many_attempts', retryAfter: 900 });
    }
    if (!EXPECTED || password !== EXPECTED) {
      return sendJson(response, 401, { ok: false, error: 'invalid_password' });
    }
    const session = makeSession(TTL);
    const token = signSession(session);
    response.setHeader('Set-Cookie', serializeSessionCookie(token));
    return sendJson(response, 200, { ok: true, expiresAt: session.exp });
  } catch (err) {
    const status = err.statusCode || 500;
    return sendJson(response, status, { ok: false, error: publicErrorMessage(err, 'server_error') });
  }
}
