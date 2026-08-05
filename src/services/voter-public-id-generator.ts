/**
 * Documents how voter display IDs are shaped server-side (Postgres trigger + RPC).
 * The authoritative generator lives in Supabase — do not reimplement allocation client-side.
 */
export const voterPublicIdGenerator = {
  /** Human-readable pattern issued by `issue_voter_public_id_for_ballot`. */
  patternDescription:
    'POLL-{random A-Z}-{first 4 hex chars of election UUID}{4-digit per-election sequence} — globally unique `public_id` row.',

  /** Example shape (not a live ID). */
  example: 'POLL-K-A3F20001',
} as const
