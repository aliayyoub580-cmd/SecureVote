import { z } from 'zod'

export * from './auth'
export * from './candidate'
export * from './election-wizard'

export const electionSchema = z
  .object({
    title: z.string().min(3, 'Title is required'),
    description: z.string().optional(),
    startsAt: z.string().min(1, 'Start time required'),
    endsAt: z.string().min(1, 'End time required'),
    registrationOpensAt: z.string().optional(),
    registrationClosesAt: z.string().optional(),
  })
  .refine(
    (d) => {
      const s = new Date(d.startsAt).getTime()
      const e = new Date(d.endsAt).getTime()
      return e > s
    },
    { message: 'End must be after start', path: ['endsAt'] },
  )

export const candidateSchema = z.object({
  name: z.string().min(1, 'Name required'),
  bio: z.string().optional(),
})

export const voteSchema = z.object({
  candidateId: z.string().uuid('Pick a candidate'),
  secretToken: z.string().min(16, 'Enter your secret ballot token'),
})

/** Matches `encode(gen_random_bytes(24), 'hex')` from `register_for_election`. */
const BALLOT_TOKEN_HEX_LEN = 48

export const voteBallotSchema = z.object({
  secretToken: z
    .string()
    .transform((s) => s.trim())
    .refine(
      (val) => {
        const isFriendly = /^SV-[A-Z0-9]{4,8}$/i.test(val)
        const isHex = /^[0-9a-fA-F]{48}$/.test(val)
        return isFriendly || isHex
      },
      {
        message: 'Invalid code format. Must be like SV-XXXXXX.',
      }
    ),
})

export const rejectElectionSchema = z.object({
  reason: z.string().min(4, 'Provide a short reason'),
})
