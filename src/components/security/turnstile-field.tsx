import * as React from 'react'
import { Turnstile } from '@marsidev/react-turnstile'

type Props = {
  siteKey?: string
  onToken: (token: string) => void
  onExpire?: () => void
}

/** Cloudflare Turnstile — optional; omit siteKey in env to disable CAPTCHA. */
export function TurnstileField({ siteKey, onToken, onExpire }: Props) {
  const [hasError, setHasError] = React.useState(false)

  // Cloudflare Turnstile site keys strictly start with 0x, 1x, 2x, or 3x
  const isValidKey =
    Boolean(siteKey) &&
    siteKey!.length >= 10 &&
    (siteKey!.startsWith('0x') ||
      siteKey!.startsWith('1x') ||
      siteKey!.startsWith('2x') ||
      siteKey!.startsWith('3x'))

  if (!isValidKey || hasError) {
    return null
  }

  return (
    <div className="flex min-h-[68px] justify-center overflow-hidden rounded-xl">
      <Turnstile
        siteKey={siteKey!}
        onSuccess={onToken}
        onExpire={onExpire}
        onError={() => setHasError(true)}
        options={{ theme: 'dark', size: 'normal' }}
      />
    </div>
  )
}
