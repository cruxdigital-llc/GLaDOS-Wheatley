/**
 * SettingsMenu Component
 *
 * Gear icon button that opens a dropdown with dark mode selector,
 * toggle options for activity feed / branch status / view all branches,
 * and an edit display name option.
 */

import React, { useState, useEffect, useRef } from 'react';

type Theme = 'light' | 'dark' | 'system';

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem('wheatley_theme');
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch { /* ignore */ }
  return 'system';
}

function applyTheme(theme: Theme): void {
  const effective = theme === 'system' ? getSystemTheme() : theme;
  if (effective === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

interface SettingsMenuProps {
  showActivityFeed: boolean;
  onToggleActivityFeed: () => void;
  showHealthPanel: boolean;
  onToggleHealthPanel: () => void;
  viewAllBranches: boolean;
  onToggleViewAllBranches: () => void;
  onEditDisplayName: () => void;
}

export function SettingsMenu({
  showActivityFeed,
  onToggleActivityFeed,
  showHealthPanel,
  onToggleHealthPanel,
  viewAllBranches,
  onToggleViewAllBranches,
  onEditDisplayName,
}: SettingsMenuProps) {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem('wheatley_theme', theme);
  }, [theme]);

  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme('system');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const themeOptions: { value: Theme; label: string; icon: string }[] = [
    { value: 'light', label: 'Light', icon: '\u2600' },
    { value: 'dark', label: 'Dark', icon: '\u263E' },
    { value: 'system', label: 'Auto', icon: '\u2699' },
  ];

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        title="Settings"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.573-1.066z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-40 py-1">
          {/* Theme selector */}
          <div className="px-3 py-2">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Theme</span>
            <div className="flex gap-1 mt-1.5">
              {themeOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTheme(opt.value)}
                  className={`flex-1 text-xs px-2 py-1.5 rounded border transition-colors ${
                    theme === opt.value
                      ? 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900 dark:text-blue-300 dark:border-blue-600 font-medium'
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600'
                  }`}
                >
                  {opt.icon} {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Toggle options */}
          <div className="border-t border-gray-100 dark:border-gray-700 py-1">
            <button
              type="button"
              onClick={() => { onToggleActivityFeed(); }}
              className="w-full text-left px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-between"
            >
              <span>Activity feed</span>
              <span className={`w-3 h-3 rounded-sm border ${showActivityFeed ? 'bg-blue-500 border-blue-500' : 'border-gray-300 dark:border-gray-600'}`} />
            </button>
            <button
              type="button"
              onClick={() => { onToggleHealthPanel(); }}
              className="w-full text-left px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-between"
            >
              <span>Branch status</span>
              <span className={`w-3 h-3 rounded-sm border ${showHealthPanel ? 'bg-blue-500 border-blue-500' : 'border-gray-300 dark:border-gray-600'}`} />
            </button>
            <button
              type="button"
              onClick={() => { onToggleViewAllBranches(); }}
              className="w-full text-left px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-between"
            >
              <span>View all branches</span>
              <span className={`w-3 h-3 rounded-sm border ${viewAllBranches ? 'bg-blue-500 border-blue-500' : 'border-gray-300 dark:border-gray-600'}`} />
            </button>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-100 dark:border-gray-700 py-1">
            <button
              type="button"
              onClick={() => {
                onEditDisplayName();
                setOpen(false);
              }}
              className="w-full text-left px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Edit display name
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
