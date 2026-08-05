const isDev = import.meta.env.DEV

/** Minimal structured logging: verbose in dev, warnings/errors always visible. */
export const logger = {
  debug: (...args: unknown[]) => {
    if (isDev) console.debug('[SecureVote]', ...args)
  },
  info: (...args: unknown[]) => {
    if (isDev) console.info('[SecureVote]', ...args)
  },
  warn: (...args: unknown[]) => {
    console.warn('[SecureVote]', ...args)
  },
  error: (...args: unknown[]) => {
    console.error('[SecureVote]', ...args)
  },
}
