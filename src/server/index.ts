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
  const corsOrigin = process.env.CORS_ORIGIN ?? true;

  const server = await createServer({
    adapter,
    host,
    port,
    corsOrigin,
  });

  try {
    await server.listen({ host, port });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

void main();
