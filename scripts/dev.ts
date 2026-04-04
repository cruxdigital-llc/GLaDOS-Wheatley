/**
 * Dev Script — starts both server and frontend concurrently.
 *
 * Usage: npm run dev
 *
 * The server (Fastify) runs on port 3000 and the frontend (Vite) on port 5173.
 * Vite proxies /api requests to the server automatically.
 *
 * Environment variables (optional):
 *   WHEATLEY_REPO_PATH  — path to the repo to watch (defaults to cwd)
 *   WHEATLEY_MODE       — "local" (default) or "remote"
 *   WHEATLEY_GLADOS_CMD — command to run GLaDOS workflows (e.g., "claude")
 */

import { spawn, type ChildProcess } from 'child_process';

const isWindows = process.platform === 'win32';

function run(label: string, cmd: string, args: string[], env?: Record<string, string>): ChildProcess {
  const resolvedCmd = isWindows ? `${cmd}.cmd` : cmd;
  const child = spawn(resolvedCmd, args, {
    stdio: 'pipe',
    env: { ...process.env, ...env },
  });

  const prefix = `[${label}]`;

  child.stdout?.on('data', (data: Buffer) => {
    for (const line of data.toString().split('\n').filter(Boolean)) {
      console.log(`${prefix} ${line}`);
    }
  });

  child.stderr?.on('data', (data: Buffer) => {
    for (const line of data.toString().split('\n').filter(Boolean)) {
      console.error(`${prefix} ${line}`);
    }
  });

  child.on('exit', (code) => {
    console.log(`${prefix} exited with code ${code}`);
  });

  return child;
}

// Default WHEATLEY_REPO_PATH to cwd if not set
const repoPath = process.env['WHEATLEY_REPO_PATH'] || process.cwd();

console.log(`Starting Wheatley dev server...`);
console.log(`  Repo path: ${repoPath}`);
console.log(`  Server:    http://localhost:3000`);
console.log(`  Frontend:  http://localhost:5173`);
console.log(`  GLaDOS:    ${process.env['WHEATLEY_GLADOS_CMD'] || '(not configured — set WHEATLEY_GLADOS_CMD=claude to enable workflows)'}`);
console.log('');

const server = run('server', 'npx', ['tsx', 'watch', 'src/server/index.ts'], {
  WHEATLEY_MODE: process.env['WHEATLEY_MODE'] || 'local',
  WHEATLEY_REPO_PATH: repoPath,
});

const frontend = run('frontend', 'npx', ['vite']);

// Clean shutdown
function cleanup() {
  server.kill();
  frontend.kill();
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
