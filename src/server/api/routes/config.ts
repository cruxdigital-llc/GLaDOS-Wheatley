/**
 * Config Routes
 *
 * GET /api/config/parser — returns the active parser config and available presets
 */

import type { FastifyInstance } from 'fastify';
import type { GitAdapter } from '../../git/types.js';
import { loadParserConfig } from '../../../shared/parsers/config-loader.js';
import { PARSER_PRESETS } from '../../../shared/parsers/parser-config.js';
import { loadWorkflowConfig } from '../../workflows/config.js';

export function configRoutes(app: FastifyInstance, adapter: GitAdapter): void {
  app.get('/api/config/parser', async () => {
    const active = await loadParserConfig(adapter);
    return {
      active,
      presets: PARSER_PRESETS,
    };
  });

  app.get('/api/config/workflows', async () => {
    return loadWorkflowConfig(adapter);
  });
}
