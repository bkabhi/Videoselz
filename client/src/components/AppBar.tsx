import { useEffect, useState } from 'react';
import { Button } from './Button';
import { Logomark, Moon, Pulse, Sun } from './Icon';
import { api } from '@/lib/api';
import type { Theme } from '@/hooks/useTheme';
import styles from './AppBar.module.scss';

type ConnectionState = 'checking' | 'online' | 'offline';

/** Slow enough not to spam the log, fast enough to notice a restarted API. */
const HEALTH_POLL_MS = 20_000;

interface AppBarProps {
  theme: Theme;
  onToggleTheme: () => void;
  onSimulate: () => void;
  isSimulating: boolean;
}

export function AppBar({ theme, onToggleTheme, onSimulate, isSimulating }: AppBarProps) {
  const connection = useConnectionState();

  return (
    <header className={styles.bar}>
      <div className={styles.brand}>
        <Logomark className={styles.mark} />
        <span className={styles.wordmark}>Videoselz</span>
        <span className={styles.divider} aria-hidden="true" />
        <span className={styles.section}>Video performance</span>
      </div>

      <div className={styles.actions}>
        <span
          className={[
            styles.status,
            connection === 'online' ? styles.online : null,
            connection === 'offline' ? styles.offline : null,
          ]
            .filter(Boolean)
            .join(' ')}
          // Polite: a connection blip should not interrupt what the merchant
          // is reading, but it should eventually be announced.
          aria-live="polite"
        >
          <span className={styles.dot} aria-hidden="true" />
          {connection === 'online'
            ? 'API connected'
            : connection === 'offline'
              ? 'API unreachable'
              : 'Connecting'}
        </span>

        <Button
          variant="ghost"
          iconOnly
          onClick={onToggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
        >
          {theme === 'dark' ? <Sun /> : <Moon />}
        </Button>

        <Button variant="primary" onClick={onSimulate} isLoading={isSimulating}>
          <Pulse size={14} />
          Simulate traffic
        </Button>
      </div>
    </header>
  );
}

/** Polls /api/health so the header can tell the merchant the API is up. */
function useConnectionState(): ConnectionState {
  const [state, setState] = useState<ConnectionState>('checking');

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const check = async () => {
      try {
        await api.getHealth(controller.signal);
        if (!cancelled) setState('online');
      } catch {
        if (!cancelled) setState('offline');
      }
    };

    void check();
    const timer = window.setInterval(() => void check(), HEALTH_POLL_MS);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(timer);
    };
  }, []);

  return state;
}
