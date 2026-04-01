/**
 * Spec Summarizer
 *
 * Generates a one-line summary for a spec's SPEC_LOG entry.
 * Strategy: Claude CLI (--print) → README.md extraction → directory name fallback.
 */

import { execFile } from 'node:child_process';

const CLAUDE_CMD = process.env['WHEATLEY_GLADOS_CMD'] ?? 'claude';
const SUMMARIZE_TIMEOUT_MS = 30_000;

/**
 * Generate a one-line summary for a spec directory's contents.
 *
 * @param specContents - Map of filename → content for all files in the spec dir
 * @param specDirName  - The spec directory name (e.g., "2026-04-01_feature_user-auth")
 * @returns A concise summary string (max ~120 chars)
 */
export async function summarizeSpec(
  specContents: Record<string, string>,
  specDirName: string,
): Promise<string> {
  // 1. Try Claude CLI for an AI-generated summary
  try {
    const summary = await summarizeViaClaude(specContents);
    if (summary) return summary;
  } catch {
    // Fall through to next strategy
  }

  // 2. Extract from README.md ## Summary section
  const readme = specContents['README.md'];
  if (readme) {
    const extracted = extractSummaryFromReadme(readme);
    if (extracted) return extracted;
  }

  // 3. Fall back to directory name → title case
  return dirNameToTitle(specDirName);
}

/**
 * Spawn `claude --print` to generate a one-line summary.
 */
async function summarizeViaClaude(specContents: Record<string, string>): Promise<string | null> {
  const combined = Object.entries(specContents)
    .map(([name, content]) => `=== ${name} ===\n${content}`)
    .join('\n\n');

  // Truncate to avoid overwhelming the context
  const truncated = combined.slice(0, 8000);

  const prompt = [
    'Summarize this feature spec in exactly one sentence for a changelog entry.',
    'The sentence should describe what was built, not how. Max 120 characters.',
    'Reply with ONLY the summary sentence, no quotes or punctuation prefix.',
    '',
    truncated,
  ].join('\n');

  return new Promise((resolve) => {
    const child = execFile(
      CLAUDE_CMD,
      ['--print', '-p', prompt],
      { timeout: SUMMARIZE_TIMEOUT_MS, maxBuffer: 1024 * 64 },
      (error, stdout) => {
        if (error) {
          resolve(null);
          return;
        }
        const line = stdout.trim().split('\n')[0]?.trim();
        resolve(line && line.length > 0 && line.length <= 200 ? line : null);
      },
    );

    // Safety: kill if it hasn't resolved
    child.on('error', () => resolve(null));
  });
}

/**
 * Extract the first meaningful line from a ## Summary section in README.md.
 */
function extractSummaryFromReadme(readme: string): string | null {
  const summaryMatch = readme.match(/^##\s+Summary\s*\n+(.+)/m);
  if (summaryMatch) {
    const line = summaryMatch[1].trim();
    if (line && !line.startsWith('#') && !line.startsWith('{')) {
      return line.slice(0, 200);
    }
  }

  // Try ## Goals as fallback
  const goalsMatch = readme.match(/^##\s+Goals\s*\n+[-*]\s*(.+)/m);
  if (goalsMatch) {
    return goalsMatch[1].trim().slice(0, 200);
  }

  return null;
}

/**
 * Convert a spec directory name to a human-readable title.
 * "2026-04-01_feature_user-authentication" → "User authentication"
 */
function dirNameToTitle(dirName: string): string {
  // Strip date and prefix
  const parts = dirName.split('_');
  // Skip date (YYYY-MM-DD) and prefix (feature, fix, etc.)
  const nameParts = parts.slice(2);
  const name = nameParts.join('-');
  // kebab-case to sentence case
  const title = name.replace(/-/g, ' ');
  return title.charAt(0).toUpperCase() + title.slice(1);
}
