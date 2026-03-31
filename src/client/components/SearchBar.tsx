/**
 * SearchBar Component
 *
 * Debounced search input with dropdown results panel.
 * Uses @tanstack/react-query to fetch search results from the API.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { searchCards } from '../api.js';

interface SearchBarProps {
  branch?: string;
  onResultClick: (cardId: string) => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

const MATCH_TYPE_STYLE: Record<string, string> = {
  title: 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400',
  spec: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400',
  comment: 'bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400',
  claimant: 'bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400',
};

export function SearchBar({ branch, onResultClick, inputRef: externalInputRef }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const internalInputRef = useRef<HTMLInputElement>(null);
  const inputRef = externalInputRef ?? internalInputRef;

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (debouncedQuery.length >= 2) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [debouncedQuery]);

  const { data, isLoading } = useQuery({
    queryKey: ['search', debouncedQuery, branch],
    queryFn: () => searchCards(debouncedQuery, branch),
    enabled: debouncedQuery.length >= 2,
    staleTime: 10_000,
  });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  }, []);

  const handleResultClick = useCallback(
    (cardId: string) => {
      onResultClick(cardId);
      setIsOpen(false);
      setQuery('');
    },
    [onResultClick],
  );

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <span
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[0.75rem] pointer-events-none"
          style={{ color: 'var(--color-text-muted)' }}
        >
          &#128269;
        </span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (debouncedQuery.length >= 2) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search cards... ( / )"
          className="wh-input w-full pl-8 pr-3"
        />
      </div>

      {isOpen && (
        <div className="wh-dropdown absolute top-full left-0 mt-2 w-full min-w-[320px] z-50 max-h-96 overflow-y-auto">
          {isLoading && (
            <div className="flex items-center justify-center py-6 gap-2">
              <div
                className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: 'var(--color-border)', borderTopColor: 'transparent' }}
              />
              <span className="font-heading text-[0.75rem]" style={{ color: 'var(--color-text-muted)' }}>
                Searching...
              </span>
            </div>
          )}

          {!isLoading && data && data.results.length === 0 && (
            <div className="py-6 text-center">
              <span className="font-heading text-[0.75rem]" style={{ color: 'var(--color-text-muted)' }}>
                No results
              </span>
            </div>
          )}

          {!isLoading && data && data.results.length > 0 && (
            <ul style={{ borderColor: 'var(--color-border-subtle)' }}>
              {data.results.map((result) => (
                <li key={`${result.cardId}-${result.matchType}`}>
                  <button
                    type="button"
                    className="w-full text-left px-3.5 py-2.5 transition-colors wh-focus-ring"
                    style={{ background: 'transparent' }}
                    onClick={() => handleResultClick(result.cardId)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--color-surface-hover)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-heading text-[0.8rem] font-medium truncate flex-1" style={{ color: 'var(--color-text)' }}>
                        {result.title}
                      </span>
                      <span className="wh-badge bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400 whitespace-nowrap">
                        {result.phase}
                      </span>
                      <span
                        className={`wh-badge whitespace-nowrap ${MATCH_TYPE_STYLE[result.matchType] ?? 'bg-stone-100 text-stone-500'}`}
                      >
                        {result.matchType}
                      </span>
                    </div>
                    {result.matchContext && (
                      <p className="text-[0.7rem] mt-1 truncate" style={{ color: 'var(--color-text-muted)' }}>
                        {result.matchContext}
                      </p>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
