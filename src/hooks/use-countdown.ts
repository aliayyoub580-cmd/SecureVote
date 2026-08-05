import { useEffect, useState } from 'react'

export function useCountdown(targetTime: number | null) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (targetTime == null) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [targetTime])

  if (targetTime == null) return null
  const remaining = Math.max(0, targetTime - now)
  const s = Math.floor(remaining / 1000)
  const days = Math.floor(s / 86400)
  const hours = Math.floor((s % 86400) / 3600)
  const minutes = Math.floor((s % 3600) / 60)
  const seconds = s % 60
  return { days, hours, minutes, seconds, done: remaining <= 0 }
}
