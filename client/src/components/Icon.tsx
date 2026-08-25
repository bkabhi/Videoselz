import type { SVGProps } from 'react';

/**
 * The icon set.
 *
 * Authored rather than pulled from a library so every glyph sits on the same
 * 16px grid at the same 1.5px stroke, with round caps and joins. Mixed stroke
 * weights are one of the most visible inconsistencies in an interface, and an
 * emoji standing in for an icon is worse than no icon at all.
 *
 * All paths inherit `currentColor`, so an icon is coloured by its container.
 */

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 16, children, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      // Decorative by default: the accessible name lives on the control that
      // wraps the icon, so announcing the glyph too would just be an echo.
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export const ChevronLeft = (props: IconProps) => (
  <Svg {...props}>
    <path d="M10 3.5 5.5 8l4.5 4.5" />
  </Svg>
);

export const ChevronRight = (props: IconProps) => (
  <Svg {...props}>
    <path d="M6 3.5 10.5 8 6 12.5" />
  </Svg>
);

export const ChevronsLeft = (props: IconProps) => (
  <Svg {...props}>
    <path d="M8.5 4.5 5 8l3.5 3.5M12.5 4.5 9 8l3.5 3.5" />
  </Svg>
);

export const ChevronsRight = (props: IconProps) => (
  <Svg {...props}>
    <path d="M7.5 4.5 11 8l-3.5 3.5M3.5 4.5 7 8l-3.5 3.5" />
  </Svg>
);

export const ChevronDown = (props: IconProps) => (
  <Svg {...props}>
    <path d="M3.5 6 8 10.5 12.5 6" />
  </Svg>
);

export const ArrowUp = (props: IconProps) => (
  <Svg {...props}>
    <path d="M8 13V3.5M4 7.5 8 3.5l4 4" />
  </Svg>
);

export const ArrowDown = (props: IconProps) => (
  <Svg {...props}>
    <path d="M8 3v9.5M12 8.5 8 12.5l-4-4" />
  </Svg>
);

/** Ascending / descending indicators for the table header. */
export const SortAscending = (props: IconProps) => (
  <Svg {...props}>
    <path d="M8 12.5v-9M4.5 7 8 3.5 11.5 7" />
  </Svg>
);

export const SortDescending = (props: IconProps) => (
  <Svg {...props}>
    <path d="M8 3.5v9M4.5 9 8 12.5 11.5 9" />
  </Svg>
);

export const Search = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="7.2" cy="7.2" r="3.9" />
    <path d="m10.2 10.2 2.6 2.6" />
  </Svg>
);

export const Close = (props: IconProps) => (
  <Svg {...props}>
    <path d="m4.5 4.5 7 7M11.5 4.5l-7 7" />
  </Svg>
);

/** Traffic simulator — a burst, not a lightning-bolt cliché. */
export const Pulse = (props: IconProps) => (
  <Svg {...props}>
    <path d="M1.5 8h2.8l1.6-4.3 2.4 8.6L10 8h4.5" />
  </Svg>
);

export const Sun = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="8" cy="8" r="2.9" />
    <path d="M8 1.5v1.3M8 13.2v1.3M14.5 8h-1.3M2.8 8H1.5M12.6 3.4l-.9.9M4.3 11.7l-.9.9M12.6 12.6l-.9-.9M4.3 4.3l-.9-.9" />
  </Svg>
);

export const Moon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M13.2 9.4A5.6 5.6 0 0 1 6.6 2.8a5.6 5.6 0 1 0 6.6 6.6Z" />
  </Svg>
);

export const AlertTriangle = (props: IconProps) => (
  <Svg {...props}>
    <path d="M8 2.6 14.4 13H1.6L8 2.6Z" />
    <path d="M8 6.6v3M8 11.4h.01" />
  </Svg>
);

export const Check = (props: IconProps) => (
  <Svg {...props}>
    <path d="m3.5 8.4 3 3 6-6.8" />
  </Svg>
);

export const Refresh = (props: IconProps) => (
  <Svg {...props}>
    <path d="M13.5 8a5.5 5.5 0 1 1-1.7-4" />
    <path d="M13.7 2.2v3.6h-3.6" />
  </Svg>
);

/** The Videoselz mark: a play triangle inside a rounded frame. */
export const Logomark = ({ size = 22, ...props }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
    focusable="false"
    {...props}
  >
    <rect x="1.25" y="1.25" width="21.5" height="21.5" rx="6.25" fill="currentColor" />
    <path d="M9.6 8.05 16.2 12l-6.6 3.95V8.05Z" fill="var(--surface-raised)" />
  </svg>
);

/** Empty-state glyph: an empty frame, drawn at a larger size. */
export const EmptyFrame = ({ size = 28, ...props }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.25}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
    {...props}
  >
    <rect x="2.75" y="4.75" width="18.5" height="14.5" rx="2.75" />
    <path d="M10 9.9 14.6 12 10 14.1V9.9Z" />
  </svg>
);
