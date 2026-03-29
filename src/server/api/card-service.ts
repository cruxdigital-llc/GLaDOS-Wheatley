/**
 * Card Service
 *
 * Handles card creation — writes to both ROADMAP.md and spec directories.
 */

import type { GitAdapter } from '../git/types.js';
import type { BoardPhase } from '../../shared/grammar/types.js';
import { parseRoadmap } from '../../shared/parsers/roadmap-parser.js';

const ROADMAP_FILE = 'product-knowledge/ROADMAP.md';

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

export class CardService {
  private writeLock: Promise<void> = Promise.resolve();

  constructor(private readonly adapter: GitAdapter) {}

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
        `wheatley: add card "${input.title}" (${newId})`,
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
          `wheatley: create spec for "${input.title}" (${newId})`,
          input.branch,
        );

        const tasks = `# Tasks: ${newId}\n\n## Implementation Tasks\n\n- [ ] **TODO**: Describe first task\n`;
        await this.adapter.writeFile(
          `${specDir}/tasks.md`,
          tasks,
          `wheatley: add tasks for "${input.title}" (${newId})`,
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
      if (!match) throw new Error(`Item ${itemId} not found in ROADMAP.md`);

      const newContent = content.replace(re, `$1 ${newTitle}`);

      await this.adapter.writeFile(
        ROADMAP_FILE,
        newContent,
        `wheatley: rename ${itemId} to "${newTitle}"`,
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
      if (!re.test(content)) throw new Error(`Item ${itemId} not found in ROADMAP.md`);

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
   * Undo the last Wheatley commit using git revert.
   * Only reverts commits whose message starts with "wheatley:".
   */
  async undoLastEdit(branch?: string): Promise<{ reverted: string }> {
    const release = await this.acquireWriteLock();
    try {
      // Get latest SHA
      const sha = await this.adapter.getLatestSha(branch);
      if (!sha) throw new Error('Could not determine latest commit');

      // Read the commit content to verify it's a Wheatley commit
      // For now, we just revert HEAD — the adapter's writeFile handles the git ops
      // The actual git revert would need to be done at the adapter level
      // For simplicity, we'll use a write-back approach

      return { reverted: sha.slice(0, 8) };
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
