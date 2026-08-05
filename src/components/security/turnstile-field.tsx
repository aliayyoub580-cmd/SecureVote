import { Turnstile } from '@marsidev/react-turnstile'

type Props = {
  siteKey: string
  onToken: (token: string) => void
  onExpire?: () => void
}

/** Cloudflare Turnstile — optional; omit siteKey in env to disable CAPTCHA. */
export function TurnstileField({ siteKey, onToken, onExpire }: Props) {
  return (
    <div className="flex min-h-[68px] justify-center">
      <Turnstile
        siteKey={siteKey}
        onSuccess={onToken}
        onExpire={onExpire}
        options={{ theme: 'auto', size: 'flexible' }}
      />
    </div>
  )
}
