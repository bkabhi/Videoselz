import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'videoselz.theme';

function readInitialTheme(): Theme {
  // index.html has already resolved and applied the theme before first paint,
  // so reading it back off the element keeps React in sync with what the user
  // is actually looking at — no flash, no second source of truth.
  const applied = document.documentElement.dataset.theme;
  return applied === 'dark' ? 'dark' : 'light';
}

export function useTheme(): { theme: Theme; toggleTheme: () => void } {
  const [theme, setTheme] = useState<Theme>(readInitialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Safari private mode throws on write. A non-persisted theme is a much
      // smaller problem than a crashed render.
    }
  }, [theme]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (event: MediaQueryListEvent) => {
      // Only follow the OS while the user has not made an explicit choice.
      // Overriding a deliberate selection because the sun went down would be
      // the interface arguing with its user.
      if (localStorage.getItem(STORAGE_KEY)) return;
      setTheme(event.matches ? 'dark' : 'light');
    };

    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
  }, []);

  return { theme, toggleTheme };
}
