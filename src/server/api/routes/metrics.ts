/**
 * Prometheus-compatible Metrics Endpoint
 *
 * In-memory counters and histograms exposed in Prometheus text format.
 * No external prometheus library required.
 */

import type { FastifyInstance } from 'fastify';

interface MetricsCollector {
  requestCount: Map<string, number>;
  requestDuration: Map<string, number[]>;
  gitOpDuration: Map<string, number[]>;
  sseConnections: number;
  boardCards: number;
}

const metrics: MetricsCollector = {
  requestCount: new Map(),
  requestDuration: new Map(),
  gitOpDuration: new Map(),
  sseConnections: 0,
  boardCards: 0,
};

/** Default histogram bucket boundaries (in seconds). */
const HISTOGRAM_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

/**
 * Build a Prometheus histogram block from a map of label-key -> observations.
 */
function formatHistogram(
  name: string,
  help: string,
  data: Map<string, number[]>,
  labelNames: string[],
): string {
  const lines: string[] = [];
  lines.push(`# HELP ${name} ${help}`);
  lines.push(`# TYPE ${name} histogram`);

  for (const [key, observations] of data.entries()) {
    const labelValues = key.split('|');
    const labelStr = labelNames.map((n, i) => `${n}="${labelValues[i] ?? ''}"`).join(',');

    const sorted = [...observations].sort((a, b) => a - b);
    let cumulative = 0;
    for (const bucket of HISTOGRAM_BUCKETS) {
      while (cumulative < sorted.length && sorted[cumulative] <= bucket) {
        cumulative++;
      }
      lines.push(`${name}_bucket{${labelStr},le="${bucket}"} ${cumulative}`);
    }
    lines.push(`${name}_bucket{${labelStr},le="+Inf"} ${sorted.length}`);

    const sum = observations.reduce((a, b) => a + b, 0);
    lines.push(`${name}_sum{${labelStr}} ${sum}`);
    lines.push(`${name}_count{${labelStr}} ${observations.length}`);
  }

  return lines.join('\n');
}

/**
 * Format all collected metrics as Prometheus text exposition.
 */
function formatMetrics(): string {
  const sections: string[] = [];

  // wheatley_http_requests_total (counter by method, path, status)
  sections.push('# HELP wheatley_http_requests_total Total HTTP requests');
  sections.push('# TYPE wheatley_http_requests_total counter');
  for (const [key, count] of metrics.requestCount.entries()) {
    const [method, path, status] = key.split('|');
    sections.push(
      `wheatley_http_requests_total{method="${method}",path="${path}",status="${status}"} ${count}`,
    );
  }

  // wheatley_http_request_duration_seconds (histogram by method, path)
  sections.push('');
  sections.push(
    formatHistogram(
      'wheatley_http_request_duration_seconds',
      'HTTP request duration in seconds',
      metrics.requestDuration,
      ['method', 'path'],
    ),
  );

  // wheatley_git_operation_duration_seconds (histogram by operation)
  sections.push('');
  sections.push(
    formatHistogram(
      'wheatley_git_operation_duration_seconds',
      'Git operation duration in seconds',
      metrics.gitOpDuration,
      ['operation'],
    ),
  );

  // wheatley_active_sse_connections (gauge)
  sections.push('');
  sections.push('# HELP wheatley_active_sse_connections Current active SSE connections');
  sections.push('# TYPE wheatley_active_sse_connections gauge');
  sections.push(`wheatley_active_sse_connections ${metrics.sseConnections}`);

  // wheatley_board_cards_total (gauge)
  sections.push('');
  sections.push('# HELP wheatley_board_cards_total Total board cards');
  sections.push('# TYPE wheatley_board_cards_total gauge');
  sections.push(`wheatley_board_cards_total ${metrics.boardCards}`);

  return sections.join('\n') + '\n';
}

/**
 * Update a scalar metric field.
 *
 * Supported fields:
 * - "sseConnections" — set the active SSE connection gauge
 * - "boardCards" — set the board cards gauge
 */
export function updateMetrics(field: string, value: number): void {
  if (field === 'sseConnections') {
    metrics.sseConnections = value;
  } else if (field === 'boardCards') {
    metrics.boardCards = value;
  }
}

/**
 * Record a git operation duration observation.
 */
export function recordGitOp(operation: string, durationSeconds: number): void {
  const existing = metrics.gitOpDuration.get(operation) ?? [];
  existing.push(durationSeconds);
  metrics.gitOpDuration.set(operation, existing);
}

export function metricsRoutes(app: FastifyInstance): void {
  // Track every response for request count and duration metrics
  app.addHook('onResponse', async (request, reply) => {
    const method = request.method;
    const path = request.routeOptions?.url ?? request.url;
    const status = String(reply.statusCode);

    // Increment request counter
    const countKey = `${method}|${path}|${status}`;
    metrics.requestCount.set(countKey, (metrics.requestCount.get(countKey) ?? 0) + 1);

    // Record request duration
    const durationKey = `${method}|${path}`;
    const elapsedMs = reply.elapsedTime; // Fastify provides this in ms
    const elapsedSec = (elapsedMs ?? 0) / 1000;
    const existing = metrics.requestDuration.get(durationKey) ?? [];
    existing.push(elapsedSec);
    metrics.requestDuration.set(durationKey, existing);
  });

  // GET /metrics — Prometheus scrape endpoint
  app.get('/metrics', async (_request, reply) => {
    return reply.type('text/plain; version=0.0.4').send(formatMetrics());
  });
}

export { metrics };
