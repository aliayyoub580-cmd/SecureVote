import { Turnstile } from '@marsidev/react-turnstile'

type Props = {
  siteKey?: string
  onToken: (token: string) => void
  onExpire?: () => void
}

/** Cloudflare Turnstile — optional; omit siteKey in env to disable CAPTCHA. */
export function TurnstileField({ siteKey, onToken, onExpire }: Props) {
  if (
    !siteKey ||
    ['undefined', 'null', 'false', 'none', 'your_site_key'].includes(siteKey.toLowerCase()) ||
    siteKey.length < 5
  ) {
    return null
  }

  return (
    <div className="flex min-h-[68px] justify-center overflow-hidden rounded-xl">
      <Turnstile
        siteKey={siteKey}
        onSuccess={onToken}
        onExpire={onExpire}
        options={{ theme: 'dark', size: 'normal' }}
      />
    </div>
  )
}
