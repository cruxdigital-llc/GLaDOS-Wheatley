/**
 * Dark Mode Toggle
 *
 * Toggles between light and dark mode. Respects system preference initially,
 * allows manual override stored in localStorage.
 */

import React, { useState, useEffect } from 'react';

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

export function DarkModeToggle() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem('wheatley_theme', theme);
  }, [theme]);

  // Listen for system preference changes
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme('system');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  const cycle = () => {
    setTheme((prev) => {
      if (prev === 'light') return 'dark';
      if (prev === 'dark') return 'system';
      return 'light';
    });
  };

  const icons: Record<Theme, string> = {
    light: '\u2600', // sun
    dark: '\u263E',  // moon
    system: '\u2699', // gear
  };

  return (
    <button
      type="button"
      onClick={cycle}
      className="text-sm px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
      title={`Theme: ${theme}`}
    >
      {icons[theme]} {theme === 'system' ? 'Auto' : theme === 'dark' ? 'Dark' : 'Light'}
    </button>
  );
}
