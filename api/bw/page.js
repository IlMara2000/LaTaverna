import { readJsonBody, sendJson, publicErrorMessage } from '../_lib/http.js';
import { requireBwSession } from '../_lib/bwSession.js';

const HTML = `<!doctype html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="robots" content="noindex,nofollow">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>STENCIL LAB</title>
  <link rel="stylesheet" href="/bw/stencil-lab.css">
  <link rel="icon" type="image/svg+xml" href="/images/favicon.svg">
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/bw/stencil-lab.js"></script>
</body>
</html>`;

const LOGIN_HTML = HTML.replace('id="app"', 'id="app" data-view="login"')
  .replace('</div>', `
    <header><h1>STENCIL LAB</h1></header>
    <main>
      <div class="panel" style="max-width:360px;margin:auto">
        <form id="loginForm">
          <label for="password">Password</label>
          <input type="password" id="password" name="password" autocomplete="current-password" required placeholder="Inserisci password">
          <button type="submit" style="margin-top:12px;width:100%;padding:12px;background:#fff;color:#000;border:none;border-radius:12px;font-weight:700">ENTRA</button>
        </form>
      </div>
    </main>
  </div>`);

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return sendJson(response, 405, { ok: false, error: 'method_not_allowed' });
  }
  try {
    const session = await requireBwSession(request);
    if (session) {
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.setHeader('Cache-Control', 'no-store');
      return response.send(HTML);
    }
    // login page
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    return response.send(LOGIN_HTML);
  } catch (err) {
    const status = err.statusCode || 500;
    return sendJson(response, status, { ok: false, error: publicErrorMessage(err, 'server_error') });
  }
}
