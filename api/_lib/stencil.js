// Prompt stencil fisso (inglese) + adattatore provider (ImagineArt o FreeLLMAPI vision).
// Restituisce buffer PNG o lancia errore 503 se nessun provider.

export const STENCIL_PROMPT =
  'Convert the provided photo into a clean, high-contrast black-and-white stencil illustration. '
  'Preserve the exact identity and distinguishing features of the subject. '
  'Output must be pure black lines and solid black shapes on a transparent background, '
  'with zero gray tones, zero color, and zero noise. '
  'Lines should be crisp, vector-like, and suitable for cutting as a physical stencil. '
  'No artistic interpretation, no stylization, no background, no watermark.';

const ALLOWED_HOSTS = new Set([
  'api-ml.imagine.art',
  'api.freellmapi.com',
  'localhost',
  '127.0.0.1'
]);
const MAX_UPLOAD_BYTES = 6 * 1024 * 1024; // 6 MB

export async function callStencilProvider(imageBase64, mimeType) {
  const imagineKey = process.env.IMAGINE_API_KEY;
  if (imagineKey) {
    return callImagineArt(imageBase64, mimeType, imagineKey);
  }
  const freeKey = process.env.FREELLM_API_KEY || process.env.FREELLMAPI_API_KEY;
  const freeBase = process.env.FREELLMAPI_BASE_URL || 'http://127.0.0.1:31415/v1';
  const freeModel = process.env.FREELLMAPI_VISION_MODEL || process.env.FREELLMAPI_MODEL || 'nemotron-3-ultra-550b';
  if (freeKey) {
    return callFreeLLMAPIVision(imageBase64, mimeType, freeBase, freeKey, freeModel);
  }
  const err = new Error('Nessun provider AI configurato: imposta IMAGINE_API_KEY o FREELLMAPI_API_KEY.');
  err.statusCode = 503;
  err.code = 'no_ai_provider';
  throw err;
}

async function callImagineArt(base64, mime, key) {
  const url = 'https://api-ml.imagine.art/v1/images/edits';
  const form = new FormData();
  form.append('prompt', STENCIL_PROMPT);
  const blob = Buffer.from(base64, 'base64');
  if (blob.length > MAX_UPLOAD_BYTES) {
    const err = new Error('Immagine troppo grande (max 6 MB)');
    err.statusCode = 413;
    err.code = 'payload_too_large';
    throw err;
  }
  form.append('images', new Blob([blob]), 'input.png');
  form.append('aspect_ratio', '1:1');
  form.append('resolution', '1024x1024');
  form.append('seed', '-1');

  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form,
    signal: AbortSignal.timeout(120000)
  });

  if (!res.ok) {
    let detail = '';
    try { detail = await res.text(); } catch {}
    const err = new Error(`ImagineArt ${res.status}: ${detail}`);
    err.statusCode = res.status === 504 ? 504 : 502;
    err.code = res.status === 504 ? 'generation_timeout' : 'provider_error';
    throw err;
  }

  const data = await res.json();
  const imgUrl = data?.data?.[0]?.url || data?.url || data?.output?.[0];
  if (!imgUrl) throw Object.assign(new Error('Risposta ImagineArt senza URL'), { statusCode: 502 });

  const imgRes = await fetch(imgUrl, { signal: AbortSignal.timeout(30000) });
  if (!imgRes.ok) throw Object.assign(new Error('Download risultato fallito'), { statusCode: 502 });
  return Buffer.from(await imgRes.arrayBuffer());
}

async function callFreeLLMAPIVision(base64, mime, baseUrl, key, model) {
  // FreeLLMAPI vision: accetta data URI, ma generazione immagini non garantita.
  // Se il modello non supporta image-to-image, l'errore salirà come 502.
  const url = `${baseUrl.replace(/\/v1\/?$/, '')}/v1/chat/completions`;
  const payload = {
    model,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: STENCIL_PROMPT },
        { type: 'image_url', image_url: { url: `data:${mime};base64,${base64}` } }
      ]
    }],
    max_tokens: 400
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(120000)
  });

  if (!res.ok) {
    let detail = '';
    try { detail = await res.text(); } catch {}
    const err = new Error(`FreeLLMAPI ${res.status}: ${detail}`);
    err.statusCode = 502;
    err.code = 'provider_error';
    throw err;
  }

  const data = await res.json();
  // Ci aspettiamo che il provider restituisca un URL immagine in choices[0].message.content
  const content = data?.choices?.[0]?.message?.content || '';
  const m = content.match(/https?:\/\/[^\s"')]+/);
  if (!m) throw Object.assign(new Error('FreeLLMAPI: nessun URL immagine nella risposta'), { statusCode: 502 });

  const imgRes = await fetch(m[0], { signal: AbortSignal.timeout(30000) });
  if (!imgRes.ok) throw Object.assign(new Error('Download risultato fallito'), { statusCode: 502 });
  return Buffer.from(await imgRes.arrayBuffer());
}
