import { useId } from 'react';
import { Close, Search } from './Icon';
import styles from './SearchInput.module.scss';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
}

export function SearchInput({ value, onChange, label, placeholder }: SearchInputProps) {
  const id = useId();

  return (
    <div className={styles.wrapper}>
      <label className="visually-hidden" htmlFor={id}>
        {label}
      </label>

      <input
        id={id}
        // `type="search"` gives keyboard users Escape-to-clear for free and
        // tells mobile keyboards to show a search key.
        type="search"
        className={styles.input}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => onChange(event.target.value)}
      />

      <Search className={styles.icon} />

      {value ? (
        <button
          type="button"
          className={styles.clear}
          onClick={() => onChange('')}
          aria-label="Clear search"
        >
          <Close size={13} />
        </button>
      ) : null}
    </div>
  );
}
