/**
 * Login Page Route
 *
 * GET /login — returns a self-contained HTML login page with OAuth provider buttons.
 */

import type { FastifyInstance } from 'fastify';
import type { AuthConfig } from './types.js';

export function loginPageRoute(app: FastifyInstance, config: AuthConfig): void {
  app.get('/login', async (_request, reply) => {
    const buttons: string[] = [];

    if (config.github) {
      buttons.push(`
        <a href="/auth/login" class="btn btn-github">
          <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38
              0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52
              -.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2
              -3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82
              .64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08
              2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01
              1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
          </svg>
          Login with GitHub
        </a>`);
    }

    if (config.gitlab) {
      buttons.push(`
        <a href="/auth/login" class="btn btn-gitlab">
          <svg width="20" height="20" viewBox="0 0 380 380" fill="currentColor">
            <path d="M282.83 170.73l-.27-.69-26.14-68.22a6.81 6.81 0 00-2.69-3.24 7 7 0
              00-8 .43 7 7 0 00-2.32 3.52l-17.65 54h-71.47l-17.65-54a6.86 6.86 0 00-2.32-3.53
              7 7 0 00-8-.43 6.87 6.87 0 00-2.69 3.24L97.44 170l-.26.69a48.54 48.54 0 0016.1
              56.07l.09.07.24.17 39.82 29.82 19.7 14.91 12 9.06a8.07 8.07 0 009.76 0l12-9.06
              19.7-14.91 40.06-30 .1-.08a48.56 48.56 0 0016.08-56.01z"/>
          </svg>
          Login with GitLab
        </a>`);
    }

    const buttonsHtml = buttons.length > 0
      ? buttons.join('\n')
      : '<p class="no-provider">No OAuth provider configured. Contact your administrator.</p>';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Login — Wheatley</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0d1117;
      color: #c9d1d9;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .card {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 12px;
      padding: 40px;
      max-width: 400px;
      width: 100%;
      text-align: center;
    }
    h1 {
      font-size: 1.5rem;
      margin-bottom: 8px;
      color: #f0f6fc;
    }
    .subtitle {
      font-size: 0.9rem;
      color: #8b949e;
      margin-bottom: 32px;
    }
    .btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      width: 100%;
      padding: 12px 20px;
      border-radius: 6px;
      font-size: 1rem;
      font-weight: 500;
      text-decoration: none;
      cursor: pointer;
      border: 1px solid #30363d;
      margin-bottom: 12px;
      transition: background 0.15s;
    }
    .btn-github {
      background: #238636;
      color: #fff;
      border-color: #238636;
    }
    .btn-github:hover { background: #2ea043; }
    .btn-gitlab {
      background: #e24329;
      color: #fff;
      border-color: #e24329;
    }
    .btn-gitlab:hover { background: #fc6d26; }
    .no-provider {
      color: #8b949e;
      font-style: italic;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>Wheatley</h1>
    <p class="subtitle">Sign in to continue</p>
    ${buttonsHtml}
  </div>
</body>
</html>`;

    return reply.type('text/html').send(html);
  });
}
