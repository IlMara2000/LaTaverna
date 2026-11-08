import { sendJson, publicErrorMessage, readJsonBody } from '../_lib/http.js';
import { requireBwSession, makeSession, signSession, serializeSessionCookie, parseTtl } from '../_lib/bwSession.js';

const TTL = parseTtl(process.env.BW_SESSION_TTL);
const WARN_MS = 5 * 60 * 1000; // 5 min prima della scadenza

export default async function handler(request, response) {
  try {
    if (request.method === 'GET') {
      const session = await requireBwSession(request);
      if (!session) return sendJson(response, 200, { ok: false, authenticated: false });
      const now = Date.now();
      const remaining = session.exp - now;
      return sendJson(response, 200, {
        ok: true,
        authenticated: true,
        expiresAt: session.exp,
        remainingMs: remaining,
        warning: remaining > 0 && remaining <= WARN_MS
      });
    }
    if (request.method === 'POST') {
      const session = await requireBwSession(request);
      if (!session) return sendJson(response, 401, { ok: false, error: 'unauthenticated' });
      const newSession = makeSession(TTL);
      const token = signSession(newSession);
      response.setHeader('Set-Cookie', serializeSessionCookie(token));
      return sendJson(response, 200, { ok: true, expiresAt: newSession.exp });
    }
    response.setHeader('Allow', 'GET, POST');
    return sendJson(response, 405, { ok: false, error: 'method_not_allowed' });
  } catch (err) {
    const status = err.statusCode || 500;
    return sendJson(response, status, { ok: false, error: publicErrorMessage(err, 'server_error') });
  }
}
