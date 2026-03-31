/**
 * Board Cache
 *
 * Diff-based cache invalidation for board API responses.
 * Stores responses keyed by route + branch, and invalidates when the
 * underlying SHA changes (i.e., new commits have been pushed).
 */

import { createHash } from 'node:crypto';

interface CacheEntry {
  data: unknown;
  sha: string;
  etag: string;
}

export class BoardCache {
  private cache: Map<string, CacheEntry> = new Map();

  /**
   * Get a cached response if the SHA hasn't changed.
   * Returns null on cache miss or when the SHA has changed.
   */
  get(key: string, currentSha: string): { data: unknown; etag: string } | null {
    const entry = this.cache.get(key);
    if (!entry || entry.sha !== currentSha) {
      return null;
    }
    return { data: entry.data, etag: entry.etag };
  }

  /**
   * Store a response in the cache.
   * @returns The generated ETag string.
   */
  set(key: string, data: unknown, sha: string): string {
    const etag = this.generateEtag(data);
    this.cache.set(key, { data, sha, etag });
    return etag;
  }

  /** Clear all cache entries. */
  clear(): void {
    this.cache.clear();
  }

  private generateEtag(data: unknown): string {
    const hash = createHash('sha256')
      .update(JSON.stringify(data))
      .digest('hex')
      .slice(0, 16);
    return `"${hash}"`;
  }
}
