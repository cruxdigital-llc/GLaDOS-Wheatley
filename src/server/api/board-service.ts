/**
 * Board Service
 *
 * Wires the git adapter to parsers and board assembler.
 * Provides a high-level API for fetching board state and card details.
 * Stateless: branch is passed per-request, not stored on the instance.
 */

import type { GitAdapter } from '../git/types.js';
import type { BoardState, BoardCard } from '../../shared/grammar/types.js';
import { parseRoadmap } from '../../shared/parsers/roadmap-parser.js';
import { parseSpecDirectories } from '../../shared/parsers/spec-parser.js';
import { parseProjectStatus } from '../../shared/parsers/status-parser.js';
import { parseClaims } from '../../shared/parsers/claims-parser.js';
import { assembleBoardState } from '../../shared/parsers/board-assembler.js';
import type { SpecDirectoryInput } from '../../shared/parsers/spec-parser.js';

export class BoardService {
  private readonly adapter: GitAdapter;

  constructor(adapter: GitAdapter) {
    this.adapter = adapter;
  }

  /**
   * Get the full board state for the given branch.
   *
   * @param branch - The branch to read roadmap, specs, and status from (the "viewed" branch).
   * @param coordinationBranch - The branch to always read claims from. When omitted, claims
   *   are read from the same branch as everything else (backward-compatible).
   */
  async getBoardState(branch?: string, coordinationBranch?: string): Promise<BoardState> {
    const ref = branch ?? undefined;
    // Claims are always read from the coordination branch when specified; fall back to the
    // viewed branch so existing callers that omit coordinationBranch are unaffected.
    const claimsRef = coordinationBranch ?? ref;

    // Read all source files in parallel
    const [roadmapContent, statusContent, claimsContent, specDirs] = await Promise.all([
      this.adapter.readFile('product-knowledge/ROADMAP.md', ref),
      this.adapter.readFile('product-knowledge/PROJECT_STATUS.md', ref),
      this.adapter.readFile('product-knowledge/claims.md', claimsRef),
      this.adapter.listDirectory('specs', ref),
    ]);

    // Parse roadmap, status, and claims
    const roadmap = parseRoadmap(roadmapContent ?? '');
    const status = parseProjectStatus(statusContent ?? '');
    const claims = parseClaims(claimsContent ?? '');

    // Parse spec directories in parallel
    const specInputs = await this.buildSpecInputs(specDirs, ref);
    const specs = parseSpecDirectories(specInputs);

    return assembleBoardState(roadmap, specs, status, claims);
  }

  /** Get a single card by ID with full detail (spec contents). */
  async getCardDetail(
    cardId: string,
    branch?: string,
    coordinationBranch?: string,
  ): Promise<{
    card: BoardCard;
    specContents?: Record<string, string>;
  } | null> {
    const board = await this.getBoardState(branch, coordinationBranch);

    let foundCard: BoardCard | undefined;
    for (const column of board.columns) {
      foundCard = column.cards.find((c) => c.id === cardId);
      if (foundCard) break;
    }

    if (!foundCard) return null;

    // If the card has a spec entry, read all spec files in parallel
    let specContents: Record<string, string> | undefined;
    if (foundCard.specEntry) {
      const ref = branch ?? undefined;
      const entries = await Promise.all(
        foundCard.specEntry.files.map(async (file) => {
          const content = await this.adapter.readFile(
            `specs/${foundCard!.specEntry!.dirName}/${file}`,
            ref,
          );
          return [file, content] as const;
        }),
      );
      specContents = {};
      for (const [file, content] of entries) {
        if (content) {
          specContents[file] = content;
        }
      }
    }

    return { card: foundCard, specContents };
  }

  /** Get the current branch from the adapter. */
  async getCurrentBranch(): Promise<string> {
    return this.adapter.getCurrentBranch();
  }

  /** Build spec directory inputs by reading each spec directory in parallel. */
  private async buildSpecInputs(
    specDirs: Array<{ name: string; type: string; path: string }>,
    ref?: string,
  ): Promise<SpecDirectoryInput[]> {
    const dirEntries = specDirs.filter((d) => d.type === 'directory');

    const results = await Promise.all(
      dirEntries.map(async (dir) => {
        const files = await this.adapter.listDirectory(`specs/${dir.name}`, ref);
        const fileNames = files.filter((f) => f.type === 'file').map((f) => f.name);

        const [tasksContent, readmeContent] = await Promise.all([
          fileNames.includes('tasks.md')
            ? this.adapter.readFile(`specs/${dir.name}/tasks.md`, ref)
            : Promise.resolve(undefined),
          fileNames.includes('README.md')
            ? this.adapter.readFile(`specs/${dir.name}/README.md`, ref)
            : Promise.resolve(undefined),
        ]);

        return {
          dirName: dir.name,
          files: fileNames,
          tasksContent: tasksContent ?? undefined,
          readmeContent: readmeContent ?? undefined,
        };
      }),
    );

    return results;
  }
}
