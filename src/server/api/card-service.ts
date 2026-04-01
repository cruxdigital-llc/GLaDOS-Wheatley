/**
 * Card Service
 *
 * Handles card creation, deletion, and archival.
 * Writes to both ROADMAP.md and spec directories.
 */

import type { GitAdapter } from '../git/types.js';
import type { BoardPhase } from '../../shared/grammar/types.js';
import type { BoardService } from './board-service.js';
import { parseRoadmap } from '../../shared/parsers/roadmap-parser.js';
import { summarizeSpec } from './summarizer.js';

const ROADMAP_FILE = 'product-knowledge/ROADMAP.md';
const SPEC_LOG_FILE = 'product-knowledge/SPEC_LOG.md';

/** Sanitize a string for use in git commit messages (strip newlines and control chars). */
function sanitizeForCommit(value: string): string {
  return value.replace(/[\r\n\x00-\x1f]/g, ' ').trim().slice(0, 200);
}

/** Error thrown when a card is not found. */
export class CardNotFoundError extends Error {
  constructor(itemId: string) {
    super(`Item ${itemId} not found in ROADMAP.md`);
    this.name = 'CardNotFoundError';
  }
}

export interface CreateCardInput {
  title: string;
  phase?: BoardPhase;
  /** Parent section number (e.g., "1.1" or "2.3"). If omitted, appends to a new section. */
  section?: string;
  branch?: string;
}

export interface CreateCardResult {
  id: string;
  title: string;
  phase: BoardPhase;
  specDir?: string;
}

export interface ArchiveCardResult {
  id: string;
  specDir: string;
  specLogEntry: string;
}

/** Error thrown when a card cannot be archived (wrong phase). */
export class CardNotArchivableError extends Error {
  constructor(itemId: string, phase: string) {
    super(`Card ${itemId} is in '${phase}' phase — only 'done' cards can be archived`);
    this.name = 'CardNotArchivableError';
  }
}

export class CardService {
  private writeLock: Promise<void> = Promise.resolve();

  constructor(
    private readonly adapter: GitAdapter,
    private readonly boardService?: BoardService,
  ) {}

  private acquireWriteLock(): Promise<() => void> {
    let release: () => void;
    const next = new Promise<void>(resolve => { release = resolve; });
    const prev = this.writeLock;
    this.writeLock = next;
    return prev.then(() => release!);
  }

  /**
   * Create a new card: append a roadmap item and optionally create a spec directory.
   */
  async createCard(input: CreateCardInput): Promise<CreateCardResult> {
    const release = await this.acquireWriteLock();
    try {
      const phase = input.phase ?? 'unclaimed';
      const content = await this.adapter.readFile(ROADMAP_FILE, input.branch);
      if (!content) {
        throw new Error('ROADMAP.md not found');
      }

      const parsed = parseRoadmap(content);
      const { newId, newContent } = this.appendItem(content, parsed, input.title, input.section);

      await this.adapter.writeFile(
        ROADMAP_FILE,
        newContent,
        `wheatley: add card "${sanitizeForCommit(input.title)}" (${newId})`,
        input.branch,
      );

      // If phase is beyond unclaimed, create spec directory
      let specDir: string | undefined;
      if (phase !== 'unclaimed') {
        specDir = this.buildSpecDir(newId);
        const readme = `# Feature: ${input.title}\n\n## Summary\n\n_TODO: Describe what this feature does._\n`;
        await this.adapter.writeFile(
          `${specDir}/README.md`,
          readme,
          `wheatley: create spec for "${sanitizeForCommit(input.title)}" (${newId})`,
          input.branch,
        );

        const tasks = `# Tasks: ${newId}\n\n## Implementation Tasks\n\n- [ ] **TODO**: Describe first task\n`;
        await this.adapter.writeFile(
          `${specDir}/tasks.md`,
          tasks,
          `wheatley: add tasks for "${sanitizeForCommit(input.title)}" (${newId})`,
          input.branch,
        );
      }

      return { id: newId, title: input.title, phase, specDir };
    } finally {
      release();
    }
  }

  /**
   * Append a new item to the roadmap content and return the new ID and updated content.
   */
  private appendItem(
    content: string,
    parsed: ReturnType<typeof parseRoadmap>,
    title: string,
    sectionStr?: string,
  ): { newId: string; newContent: string } {
    if (sectionStr) {
      return this.appendToSection(content, parsed, title, sectionStr);
    }
    return this.appendToLastSection(content, parsed, title);
  }

  private appendToSection(
    content: string,
    parsed: ReturnType<typeof parseRoadmap>,
    title: string,
    sectionStr: string,
  ): { newId: string; newContent: string } {
    // Find the highest item number in the target section
    const sectionParts = sectionStr.split('.').map(Number);
    const phase = sectionParts[0];
    const section = sectionParts[1] ?? 1;

    const itemsInSection = parsed.allItems.filter(
      i => i.phase === phase && i.section === section,
    );
    const maxItem = itemsInSection.reduce((max, i) => Math.max(max, i.item), 0);
    const newItemNum = maxItem + 1;
    const newId = `${phase}.${section}.${newItemNum}`;
    const newLine = `- [ ] ${newId} ${title}`;

    if (itemsInSection.length > 0) {
      // Insert after the last item in the section
      const lastItem = itemsInSection[itemsInSection.length - 1];
      const lastItemPattern = `- [${lastItem.completed ? 'x' : ' '}] ${lastItem.id} ${lastItem.title}`;
      const idx = content.indexOf(lastItemPattern);
      if (idx !== -1) {
        const endOfLine = content.indexOf('\n', idx);
        const insertPos = endOfLine !== -1 ? endOfLine : content.length;
        const newContent = content.slice(0, insertPos) + '\n' + newLine + content.slice(insertPos);
        return { newId, newContent };
      }
    }

    // Fallback: append to the end
    return { newId, newContent: content.trimEnd() + '\n' + newLine + '\n' };
  }

  private appendToLastSection(
    content: string,
    parsed: ReturnType<typeof parseRoadmap>,
    title: string,
  ): { newId: string; newContent: string } {
    if (parsed.phases.length === 0) {
      const newId = '1.1.1';
      const newLine = `- [ ] ${newId} ${title}`;
      return { newId, newContent: content.trimEnd() + '\n\n## Phase 1: New\n\n### 1.1 General\n\n' + newLine + '\n' };
    }

    // Find the last phase and section
    const lastPhase = parsed.phases[parsed.phases.length - 1];
    const lastSection = lastPhase.sections[lastPhase.sections.length - 1];
    const lastItems = lastSection?.items ?? [];

    if (lastItems.length > 0) {
      const lastItem = lastItems[lastItems.length - 1];
      const newItemNum = lastItem.item + 1;
      const newId = `${lastItem.phase}.${lastItem.section}.${newItemNum}`;
      const newLine = `- [ ] ${newId} ${title}`;

      const lastItemPattern = `- [${lastItem.completed ? 'x' : ' '}] ${lastItem.id} ${lastItem.title}`;
      const idx = content.indexOf(lastItemPattern);
      if (idx !== -1) {
        const endOfLine = content.indexOf('\n', idx);
        const insertPos = endOfLine !== -1 ? endOfLine : content.length;
        return { newId, newContent: content.slice(0, insertPos) + '\n' + newLine + content.slice(insertPos) };
      }
    }

    // Absolute fallback
    const newId = `${lastPhase.number}.1.1`;
    const newLine = `- [ ] ${newId} ${title}`;
    return { newId, newContent: content.trimEnd() + '\n' + newLine + '\n' };
  }

  /**
   * Rename a card by updating its title in ROADMAP.md.
   */
  async renameCard(itemId: string, newTitle: string, branch?: string): Promise<void> {
    const release = await this.acquireWriteLock();
    try {
      const content = await this.adapter.readFile(ROADMAP_FILE, branch);
      if (!content) throw new Error('ROADMAP.md not found');

      // Match the item line: - [ ] ID Title  or  - [x] ID Title
      const escapedId = itemId.replace(/\./g, '\\.');
      const re = new RegExp(`^(- \\[[x ]\\] ${escapedId}) .+$`, 'm');
      const match = content.match(re);
      if (!match) throw new CardNotFoundError(itemId);

      const newContent = content.replace(re, `$1 ${newTitle}`);

      await this.adapter.writeFile(
        ROADMAP_FILE,
        newContent,
        `wheatley: rename ${itemId} to "${sanitizeForCommit(newTitle)}"`,
        branch,
      );
    } finally {
      release();
    }
  }

  /**
   * Delete (archive) a card by removing its line from ROADMAP.md.
   */
  async deleteCard(itemId: string, branch?: string): Promise<void> {
    const release = await this.acquireWriteLock();
    try {
      const content = await this.adapter.readFile(ROADMAP_FILE, branch);
      if (!content) throw new Error('ROADMAP.md not found');

      const escapedId = itemId.replace(/\./g, '\\.');
      const re = new RegExp(`^- \\[[x ]\\] ${escapedId} .+\\n?`, 'm');
      if (!re.test(content)) throw new CardNotFoundError(itemId);

      const newContent = content.replace(re, '');

      await this.adapter.writeFile(
        ROADMAP_FILE,
        newContent,
        `wheatley: archive ${itemId}`,
        branch,
      );
    } finally {
      release();
    }
  }

  /**
   * Archive a done card: log to SPEC_LOG.md, delete spec directory, remove from ROADMAP.md.
   */
  async archiveCard(itemId: string, branch?: string): Promise<ArchiveCardResult> {
    if (!this.boardService) {
      throw new Error('BoardService is required for archiveCard');
    }

    const release = await this.acquireWriteLock();
    try {
      // 1. Get board state and find the card
      const board = await this.boardService.getBoardState(branch);
      const card = board.cards.find(c => c.id === itemId);
      if (!card) throw new CardNotFoundError(itemId);
      if (card.phase !== 'done') throw new CardNotArchivableError(itemId, card.phase);

      const specDir = card.specEntry?.dirName;
      if (!specDir) {
        throw new Error(`Card ${itemId} has no associated spec directory`);
      }

      // 2. Read spec contents for summary generation
      const specContents: Record<string, string> = {};
      const specFiles = card.specEntry?.files ?? [];
      for (const file of specFiles) {
        const content = await this.adapter.readFile(`specs/${specDir}/${file}`, branch);
        if (content) {
          specContents[file] = content;
        }
      }

      // 3. Generate summary
      const summary = await summarizeSpec(specContents, specDir);

      // 4. Get latest commit SHA (short form for the table)
      const sha = await this.adapter.getLatestSha(branch);
      const shortSha = sha ? sha.slice(0, 7) : 'unknown';

      // 5. Read or initialize SPEC_LOG.md
      const today = new Date().toISOString().slice(0, 10);
      let specLog = await this.adapter.readFile(SPEC_LOG_FILE, branch);
      if (!specLog) {
        specLog = [
          '# Spec Log',
          '',
          'Historical record of all feature specifications.',
          'Each entry includes the merge commit where the work landed — use',
          '`git show <hash>` to see the full diff.',
          '',
          'Entries are in reverse chronological order (newest first).',
          '',
          '---',
          '',
          '## Implemented',
          '',
          '| Date | Spec | Merge Commit | Summary |',
          '|------|------|:------------:|---------|',
          '',
        ].join('\n');
      }

      // 6. Append entry (insert after the table header row)
      const specLogEntry = `| ${today} | ${specDir} | ${shortSha} | ${sanitizeForCommit(summary)} |`;
      const tableHeaderRe = /(\|[-\s:|]+\|[-\s:|]+\|[-\s:|]+\|[-\s:|]+\|)\n/;
      if (tableHeaderRe.test(specLog)) {
        specLog = specLog.replace(tableHeaderRe, `$1\n${specLogEntry}\n`);
      } else {
        specLog = specLog.trimEnd() + '\n' + specLogEntry + '\n';
      }

      // 7. Write SPEC_LOG.md
      await this.adapter.writeFile(
        SPEC_LOG_FILE,
        specLog,
        `wheatley: log archived spec ${itemId} (${specDir})`,
        branch,
      );

      // 8. Delete spec directory
      const filePaths = specFiles.map(f => `specs/${specDir}/${f}`);
      if (filePaths.length > 0) {
        await this.adapter.deleteFiles(
          filePaths,
          `wheatley: remove spec directory ${specDir}`,
          branch,
        );
      }

      // 9. Remove from ROADMAP.md
      const roadmapContent = await this.adapter.readFile(ROADMAP_FILE, branch);
      if (roadmapContent) {
        const escapedId = itemId.replace(/\./g, '\\.');
        const re = new RegExp(`^- \\[[x ]\\] ${escapedId} .+\\n?`, 'm');
        if (re.test(roadmapContent)) {
          const newContent = roadmapContent.replace(re, '');
          await this.adapter.writeFile(
            ROADMAP_FILE,
            newContent,
            `wheatley: remove archived card ${itemId} from roadmap`,
            branch,
          );
        }
      }

      return { id: itemId, specDir, specLogEntry };
    } finally {
      release();
    }
  }

  private buildSpecDir(itemId: string): string {
    const today = new Date().toISOString().slice(0, 10);
    const slug = itemId.replace(/\./g, '-');
    return `specs/${today}_feature_${slug}`;
  }
}
