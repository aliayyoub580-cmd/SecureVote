import { z } from 'zod'

export const electionWizardSchema = z
  .object({
    title: z.string().min(2, 'Title is required').max(200),
    descriptionHtml: z.string().default(''),
    category: z.string().default(''),
    organization: z.string().default(''),
    startsAt: z.string().min(1, 'Voting start is required'),
    endsAt: z.string().min(1, 'Voting end is required'),
    registrationOpensAt: z.string().default(''),
    registrationClosesAt: z.string().default(''),
    maxVoters: z
      .string()
      .default('')
      .refine((v) => !v.trim() || /^\d+$/.test(v.trim()), { message: 'Max voters must be a positive whole number' })
      .refine((v) => !v.trim() || parseInt(v.trim(), 10) > 0, { message: 'Max voters must be greater than 0' }),
    visibility: z.enum(['public', 'private']).default('public'),
  })
  .refine((d) => new Date(d.endsAt).getTime() > new Date(d.startsAt).getTime(), {
    message: 'End must be after start',
    path: ['endsAt'],
  })
  .refine(
    (d) => {
      if (!d.registrationClosesAt.trim()) return true
      return new Date(d.registrationClosesAt).getTime() <= new Date(d.startsAt).getTime()
    },
    { message: 'Registration must end before voting starts', path: ['registrationClosesAt'] },
  )

export type ElectionWizardForm = z.infer<typeof electionWizardSchema>
