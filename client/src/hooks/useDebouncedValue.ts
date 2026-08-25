import { useEffect, useState } from 'react';

/**
 * Trails `value` by `delay` ms.
 *
 * The search box is bound to state immediately (so typing never feels laggy)
 * but the request is driven by the debounced copy, which turns a ten-character
 * query into one round trip instead of ten.
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
