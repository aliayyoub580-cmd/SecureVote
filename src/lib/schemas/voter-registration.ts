import { z } from 'zod'

export const voterTermsSchema = z.object({
  acceptTerms: z.boolean().refine((v) => v === true, {
    message: 'You must accept the participation terms.',
  }),
})

export type VoterTermsForm = z.infer<typeof voterTermsSchema>
