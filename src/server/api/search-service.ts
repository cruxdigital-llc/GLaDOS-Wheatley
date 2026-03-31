/**
 * Search Service
 *
 * Provides full-text search across board cards: titles, spec file contents,
 * comments, and claimant names.  Results are scored and capped at 50.
 */

import type { GitAdapter } from '../git/types.js';
import type { BoardService } from './board-service.js';
import type { BoardCard } from '../../shared/grammar/types.js';

export type MatchType = 'title' | 'spec' | 'comment' | 'claimant';

export interface SearchResult {
  cardId: string;
  title: string;
  phase: string;
  matchType: MatchType;
  matchContext: string;
  score: number;
}

const MAX_RESULTS = 50;
const CONTEXT_RADIUS = 100;
const SPEC_FILES = ['README.md', 'spec.md', 'plan.md'] as const;

/**
 * Escape special regex characters so the user query is treated literally.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build a surrounding-context snippet with the match highlighted.
 */
function extractContext(text: string, matchIndex: number, matchLength: number): string {
  const start = Math.max(0, matchIndex - CONTEXT_RADIUS);
  const end = Math.min(text.length, matchIndex + matchLength + CONTEXT_RADIUS);

  let snippet = '';
  if (start > 0) snippet += '...';
  const raw = text.slice(start, end);
  snippet += raw;
  if (end < text.length) snippet += '...';

  // Highlight the match within the snippet
  const offsetInSnippet = matchIndex - start + (start > 0 ? 3 : 0);
  const before = snippet.slice(0, offsetInSnippet);
  const matched = snippet.slice(offsetInSnippet, offsetInSnippet + matchLength);
  const after = snippet.slice(offsetInSnippet + matchLength);

  return `${before}**${matched}**${after}`;
}

export class SearchService {
  private readonly boardService: BoardService;
  private readonly adapter: GitAdapter;

  constructor(boardService: BoardService, adapter: GitAdapter) {
    this.boardService = boardService;
    this.adapter = adapter;
  }

  async search(query: string, branch?: string): Promise<SearchResult[]> {
    if (!query.trim()) return [];

    const board = await this.boardService.getBoardState(branch);
    const cards: BoardCard[] = board.columns.flatMap((col) => col.cards);

    const pattern = new RegExp(escapeRegex(query), 'gi');
    const results: SearchResult[] = [];

    // Collect all async work for spec/comment searches
    const asyncWork: Array<Promise<SearchResult[]>> = [];

    for (const card of cards) {
      // 1. Title matches
      this.matchTitle(card, pattern, results);

      // 2. Claimant matches
      this.matchClaimant(card, pattern, results);

      // 3. Spec file content matches (async)
      if (card.specEntry) {
        asyncWork.push(this.matchSpecFiles(card, pattern, branch));
      }

      // 4. Comment matches (async)
      if (card.specEntry) {
        asyncWork.push(this.matchComments(card, pattern, branch));
      }
    }

    const asyncResults = await Promise.all(asyncWork);
    for (const batch of asyncResults) {
      results.push(...batch);
    }

    // Sort by score descending, then limit
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, MAX_RESULTS);
  }

  private matchTitle(card: BoardCard, pattern: RegExp, results: SearchResult[]): void {
    pattern.lastIndex = 0;
    const match = pattern.exec(card.title);
    if (match) {
      results.push({
        cardId: card.id,
        title: card.title,
        phase: card.phase,
        matchType: 'title',
        matchContext: card.title.replace(
          new RegExp(escapeRegex(match[0]), 'gi'),
          `**${match[0]}**`,
        ),
        score: 10,
      });
    }
  }

  private matchClaimant(card: BoardCard, pattern: RegExp, results: SearchResult[]): void {
    if (!card.claim) return;
    pattern.lastIndex = 0;
    const match = pattern.exec(card.claim.claimant);
    if (match) {
      results.push({
        cardId: card.id,
        title: card.title,
        phase: card.phase,
        matchType: 'claimant',
        matchContext: `Claimed by **${card.claim.claimant}**`,
        score: 5,
      });
    }
  }

  private async matchSpecFiles(
    card: BoardCard,
    pattern: RegExp,
    branch: string | undefined,
  ): Promise<SearchResult[]> {
    const specEntry = card.specEntry!;
    const filesToCheck = SPEC_FILES.filter((f) => specEntry.files.includes(f));
    const matched: SearchResult[] = [];

    const contents = await Promise.all(
      filesToCheck.map(async (fileName) => {
        const content = await this.adapter.readFile(
          `specs/${specEntry.dirName}/${fileName}`,
          branch,
        );
        return { fileName, content };
      }),
    );

    for (const { content } of contents) {
      if (!content) continue;
      pattern.lastIndex = 0;
      const match = pattern.exec(content);
      if (match) {
        matched.push({
          cardId: card.id,
          title: card.title,
          phase: card.phase,
          matchType: 'spec',
          matchContext: extractContext(content, match.index, match[0].length),
          score: 7,
        });
      }
    }

    return matched;
  }

  private async matchComments(
    card: BoardCard,
    pattern: RegExp,
    branch: string | undefined,
  ): Promise<SearchResult[]> {
    const specEntry = card.specEntry!;
    const content = await this.adapter.readFile(
      `specs/${specEntry.dirName}/comments.md`,
      branch,
    );
    if (!content) return [];

    pattern.lastIndex = 0;
    const match = pattern.exec(content);
    if (match) {
      return [{
        cardId: card.id,
        title: card.title,
        phase: card.phase,
        matchType: 'comment',
        matchContext: extractContext(content, match.index, match[0].length),
        score: 3,
      }];
    }

    return [];
  }
}
