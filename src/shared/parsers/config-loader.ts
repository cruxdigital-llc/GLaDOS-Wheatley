/**
 * Parser Config Loader
 *
 * Reads parser configuration from a repository's `wheatley.config.json` file,
 * falling back to the default GLaDOS preset when no config is found.
 */

import type { GitAdapter } from '../../server/git/types.js';
import { PARSER_PRESETS, type ParserConfig } from './parser-config.js';

/**
 * Regex that detects nested quantifiers — a common source of ReDoS.
 * Matches patterns like (a+)+, (a*)+, (a+)*, (a*)*, etc.
 */
const REDOS_PATTERN = /\([^)]*[+*][^)]*\)[+*]/;

/**
 * Validate that a raw object is a valid ParserConfig.
 * Throws on invalid input.
 */
export function validateParserConfig(raw: unknown): ParserConfig {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Parser config must be a non-null object');
  }

  const obj = raw as Record<string, unknown>;

  // Required string fields
  const stringFields = ['name', 'sectionPattern', 'subSectionPattern', 'itemPattern'] as const;
  for (const field of stringFields) {
    if (typeof obj[field] !== 'string' || (obj[field] as string).length === 0) {
      throw new Error(`Parser config field "${field}" must be a non-empty string`);
    }
  }

  // Validate regex compilation and reject ReDoS-prone patterns
  const regexFields = ['sectionPattern', 'subSectionPattern', 'itemPattern'] as const;
  for (const field of regexFields) {
    const pattern = obj[field] as string;
    try {
      new RegExp(pattern);
    } catch {
      throw new Error(`Parser config field "${field}" contains an invalid regex: ${pattern}`);
    }
    if (REDOS_PATTERN.test(pattern)) {
      throw new Error(
        `Parser config field "${field}" contains a potentially unsafe regex with nested quantifiers`,
      );
    }
  }

  // Validate captures
  if (!obj['captures'] || typeof obj['captures'] !== 'object') {
    throw new Error('Parser config must include a "captures" object');
  }
  const captures = obj['captures'] as Record<string, unknown>;
  for (const key of ['id', 'title', 'status']) {
    if (typeof captures[key] !== 'number' || !Number.isInteger(captures[key])) {
      throw new Error(`Parser config captures.${key} must be an integer`);
    }
    if ((captures[key] as number) < 0) {
      throw new Error(`Parser config captures.${key} must be >= 0`);
    }
  }

  // Verify capture indices don't exceed the number of groups in the item pattern
  const itemRegex = new RegExp(obj['itemPattern'] as string);
  const groupCount = (new RegExp(itemRegex.source + '|')).exec('')!.length - 1;
  const maxIndex = Math.max(captures['id'] as number, captures['title'] as number, captures['status'] as number);
  if (maxIndex > groupCount && (captures['id'] as number) !== 0) {
    throw new Error(
      `Capture group index ${maxIndex} exceeds the number of groups (${groupCount}) in itemPattern`,
    );
  }

  return {
    name: obj['name'] as string,
    sectionPattern: obj['sectionPattern'] as string,
    subSectionPattern: obj['subSectionPattern'] as string,
    itemPattern: obj['itemPattern'] as string,
    captures: {
      id: captures['id'] as number,
      title: captures['title'] as number,
      status: captures['status'] as number,
    },
  };
}

/**
 * Load parser configuration from the repository.
 *
 * Reads `wheatley.config.json` from the repo root. If the file contains a
 * `parser` key that is a preset name string, the matching preset is returned.
 * If `parser` is an inline config object it is validated and returned.
 * Falls back to the `glados` preset when no config is found.
 */
export async function loadParserConfig(adapter: GitAdapter): Promise<ParserConfig> {
  const content = await adapter.readFile('wheatley.config.json');
  if (content) {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(content) as Record<string, unknown>;
    } catch {
      // Malformed JSON — fall through to default
      return PARSER_PRESETS['glados'];
    }

    if (typeof parsed['parser'] === 'string' && PARSER_PRESETS[parsed['parser']]) {
      return PARSER_PRESETS[parsed['parser']];
    }
    if (parsed['parser'] && typeof parsed['parser'] === 'object') {
      return validateParserConfig(parsed['parser']);
    }
  }
  return PARSER_PRESETS['glados'];
}
