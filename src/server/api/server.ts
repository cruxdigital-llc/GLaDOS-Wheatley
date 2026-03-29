/**
 * Fastify Server Factory
 *
 * Creates and configures the Fastify server instance.
 */

import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import type { GitAdapter } from '../git/types.js';
import { BoardService } from './board-service.js';
import { errorHandler } from './error-handler.js';
import { healthRoutes } from './routes/health.js';
import { boardRoutes } from './routes/board.js';
import { branchRoutes } from './routes/branches.js';

export interface ServerOptions {
  adapter: GitAdapter;
  host?: string;
  port?: number;
  corsOrigin?: string | string[] | boolean;
}

export async function createServer(options: ServerOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: true,
  });

  // CORS
  await app.register(cors, {
    origin: options.corsOrigin ?? true, // Allow all in dev
  });

  // Error handler
  app.setErrorHandler(errorHandler);

  // Services
  const boardService = new BoardService(options.adapter);

  // Routes
  await app.register(healthRoutes);
  boardRoutes(app, boardService);
  branchRoutes(app, options.adapter, boardService);

  return app;
}
