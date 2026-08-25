/**
 * Default options for Prisma interactive transactions ($transaction(async (tx) => ...)).
 *
 * Prisma's default interactive-transaction timeout is 5s, which assumes a low-latency database
 * connection. Once the database is a remote/cloud instance (e.g. Neon) rather than localhost,
 * a handful of sequential round trips inside one transaction can easily exceed that — every
 * multi-step transaction in this codebase (create/archive/revive/patch fact sheet, LDIF
 * completion recalculation) hit "Transaction already closed" under real network latency before
 * this was raised. 20s comfortably covers that; maxWait is how long a transaction may wait to
 * even start if the pool is busy.
 */
export const INTERACTIVE_TX_OPTIONS = { timeout: 20_000, maxWait: 10_000 };
