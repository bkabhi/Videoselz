import { useId } from 'react';
import type { PaginationMeta } from '@shared/api';
import { Button } from '@/components/Button';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from '@/components/Icon';
import { formatExactCount } from '@/lib/format';
import styles from './Pagination.module.scss';

const PAGE_SIZES = [10, 25, 50] as const;

interface PaginationProps {
  pagination: PaginationMeta;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export function Pagination({ pagination, onPageChange, onPageSizeChange }: PaginationProps) {
  const selectId = useId();
  const { page, pageSize, totalItems, totalPages, hasNextPage, hasPreviousPage } = pagination;

  const firstRow = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastRow = Math.min(page * pageSize, totalItems);

  return (
    <nav className={styles.bar} aria-label="Table pagination">
      <p className={styles.range}>
        {totalItems === 0 ? (
          'No videos'
        ) : (
          <>
            <span className={styles.rangeStrong}>
              {formatExactCount(firstRow)}–{formatExactCount(lastRow)}
            </span>{' '}
            of {formatExactCount(totalItems)} videos
          </>
        )}
      </p>

      <div className={styles.controls}>
        <div className={styles.pageSize}>
          <label htmlFor={selectId}>Rows</label>
          <span className={styles.selectWrapper}>
            <select
              id={selectId}
              className={styles.select}
              value={pageSize}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <ChevronDown size={12} className={styles.selectIcon} />
          </span>
        </div>

        <div className={styles.pager}>
          <Button
            variant="ghost"
            iconOnly
            aria-label="First page"
            disabled={!hasPreviousPage}
            onClick={() => onPageChange(1)}
          >
            <ChevronsLeft />
          </Button>
          <Button
            variant="ghost"
            iconOnly
            aria-label="Previous page"
            disabled={!hasPreviousPage}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft />
          </Button>

          {/* aria-live so a keyboard user paging with the buttons hears the
              new position without having to go hunting for it. */}
          <span className={styles.pageIndicator} aria-live="polite">
            Page <span className={styles.pageCurrent}>{page}</span> of {totalPages}
          </span>

          <Button
            variant="ghost"
            iconOnly
            aria-label="Next page"
            disabled={!hasNextPage}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight />
          </Button>
          <Button
            variant="ghost"
            iconOnly
            aria-label="Last page"
            disabled={!hasNextPage}
            onClick={() => onPageChange(totalPages)}
          >
            <ChevronsRight />
          </Button>
        </div>
      </div>
    </nav>
  );
}
