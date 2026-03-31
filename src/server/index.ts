/**
 * Wheatley Server Entry Point
 *
 * Boots the Fastify server with the appropriate git adapter.
 * In local mode, creates an isolated git worktree for write operations.
 */

import { createServer } from './api/server.js';
import { createGitAdapter, configFromEnv } from './git/factory.js';
import { WorktreeManager } from './git/worktree-manager.js';

async function main(): Promise<void> {
  const config = configFromEnv();
  let worktreeManager: WorktreeManager | undefined;

  // In local mode, set up worktree isolation for writes
  if (config.mode === 'local' && config.localPath) {
    worktreeManager = new WorktreeManager({ repoPath: config.localPath });
    try {
      await worktreeManager.init();
      if (worktreeManager.isReady()) {
        console.log(`[Wheatley] Worktree isolation active at ${worktreeManager.getPath()}`);
      } else {
        console.warn('[Wheatley] Worktree isolation unavailable — writes require clean working tree');
      }
    } catch (err) {
      console.warn('[Wheatley] Failed to initialize worktree:', err);
    }
  }

  const adapter = createGitAdapter(config, worktreeManager);

  const host = process.env.HOST ?? '0.0.0.0';
  const port = parseInt(process.env.PORT ?? '3000', 10);

  if (isNaN(port)) {
    console.error(`Invalid PORT: "${process.env.PORT}". Must be a number.`);
    process.exit(1);
  }

  const corsOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:5173';

  const server = await createServer({
    adapter,
    host,
    port,
    corsOrigin,
  });

  // Graceful shutdown for Docker — clean up worktree
  const shutdown = async (signal: string) => {
    server.log.info(`Received ${signal}, shutting down gracefully...`);
    if (worktreeManager) {
      try {
        await worktreeManager.destroy();
        server.log.info('Worktree cleaned up');
      } catch {
        // Best-effort cleanup
      }
    }
    await server.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  try {
    await server.listen({ host, port });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

void main();
