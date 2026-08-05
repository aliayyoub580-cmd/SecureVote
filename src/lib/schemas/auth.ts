import { z } from 'zod'

/** 0–4 score: length, mixed case, digits, symbols */
export function passwordStrengthScore(password: string): number {
  let score = 0
  if (password.length >= 10) score++
  if (password.length >= 14) score++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  return Math.min(4, score)
}

export const strongPasswordSchema = z
  .string()
  .min(8, 'Use at least 8 characters')
  .superRefine((val, ctx) => {
    const s = passwordStrengthScore(val)
    if (s < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Password is too weak. Please use a stronger password to register.',
      })
    }
  })

export const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
})

export const forgotPasswordSchema = z.object({
  email: z.string().email('Enter a valid email address'),
})

export const resetPasswordSchema = z
  .object({
    password: strongPasswordSchema,
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: 'Passwords do not match', path: ['confirm'] })

export const accountTypeSchema = z.enum(['voter', 'request_creator'])

export const registerSchema = z
  .object({
    fullName: z.string().min(2, 'Enter your full name'),
    email: z.string().email('Enter a valid email address'),
    phone: z.string().max(32).optional(),
    organization: z.string().max(120).optional(),
    accountType: accountTypeSchema,
    password: strongPasswordSchema,
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: 'Passwords do not match', path: ['confirm'] })

export const verifyEmailRequestSchema = z.object({
  email: z.string().email('Enter a valid email address'),
})
