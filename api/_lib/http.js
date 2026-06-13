const MAX_BODY_BYTES = 48 * 1024;

export const sendJson = (response, status, payload) => {
    response.status(status).json(payload);
};

export const methodNotAllowed = (response, allowed = ['POST']) => {
    response.setHeader('Allow', allowed.join(', '));
    sendJson(response, 405, {
        ok: false,
        error: 'Metodo non consentito.'
    });
};

export const readJsonBody = async (request) => {
    if (request.body && typeof request.body === 'object') return request.body;
    if (!request.body) return {};

    const raw = typeof request.body === 'string'
        ? request.body
        : JSON.stringify(request.body);

    if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
        const error = new Error('Payload troppo grande.');
        error.statusCode = 413;
        throw error;
    }

    try {
        return JSON.parse(raw || '{}');
    } catch {
        const error = new Error('JSON non valido.');
        error.statusCode = 400;
        throw error;
    }
};

export const sanitizeText = (value = '', maxLength = 4000) => String(value || '')
    .replace(/\u0000/g, '')
    .trim()
    .slice(0, maxLength);

export const compactObject = (value, maxLength = 12000) => {
    try {
        return JSON.stringify(value || {}, null, 2).slice(0, maxLength);
    } catch {
        return '{}';
    }
};
