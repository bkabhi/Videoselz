import { useId } from 'react';
import styles from './SegmentedControl.module.scss';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  /** Spoken label, when the visible one is an abbreviation. */
  description?: string;
}

interface SegmentedControlProps<T extends string> {
  /** Names the group for assistive technology. */
  legend: string;
  options: ReadonlyArray<SegmentOption<T>>;
  value: T;
  onChange: (value: T) => void;
}

/**
 * Built on real radio inputs rather than buttons.
 *
 * A row of buttons needs hand-written arrow-key handling, manual `aria-checked`
 * bookkeeping and a roving tabindex to behave correctly. A `radiogroup` gets
 * all three from the browser, and it is announced as "2 of 4" instead of as
 * four unrelated controls.
 */
export function SegmentedControl<T extends string>({
  legend,
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  const name = useId();

  return (
    <fieldset className={styles.group}>
      <legend className="visually-hidden">{legend}</legend>

      {options.map((option) => {
        const id = `${name}-${option.value}`;
        return (
          <span key={option.value} className={styles.option}>
            <input
              type="radio"
              id={id}
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <label className={styles.label} htmlFor={id}>
              {/* The visible abbreviation stays *in* the accessible name and
                  the expansion is appended, rather than replacing it. Swapping
                  "24h" out for "Last 24 hours" would leave a voice-control
                  user unable to say what they can see (WCAG 2.5.3). */}
              <span>{option.label}</span>
              {option.description ? (
                <span className="visually-hidden">&nbsp;— {option.description}</span>
              ) : null}
            </label>
          </span>
        );
      })}
    </fieldset>
  );
}
