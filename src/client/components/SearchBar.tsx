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
  /** Optional external ref to the underlying input element (e.g. for keyboard shortcut focus). */
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

const MATCH_TYPE_COLORS: Record<string, string> = {
  title: 'bg-blue-100 text-blue-700',
  spec: 'bg-green-100 text-green-700',
  comment: 'bg-purple-100 text-purple-700',
  claimant: 'bg-orange-100 text-orange-700',
};

export function SearchBar({ branch, onResultClick, inputRef: externalInputRef }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const internalInputRef = useRef<HTMLInputElement>(null);
  const inputRef = externalInputRef ?? internalInputRef;

  // Debounce the query by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Open dropdown when we have a debounced query with 2+ chars
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

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on Escape
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
    <div ref={containerRef} className="relative">
      <div className="flex items-center">
        <span className="absolute left-2 text-gray-400 text-sm pointer-events-none">
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
          placeholder="Search cards..."
          className="text-sm border border-gray-300 rounded px-2 py-1 pl-7 w-56 bg-white text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-80 bg-white border border-gray-200 rounded shadow-lg z-50 max-h-96 overflow-y-auto">
          {isLoading && (
            <div className="flex items-center justify-center py-4 text-sm text-gray-400">
              <svg
                className="animate-spin h-4 w-4 mr-2 text-blue-500"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Searching...
            </div>
          )}

          {!isLoading && data && data.results.length === 0 && (
            <div className="py-4 text-center text-sm text-gray-400">
              No results
            </div>
          )}

          {!isLoading && data && data.results.length > 0 && (
            <ul className="divide-y divide-gray-100">
              {data.results.map((result) => (
                <li key={`${result.cardId}-${result.matchType}`}>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
                    onClick={() => handleResultClick(result.cardId)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 truncate flex-1">
                        {result.title}
                      </span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 whitespace-nowrap">
                        {result.phase}
                      </span>
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded whitespace-nowrap ${MATCH_TYPE_COLORS[result.matchType] ?? 'bg-gray-100 text-gray-600'}`}
                      >
                        {result.matchType}
                      </span>
                    </div>
                    {result.matchContext && (
                      <p className="text-xs text-gray-500 mt-0.5 truncate">
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
