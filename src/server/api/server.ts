/**
 * Fastify Server Factory
 *
 * Creates and configures the Fastify server instance.
 */

import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import type { GitAdapter } from '../git/types.js';
import { BoardService } from './board-service.js';
import { ClaimService } from './claim-service.js';
import { errorHandler } from './error-handler.js';
import { healthRoutes } from './routes/health.js';
import { boardRoutes } from './routes/board.js';
import { branchRoutes } from './routes/branches.js';
import { conformanceRoutes } from './routes/conformance.js';
import { claimsRoutes } from './routes/claims.js';

export interface ServerOptions {
  adapter: GitAdapter;
  host?: string;
  port?: number;
  corsOrigin?: string | string[] | boolean;
  logger?: boolean;
}

export async function createServer(options: ServerOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger ?? true,
  });

  // CORS — defaults to localhost for dev; set CORS_ORIGIN in production
  await app.register(cors, {
    origin: options.corsOrigin ?? 'http://localhost:5173',
  });

  // Error handler
  app.setErrorHandler(errorHandler);

  // Services
  const boardService = new BoardService(options.adapter);
  const claimService = new ClaimService(options.adapter);

  // Routes (all registered as plain function calls for consistency)
  healthRoutes(app);
  boardRoutes(app, boardService, claimService);
  branchRoutes(app, options.adapter, boardService);
  conformanceRoutes(app, options.adapter);
  claimsRoutes(app, claimService);

  return app;
}
