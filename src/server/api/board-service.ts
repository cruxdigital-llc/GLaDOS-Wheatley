/**
 * Board Service
 *
 * Wires the git adapter to parsers and board assembler.
 * Provides a high-level API for fetching board state and card details.
 */

import type { GitAdapter } from '../git/types.js';
import type { BoardState, BoardCard, SpecEntry } from '../../shared/grammar/types.js';
import { parseRoadmap } from '../../shared/parsers/roadmap-parser.js';
import { parseSpecDirectories } from '../../shared/parsers/spec-parser.js';
import { parseProjectStatus } from '../../shared/parsers/status-parser.js';
import { parseClaims } from '../../shared/parsers/claims-parser.js';
import { assembleBoardState } from '../../shared/parsers/board-assembler.js';
import type { SpecDirectoryInput } from '../../shared/parsers/spec-parser.js';

export class BoardService {
  private readonly adapter: GitAdapter;
  private activeBranch: string | null = null;

  constructor(adapter: GitAdapter) {
    this.adapter = adapter;
  }

  /** Get the full board state for the active branch. */
  async getBoardState(): Promise<BoardState> {
    const ref = this.activeBranch ?? undefined;

    // Read all source files in parallel
    const [roadmapContent, statusContent, claimsContent, specDirs] = await Promise.all([
      this.adapter.readFile('product-knowledge/ROADMAP.md', ref),
      this.adapter.readFile('product-knowledge/PROJECT_STATUS.md', ref),
      this.adapter.readFile('product-knowledge/claims.md', ref),
      this.adapter.listDirectory('specs', ref),
    ]);

    // Parse roadmap, status, and claims
    const roadmap = parseRoadmap(roadmapContent ?? '');
    const status = parseProjectStatus(statusContent ?? '');
    const claims = parseClaims(claimsContent ?? '');

    // Parse spec directories — need to read each directory's contents
    const specInputs = await this.buildSpecInputs(specDirs, ref);
    const specs = parseSpecDirectories(specInputs);

    return assembleBoardState(roadmap, specs, status, claims);
  }

  /** Get a single card by ID with full detail (spec contents). */
  async getCardDetail(cardId: string): Promise<{
    card: BoardCard;
    specContents?: Record<string, string>;
  } | null> {
    const board = await this.getBoardState();

    let foundCard: BoardCard | undefined;
    for (const column of board.columns) {
      foundCard = column.cards.find((c) => c.id === cardId);
      if (foundCard) break;
    }

    if (!foundCard) return null;

    // If the card has a spec entry, read all spec files
    let specContents: Record<string, string> | undefined;
    if (foundCard.specEntry) {
      specContents = {};
      const ref = this.activeBranch ?? undefined;
      for (const file of foundCard.specEntry.files) {
        const content = await this.adapter.readFile(
          `specs/${foundCard.specEntry.dirName}/${file}`,
          ref,
        );
        if (content) {
          specContents[file] = content;
        }
      }
    }

    return { card: foundCard, specContents };
  }

  /** Get the active branch. */
  async getActiveBranch(): Promise<string> {
    return this.activeBranch ?? (await this.adapter.getCurrentBranch());
  }

  /** Set the active branch. */
  setActiveBranch(branch: string): void {
    this.activeBranch = branch;
  }

  /** Build spec directory inputs by reading each spec directory. */
  private async buildSpecInputs(
    specDirs: Array<{ name: string; type: string; path: string }>,
    ref?: string,
  ): Promise<SpecDirectoryInput[]> {
    const inputs: SpecDirectoryInput[] = [];

    for (const dir of specDirs) {
      if (dir.type !== 'directory') continue;

      const files = await this.adapter.listDirectory(`specs/${dir.name}`, ref);
      const fileNames = files.filter((f) => f.type === 'file').map((f) => f.name);

      // Read tasks.md and README.md content for phase detection
      const [tasksContent, readmeContent] = await Promise.all([
        fileNames.includes('tasks.md')
          ? this.adapter.readFile(`specs/${dir.name}/tasks.md`, ref)
          : Promise.resolve(undefined),
        fileNames.includes('README.md')
          ? this.adapter.readFile(`specs/${dir.name}/README.md`, ref)
          : Promise.resolve(undefined),
      ]);

      inputs.push({
        dirName: dir.name,
        files: fileNames,
        tasksContent: tasksContent ?? undefined,
        readmeContent: readmeContent ?? undefined,
      });
    }

    return inputs;
  }
}
