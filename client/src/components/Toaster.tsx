import { AlertTriangle, Check, Close, Pulse } from './Icon';
import { useToasts, type ToastTone } from '@/hooks/useToasts';
import styles from './Toaster.module.scss';

const TONE_ICON: Record<ToastTone, typeof Check> = {
  success: Check,
  error: AlertTriangle,
  neutral: Pulse,
};

/**
 * Toast stack.
 *
 * `role="status"` with `aria-live="polite"` announces each toast without
 * stealing focus — the merchant is mid-task, and a toast confirming a
 * background action is not worth interrupting them for. `aria-atomic` makes
 * the reader speak the whole toast rather than only the changed node.
 */
export function Toaster() {
  const { toasts, dismiss } = useToasts();

  return (
    <div className={styles.region} role="status" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => {
        const ToneIcon = TONE_ICON[toast.tone];
        return (
          <div key={toast.id} className={`${styles.toast} ${styles[toast.tone]}`}>
            <span className={styles.badge}>
              <ToneIcon size={12} />
            </span>

            <div className={styles.body}>
              <p className={styles.title}>{toast.title}</p>
              {toast.description ? (
                <p className={styles.description}>{toast.description}</p>
              ) : null}
            </div>

            <button
              type="button"
              className={styles.dismiss}
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss notification"
            >
              <Close size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
