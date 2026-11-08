import { sendJson } from '../_lib/http.js';
import { clearSessionCookie } from '../_lib/bwSession.js';

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return sendJson(response, 405, { ok: false, error: 'method_not_allowed' });
  }
  response.setHeader('Set-Cookie', clearSessionCookie());
  return sendJson(response, 200, { ok: true });
}
