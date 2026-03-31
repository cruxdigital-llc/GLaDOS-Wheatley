/**
 * Wheatley Server Entry Point
 *
 * Boots the Fastify server with the appropriate git adapter.
 * In local mode, creates an isolated git worktree for write operations.
 */

import { createServer } from './api/server.js';
import { createGitAdapter, configFromEnv } from './git/factory.js';
import { WorktreeManager } from './git/worktree-manager.js';
import { runStartupChecks } from './startup-check.js';
import { initLogging, logger } from './logging.js';

async function main(): Promise<void> {
  initLogging();
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

  // Run startup checks
  const checkResult = await runStartupChecks(adapter, config.mode);
  for (const check of checkResult.checks) {
    if (check.passed) {
      logger.info(`Startup check [${check.name}]: ${check.message}`);
    } else {
      logger.warn(`Startup check [${check.name}]: ${check.message}`);
    }
  }
  if (!checkResult.passed) {
    logger.warn('Some startup checks failed — server will start but may have limited functionality');
  }

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

  // Graceful shutdown for Docker — drain connections, flush logs, clean up worktree
  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return; // Prevent double shutdown
    shuttingDown = true;
    logger.info(`Received ${signal}, shutting down gracefully...`);

    // Close server (drains in-flight requests, closes SSE connections)
    try {
      await server.close();
      logger.info('Server connections drained');
    } catch {
      // Best-effort
    }

    // Clean up worktree
    if (worktreeManager) {
      try {
        await worktreeManager.destroy();
        logger.info('Worktree cleaned up');
      } catch {
        // Best-effort cleanup
      }
    }

    logger.info('Shutdown complete');
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
