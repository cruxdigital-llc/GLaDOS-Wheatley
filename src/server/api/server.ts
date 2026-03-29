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
import { TransitionService } from './transition-service.js';
import { WorkflowService } from './workflow-service.js';
import { BranchScanner } from './branch-scanner.js';
import { BranchHealthService } from './branch-health.js';
import { ActivityService } from './activity-service.js';
import { getClaimTTLConfig } from './claim-ttl.js';
import { ConflictDetector } from './conflict-detector.js';
import { NotificationService } from './notification-service.js';
import { errorHandler } from './error-handler.js';
import { healthRoutes } from './routes/health.js';
import { boardRoutes } from './routes/board.js';
import { branchRoutes } from './routes/branches.js';
import { conformanceRoutes } from './routes/conformance.js';
import { claimsRoutes } from './routes/claims.js';
import { transitionRoutes } from './routes/transitions.js';
import { webhookRoutes } from './routes/webhooks.js';
import { activityRoutes } from './routes/activity.js';
import { notificationRoutes } from './routes/notifications.js';
import { repoStatusRoutes } from './routes/repo-status.js';
import { identityRoutes } from './routes/identity.js';
import { syncRoutes } from './routes/sync.js';
import { eventLogRoutes } from './routes/event-log.js';
import { EventBus } from './event-bus.js';
import { EventLogService } from './event-log-service.js';

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
  const gladosWebhookUrl = process.env['GLADOS_WEBHOOK_URL'];
  const workflowService = new WorkflowService(gladosWebhookUrl);
  const transitionService = new TransitionService(options.adapter, workflowService);
  const branchScanner = new BranchScanner(options.adapter);
  const branchHealthService = new BranchHealthService(options.adapter);
  const activityService = new ActivityService(options.adapter);
  const claimTTLConfig = getClaimTTLConfig();
  const conflictDetector = new ConflictDetector(options.adapter);
  const notificationService = new NotificationService();
  const eventBus = new EventBus();
  const eventLogService = new EventLogService(options.adapter, eventBus);
  eventLogService.start();

  // Stop event log on server close
  app.addHook('onClose', async () => {
    eventLogService.stop();
  });

  // Routes (all registered as plain function calls for consistency)
  healthRoutes(app);
  boardRoutes(app, boardService, claimService, options.adapter, branchScanner);
  branchRoutes(app, options.adapter, boardService, branchHealthService, conflictDetector);
  conformanceRoutes(app, options.adapter);
  claimsRoutes(app, claimService, options.adapter, claimTTLConfig);
  transitionRoutes(app, transitionService);
  webhookRoutes(app, workflowService);
  activityRoutes(app, activityService);
  notificationRoutes(app, notificationService);
  repoStatusRoutes(app, options.adapter);
  identityRoutes(app, options.adapter);
  syncRoutes(app, options.adapter, eventBus);
  eventLogRoutes(app, eventLogService);

  return app;
}
