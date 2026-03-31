/**
 * Parser Configuration
 *
 * Defines a schema for configurable roadmap/task parsers so that different
 * Markdown conventions can be supported without code changes.
 */

export interface ParserConfig {
  /** Config format name */
  name: string;
  /** Pattern for matching roadmap section headers (e.g., "## Phase N: Title") */
  sectionPattern: string;
  /** Pattern for matching sub-section headers (e.g., "### N.M Title") */
  subSectionPattern: string;
  /** Pattern for matching task items (e.g., "- [x] N.M.K Title") */
  itemPattern: string;
  /** Capture groups: which group is the ID, which is the title, which is the status */
  captures: {
    id: number;      // Capture group index for item ID (0 = auto-generate)
    title: number;   // Capture group index for item title
    status: number;  // Capture group index for checkbox (e.g., 'x' or ' ')
  };
}

export const PARSER_PRESETS: Record<string, ParserConfig> = {
  glados: {
    name: 'glados',
    sectionPattern: '^## Phase (\\d+): (.+)$',
    subSectionPattern: '^### (\\d+\\.\\d+) (.+)$',
    itemPattern: '^- \\[([ x])\\] (\\d+\\.\\d+\\.\\d+) (.+)$',
    captures: { status: 1, id: 2, title: 3 },
  },
  flat: {
    name: 'flat',
    sectionPattern: '^## (.+)$',
    subSectionPattern: '^### (.+)$',
    itemPattern: '^- \\[([ x])\\] (.+)$',
    captures: { status: 1, id: 0, title: 2 }, // id=0 means auto-generate
  },
  jira: {
    name: 'jira',
    sectionPattern: '^## (.+)$',
    subSectionPattern: '^### (.+)$',
    itemPattern: '^- \\[([ x])\\] ([A-Z]+-\\d+) (.+)$',
    captures: { status: 1, id: 2, title: 3 },
  },
};
