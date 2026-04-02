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
import { CardService } from './card-service.js';
import { SearchService } from './search-service.js';
import { cardRoutes } from './routes/cards.js';
import { specRoutes } from './routes/specs.js';
import { commentRoutes } from './routes/comments.js';
import { searchRoutes } from './routes/search.js';
import { metadataRoutes } from './routes/metadata.js';
import { configRoutes } from './routes/config.js';
import { workflowRunRoutes } from './routes/workflows.js';
import { pullRequestRoutes } from './routes/pull-requests.js';
import { BoardCache } from './board-cache.js';
import { createPlatformAdapter } from '../platforms/factory.js';
import { PRLinkService } from './pr-link-service.js';
import { SubprocessRunner } from '../workflows/subprocess-runner.js';
import { NullRunner } from '../workflows/null-runner.js';
import type { WorkflowRunner } from '../workflows/types.js';
import { loadAuthConfig, authMiddleware, requireRole, oauthRoutes, loginPageRoute } from '../auth/index.js';
import { UserNotificationService } from '../notifications/notification-service.js';
import { userNotificationRoutes } from './routes/user-notifications.js';
import { RepoManager } from '../multi-repo/repo-manager.js';
import { repoRoutes } from './routes/repos.js';
import { bulkRoutes } from './routes/bulk.js';
import { relationshipRoutes } from './routes/relationships.js';
import { metricsRoutes } from './routes/metrics.js';

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

  // Auth
  const authConfig = loadAuthConfig();

  // Paths that should be accessible without authentication
  const PUBLIC_PATHS = new Set(['/api/health', '/login']);
  const PUBLIC_PREFIXES = ['/auth/'];

  const authHook = authMiddleware(authConfig, options.adapter);

  if (authConfig.mode === 'cloud') {
    // Cloud mode: require authentication, but skip for public/auth routes
    app.addHook('onRequest', async (request, reply) => {
      const url = request.url.split('?')[0];
      if (PUBLIC_PATHS.has(url) || PUBLIC_PREFIXES.some((p) => url.startsWith(p))) {
        return; // Skip auth for login, health, and OAuth callback routes
      }
      return authHook(request, reply);
    });
    oauthRoutes(app, authConfig);
    loginPageRoute(app, authConfig);
  } else {
    // Local mode: attach a default local user to every request (no auth required)
    app.addHook('onRequest', authHook);
  }

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
  const boardCache = new BoardCache();
  const cardService = new CardService(options.adapter, boardService);
  const searchService = new SearchService(boardService, options.adapter);
  const workflowRunner: WorkflowRunner = process.env['WHEATLEY_GLADOS_CMD']
    ? new SubprocessRunner()
    : new NullRunner();
  const platformAdapter = createPlatformAdapter();
  const prLinkService = new PRLinkService(platformAdapter);
  const eventBus = new EventBus();
  const eventLogService = new EventLogService(options.adapter, eventBus);
  eventLogService.start();
  const userNotificationService = new UserNotificationService();
  const repoManager = new RepoManager(options.adapter);

  // Stop event log on server close
  app.addHook('onClose', async () => {
    eventLogService.stop();
  });

  // Role-based access guards (applied as preHandler so auth has already run)
  const editorGuard = requireRole('editor');
  const adminGuard = requireRole('admin');

  // Mutation routes (POST/PUT/DELETE) require at least 'editor' role.
  // Webhook and config routes require 'admin' role.
  const ADMIN_PREFIXES = ['/api/webhooks', '/api/config', '/api/notifications/webhooks'];
  app.addHook('preHandler', async (request, reply) => {
    const method = request.method;
    const url = request.url.split('?')[0]; // strip query params

    // Skip auth checks for auth-related and health routes
    if (url.startsWith('/auth/') || url === '/login' || url === '/api/health') {
      return;
    }

    // Admin routes: any method on admin prefixes
    if (ADMIN_PREFIXES.some((prefix) => url.startsWith(prefix))) {
      return adminGuard(request, reply);
    }

    // Mutation routes: POST, PUT, DELETE, PATCH require editor
    if (method === 'POST' || method === 'PUT' || method === 'DELETE' || method === 'PATCH') {
      return editorGuard(request, reply);
    }

    // GET routes: accessible to any authenticated user (viewer+)
  });

  // Routes (all registered as plain function calls for consistency)
  healthRoutes(app);
  boardRoutes(app, boardService, claimService, options.adapter, branchScanner, boardCache);
  branchRoutes(app, options.adapter, boardService, branchHealthService, conflictDetector);
  conformanceRoutes(app, options.adapter);
  claimsRoutes(app, claimService, options.adapter, claimTTLConfig);
  transitionRoutes(app, transitionService);
  webhookRoutes(app, workflowService);
  activityRoutes(app, activityService);
  notificationRoutes(app, notificationService);
  repoStatusRoutes(app, options.adapter);
  identityRoutes(app, options.adapter);
  cardRoutes(app, cardService);
  specRoutes(app, options.adapter);
  commentRoutes(app, options.adapter);
  searchRoutes(app, searchService);
  metadataRoutes(app, options.adapter);
  syncRoutes(app, options.adapter, eventBus);
  eventLogRoutes(app, eventLogService);
  configRoutes(app, options.adapter);
  workflowRunRoutes(app, workflowRunner);
  pullRequestRoutes(app, platformAdapter, prLinkService);
  userNotificationRoutes(app, userNotificationService);
  repoRoutes(app, repoManager);
  bulkRoutes(app, cardService, claimService, transitionService, options.adapter);
  relationshipRoutes(app, options.adapter, boardService);
  metricsRoutes(app);

  return app;
}
