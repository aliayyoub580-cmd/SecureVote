import { supabase } from '@/lib/supabase/client'
import { isPlausibleVoterPublicIdFormat } from '@/lib/voter-public-id'

export type VoterPublicIdStatus = {
  publicId: string | null
  hasActive: boolean
}

export type ValidateVoterPublicIdResult = {
  valid: boolean
  reason: string | null
}

export const voterSecretIdService = {
  async getMine(electionId: string): Promise<VoterPublicIdStatus> {
    const { data, error } = await (supabase as any).rpc('get_my_voter_public_id', { p_election_id: electionId })
    if (error) throw error
    const row = (data ?? {}) as Record<string, unknown>
    return {
      publicId: row.public_id != null ? String(row.public_id) : null,
      hasActive: Boolean(row.has_active),
    }
  },

  async regenerate(electionId: string): Promise<string> {
    const { data, error } = await (supabase as any).rpc('regenerate_my_voter_public_id', { p_election_id: electionId })
    if (error) throw error
    const row = (data ?? {}) as Record<string, unknown>
    const id = row.voter_public_id != null ? String(row.voter_public_id) : ''
    if (!id) throw new Error('Regeneration did not return an ID')
    return id
  },

  /** Revokes old ballot + public ID; issues completely new ones. */
  async regenerateFullToken(electionId: string): Promise<{ secretToken: string; publicId: string }> {
    const { data, error } = await (supabase as any).rpc('regenerate_ballot_token', { p_election_id: electionId })
    if (error) throw error
    const row = (data ?? {}) as Record<string, unknown>
    return {
      secretToken: String(row.secret_token ?? ''),
      publicId: String(row.voter_public_id ?? ''),
    }
  },

  async validate(electionId: string, code: string): Promise<ValidateVoterPublicIdResult> {
    const trimmed = code.trim()
    if (!isPlausibleVoterPublicIdFormat(trimmed)) {
      return { valid: false, reason: 'format' }
    }
    const { data, error } = await (supabase as any).rpc('validate_voter_public_id', {
      p_election_id: electionId,
      p_code: trimmed,
    })
    if (error) throw error
    const row = (data ?? {}) as Record<string, unknown>
    return {
      valid: Boolean(row.valid),
      reason: row.reason != null ? String(row.reason) : null,
    }
  },

  /** Invokes Edge Function `send-voter-id-email` (requires deployed function + Resend secret). */
  async requestEmailDelivery(electionId: string): Promise<{ ok: boolean; skipped?: boolean; message?: string }> {
    const { data, error } = await supabase.functions.invoke('send-voter-id-email', {
      body: { election_id: electionId },
    })
    if (error) throw error
    return (data ?? { ok: false }) as { ok: boolean; skipped?: boolean; message?: string }
  },
}
