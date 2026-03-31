/**
 * Wheatley Server Entry Point
 *
 * Boots the Fastify server with the appropriate git adapter.
 */

import { createServer } from './api/server.js';
import { createGitAdapter, configFromEnv } from './git/factory.js';

async function main(): Promise<void> {
  const config = configFromEnv();
  const adapter = createGitAdapter(config);

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

  // Graceful shutdown for Docker
  const shutdown = async (signal: string) => {
    server.log.info(`Received ${signal}, shutting down gracefully...`);
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
