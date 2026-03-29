/**
 * RepoSelector Component
 *
 * Dropdown showing configured repos. Switching repos reloads the board.
 */

import React, { useState, useEffect } from 'react';
import { fetchRepos } from '../api.js';
import type { RepoInfo } from '../api.js';

interface RepoSelectorProps {
  currentRepo: string;
  onRepoChange: (repoId: string) => void;
}

export function RepoSelector({ currentRepo, onRepoChange }: RepoSelectorProps) {
  const [repos, setRepos] = useState<RepoInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { repos: repoList } = await fetchRepos();
        if (!cancelled) {
          setRepos(repoList);
        }
      } catch {
        // Silently ignore — single-repo mode fallback
        if (!cancelled) {
          setRepos([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Don't render if there's only one repo or loading failed
  if (loading || repos.length <= 1) {
    return null;
  }

  return (
    <select
      value={currentRepo}
      onChange={(e) => onRepoChange(e.target.value)}
      className="text-sm border border-gray-300 rounded px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
      aria-label="Select repository"
    >
      {repos.map((repo) => (
        <option key={repo.id} value={repo.id}>
          {repo.name}
        </option>
      ))}
    </select>
  );
}
