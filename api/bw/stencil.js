import { readJsonBody, sendJson, publicErrorMessage, isSameOriginRequest, crossOriginForbidden } from '../_lib/http.js';
import { assertAiIpBudget } from '../_lib/ipBudget.js';
import { requireBwSession } from '../_lib/bwSession.js';
import { callStencilProvider } from '../_lib/stencil.js';

const MAX_BYTES = 6 * 1024 * 1024; // 6 MB

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return sendJson(response, 405, { ok: false, error: 'method_not_allowed' });
  }
  if (!isSameOriginRequest(request)) return crossOriginForbidden(response);

  try {
    const session = await requireBwSession(request);
    if (!session) return sendJson(response, 401, { ok: false, error: 'unauthenticated' });

    // Quota IP (riusa oracleAccess pattern)
    await assertAiIpBudget(request);

    const { imageBase64, mimeType } = await readJsonBody(request, MAX_BYTES);
    if (!imageBase64 || !mimeType) {
      return sendJson(response, 400, { ok: false, error: 'missing_fields' });
    }
    if (!/^image\/(jpeg|png|webp)$/i.test(mimeType)) {
      return sendJson(response, 400, { ok: false, error: 'invalid_mime_type' });
    }
    if (imageBase64.length * 0.75 > MAX_BYTES) { // base64 ~33% overhead
      return sendJson(response, 413, { ok: false, error: 'payload_too_large' });
    }

    const png = await callStencilProvider(imageBase64, mimeType);

    response.setHeader('Content-Type', 'image/png');
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('Content-Length', png.length);
    return response.send(png);
  } catch (err) {
    const status = err.statusCode || 500;
    // Per errori provider, restituiamo JSON per coerenza UI
    if (err.code === 'no_ai_provider' || err.code === 'provider_error' || err.code === 'generation_timeout') {
      return sendJson(response, status, { ok: false, error: err.code, message: err.message });
    }
    return sendJson(response, status, { ok: false, error: publicErrorMessage(err, 'server_error') });
  }
}
