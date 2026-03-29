/**
 * Frontmatter Parser
 *
 * Parses YAML frontmatter from markdown content (labels, priority, due date).
 * Uses simple line-by-line parsing — no YAML library dependency.
 */

export interface CardMetadata {
  labels: string[];
  priority: 'P0' | 'P1' | 'P2' | 'P3' | null;
  due: string | null; // ISO date string YYYY-MM-DD
}

const VALID_PRIORITIES = new Set(['P0', 'P1', 'P2', 'P3']);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const FRONTMATTER_DELIMITER = '---';

function defaultMetadata(): CardMetadata {
  return { labels: [], priority: null, due: null };
}

/**
 * Extract frontmatter between `---` delimiters and parse metadata fields.
 * Returns defaults (empty labels, null priority, null due) if no frontmatter.
 */
export function parseFrontmatter(content: string): CardMetadata {
  const meta = defaultMetadata();
  const trimmed = content.trimStart();

  if (!trimmed.startsWith(FRONTMATTER_DELIMITER)) {
    return meta;
  }

  // Find closing delimiter
  const afterFirst = trimmed.indexOf('\n');
  if (afterFirst === -1) return meta;

  const rest = trimmed.slice(afterFirst + 1);
  const closeIdx = rest.indexOf(`\n${FRONTMATTER_DELIMITER}`);
  if (closeIdx === -1) return meta;

  const block = rest.slice(0, closeIdx);
  const lines = block.split('\n');

  let inLabels = false;

  for (const line of lines) {
    const stripped = line.trim();
    if (!stripped) {
      inLabels = false;
      continue;
    }

    // Check for label list items
    if (inLabels && stripped.startsWith('- ')) {
      const value = stripped.slice(2).trim();
      if (value) {
        meta.labels.push(value);
      }
      continue;
    }

    // Key-value pairs
    const colonIdx = stripped.indexOf(':');
    if (colonIdx === -1) {
      inLabels = false;
      continue;
    }

    const key = stripped.slice(0, colonIdx).trim();
    const val = stripped.slice(colonIdx + 1).trim();

    if (key === 'labels') {
      inLabels = true;
      // labels might be inline: labels: [] or labels: (empty, list follows)
      continue;
    }

    inLabels = false;

    if (key === 'priority' && VALID_PRIORITIES.has(val)) {
      meta.priority = val as CardMetadata['priority'];
    } else if (key === 'due' && DATE_RE.test(val)) {
      meta.due = val;
    }
  }

  return meta;
}

/**
 * Merge new metadata into existing frontmatter. If no frontmatter exists,
 * create one. Preserves the rest of the markdown content after the frontmatter block.
 */
export function updateFrontmatter(content: string, metadata: Partial<CardMetadata>): string {
  // Parse existing metadata so we can merge
  const existing = parseFrontmatter(content);

  // Merge: provided fields override existing
  const merged: CardMetadata = {
    labels: metadata.labels !== undefined ? metadata.labels : existing.labels,
    priority: metadata.priority !== undefined ? metadata.priority : existing.priority,
    due: metadata.due !== undefined ? metadata.due : existing.due,
  };

  // Build frontmatter block
  const fmLines: string[] = [FRONTMATTER_DELIMITER];

  if (merged.labels.length > 0) {
    fmLines.push('labels:');
    for (const label of merged.labels) {
      fmLines.push(`  - ${label}`);
    }
  }

  if (merged.priority) {
    fmLines.push(`priority: ${merged.priority}`);
  }

  if (merged.due) {
    fmLines.push(`due: ${merged.due}`);
  }

  fmLines.push(FRONTMATTER_DELIMITER);

  // Strip existing frontmatter from content to get the body
  const body = stripFrontmatter(content);

  // Reassemble: only add frontmatter if there's something to write
  const hasMeta = merged.labels.length > 0 || merged.priority || merged.due;
  if (!hasMeta) {
    return body;
  }

  return fmLines.join('\n') + '\n' + body;
}

/**
 * Remove existing frontmatter block from content, returning just the body.
 */
function stripFrontmatter(content: string): string {
  const trimmed = content.trimStart();

  if (!trimmed.startsWith(FRONTMATTER_DELIMITER)) {
    return content;
  }

  const afterFirst = trimmed.indexOf('\n');
  if (afterFirst === -1) return content;

  const rest = trimmed.slice(afterFirst + 1);
  const closeIdx = rest.indexOf(`\n${FRONTMATTER_DELIMITER}`);
  if (closeIdx === -1) return content;

  // Skip past the closing delimiter line
  const afterClose = rest.indexOf('\n', closeIdx + 1);
  if (afterClose === -1) {
    return '';
  }

  return rest.slice(afterClose + 1);
}
