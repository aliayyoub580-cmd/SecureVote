import emailjs from '@emailjs/browser'
import { toast } from '@/lib/toast'

// Professional Configuration for EmailJS (No Domain Required)
const EMAILJS_SERVICE_ID = 'service_gmfmboh'
const EMAILJS_TEMPLATE_ID = 'template_0u8jgnf'
const EMAILJS_PUBLIC_KEY = 'U4e3msK3MNBnxHiZb'

export const emailService = {
  generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString()
  },

  /**
   * Sends real email via EmailJS (Works with Gmail without Domain)
   */
  async sendVotingCodeEmail(email: string, electionTitle: string, votingCode: string) {
    try {
      const result = await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        {
          // Support for custom templates
          to_email: email,
          election_title: electionTitle,
          voting_code: votingCode,

          // Bulletproof Support for standard templates (Contact Us templates use {{message}})
          to_name: email,
          from_name: 'SecureVote Platform',
          message: `Your secure voting code for "${electionTitle}" is: ${votingCode}\n\nIMPORTANT: Please do not share this code with anyone. It is your private key to participate in this election.`
        },
        EMAILJS_PUBLIC_KEY
      )
      console.log('Voting code email sent!', result.text)
      toast.success(`Voting code sent to ${email}`)
      return { data: result, error: null }
    } catch (error: any) {
      console.error('EmailJS Error:', error)
      toast.error('Failed to send voting code email.')
      return { data: null, error }
    }
  },

  /**
   * Sends OTP via EmailJS for Signup/Reset (Now also 100% Real!)
   */
  async sendOTPEmail(email: string, otp: string, type: string) {
    try {
      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        {
          // Support for custom templates
          to_email: email,
          election_title: `SecureVote Code`,
          voting_code: otp,

          // Bulletproof Support for standard templates (Contact Us templates use {{message}})
          to_name: email,
          from_name: 'SecureVote',
          message: `Hello! Here is your code: ${otp}\n\nPlease use this code to continue with your ${type}. Thank you for using SecureVote!`
        },
        EMAILJS_PUBLIC_KEY
      )
      console.log('OTP email sent via EmailJS!')
    } catch (err) {
      console.error('EmailJS Send Error:', err)
    }
  },

  /**
   * Sends Security Alert for 2FA logins
   */
  async sendSuspiciousLoginEmail(email: string) {
    try {
      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        {
          to_email: email,
          election_title: `Security Alert: Login Attempt`,
          voting_code: '-',
          to_name: email,
          from_name: 'SecureVote Security',
          message: `Hello,\n\nWe detected a successful password login attempting to access your account. Because Two-Factor Authentication (2FA) is enabled on your account, we have temporarily blocked access until the correct 2FA code is provided.\n\nIf this was you, you can safely ignore this email and enter your 2FA code. If this was NOT you, please reset your password immediately, as someone else knows your password!`
        },
        EMAILJS_PUBLIC_KEY
      )
      console.log('Suspicious login email sent via EmailJS!')
    } catch (err) {
      console.error('EmailJS Send Error:', err)
    }
  }
}
