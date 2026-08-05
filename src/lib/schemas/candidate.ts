import { z } from 'zod'

export const candidateFormSchema = z.object({
  poll_id: z.string().uuid('Select a ballot section'),
  name: z.string().min(1, 'Name is required').max(120),
  designation: z.string().max(100),
  bio: z.string().max(280),
  manifesto: z.string().max(8000),
})

export type CandidateFormValues = z.infer<typeof candidateFormSchema>
