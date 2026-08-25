const ESC = String.fromCharCode(27);

const LEVEL_COLOR = {
  info: `${ESC}[36m`,
  warn: `${ESC}[33m`,
  error: `${ESC}[31m`,
  success: `${ESC}[32m`,
} as const;

const RESET = `${ESC}[0m`;
const DIM = `${ESC}[2m`;

type Level = keyof typeof LEVEL_COLOR;

function emit(level: Level, message: string, meta?: unknown): void {
  const stamp = new Date().toISOString().slice(11, 23);
  const label = `${LEVEL_COLOR[level]}${level.toUpperCase().padEnd(7)}${RESET}`;
  const line = `${DIM}${stamp}${RESET} ${label} ${message}`;
  const sink = level === 'error' ? console.error : console.log;
  if (meta === undefined) sink(line);
  else sink(line, meta);
}

/** Minimal levelled logger. Enough structure to read a request log at a
 *  glance without pulling in pino/winston for a single-process take-home. */
export const logger = {
  info: (message: string, meta?: unknown) => emit('info', message, meta),
  warn: (message: string, meta?: unknown) => emit('warn', message, meta),
  error: (message: string, meta?: unknown) => emit('error', message, meta),
  success: (message: string, meta?: unknown) => emit('success', message, meta),
};
