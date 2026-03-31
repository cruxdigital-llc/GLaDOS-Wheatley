/**
 * Comment Routes
 *
 * GET  /api/specs/:specDir/comments — read comments
 * POST /api/specs/:specDir/comments — add a comment
 */

import type { FastifyInstance } from 'fastify';
import type { GitAdapter } from '../../git/types.js';

const SAFE_DIR_RE = /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/;
const MAX_COMMENT_LENGTH = 5000;
const MAX_AUTHOR_LENGTH = 100;

interface Comment {
  author: string;
  timestamp: string;
  body: string;
}

/** Strip markdown formatting characters that could break comment parsing. */
function sanitizeMarkdown(value: string): string {
  return value.replace(/[*_`~\[\]]/g, '');
}

/** Sanitize for commit messages. */
function sanitizeForCommit(value: string): string {
  return value.replace(/[\r\n\x00-\x1f]/g, ' ').trim().slice(0, 100);
}

function parseComments(content: string): Comment[] {
  const comments: Comment[] = [];
  const blocks = content.split(/^---$/m);
  for (const block of blocks) {
    const match = block.match(/^\*\*(.+?)\*\*\s+_(.+?)_\s*\n\n([\s\S]*)/m);
    if (match) {
      comments.push({
        author: match[1].trim(),
        timestamp: match[2].trim(),
        body: match[3].trim(),
      });
    }
  }
  return comments;
}

function formatComment(author: string, body: string): string {
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  return `\n---\n\n**${author}** _${timestamp}_\n\n${body.trim()}\n`;
}

export function commentRoutes(app: FastifyInstance, adapter: GitAdapter): void {
  // GET /api/specs/:specDir/comments
  app.get<{
    Params: { specDir: string };
    Querystring: { branch?: string };
  }>('/api/specs/:specDir/comments', async (request, reply) => {
    const { specDir } = request.params;
    if (specDir.includes('..') || !SAFE_DIR_RE.test(specDir)) {
      return reply.status(400).send({ error: 'Invalid spec directory' });
    }

    const content = await adapter.readFile(`specs/${specDir}/comments.md`, request.query.branch);
    const comments = content ? parseComments(content) : [];
    return { comments };
  });

  // POST /api/specs/:specDir/comments
  app.post<{
    Params: { specDir: string };
    Body: { author?: unknown; body?: unknown; branch?: unknown };
  }>('/api/specs/:specDir/comments', async (request, reply) => {
    const { specDir } = request.params;
    const { author, body, branch } = request.body ?? {};

    if (specDir.includes('..') || !SAFE_DIR_RE.test(specDir)) {
      return reply.status(400).send({ error: 'Invalid spec directory' });
    }
    if (typeof author !== 'string' || !author.trim()) {
      return reply.status(400).send({ error: 'author is required' });
    }
    if (author.length > MAX_AUTHOR_LENGTH) {
      return reply.status(400).send({ error: `Author name too long (max ${MAX_AUTHOR_LENGTH} chars)` });
    }
    if (typeof body !== 'string' || !body.trim()) {
      return reply.status(400).send({ error: 'body is required' });
    }
    if (body.length > MAX_COMMENT_LENGTH) {
      return reply.status(400).send({ error: `Comment too long (max ${MAX_COMMENT_LENGTH} chars)` });
    }

    const safeAuthor = sanitizeMarkdown(author.trim());
    const filePath = `specs/${specDir}/comments.md`;
    const branchStr = typeof branch === 'string' ? branch : undefined;

    const existing = await adapter.readFile(filePath, branchStr);
    const header = '# Comments\n';
    const base = existing?.trim() || header.trimEnd();
    const newContent = base + formatComment(safeAuthor, body);

    await adapter.writeFile(
      filePath,
      newContent,
      `wheatley: comment on ${specDir} by ${sanitizeForCommit(safeAuthor)}`,
      branchStr,
    );

    return reply.status(201).send({ added: true });
  });
}
