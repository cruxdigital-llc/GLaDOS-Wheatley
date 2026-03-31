/**
 * Shared parser utilities
 */

/** Normalize CRLF to LF and trim trailing whitespace */
export function normalize(content: string): string {
  return content.replace(/\r\n/g, '\n').trimEnd();
}

/** Strip the optional GLaDOS HTML comment header */
export function stripHeader(content: string): string {
  return content.replace(/^<!--[\s\S]*?-->\s*\n?/, '');
}
