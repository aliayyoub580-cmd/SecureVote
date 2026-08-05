import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { WifiOff, RefreshCw } from 'lucide-react'

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return (
    <AnimatePresence>
      {isOffline && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="bg-[var(--accent-danger)]/15 border-b border-[var(--accent-danger)]/30 text-[var(--accent-danger)] px-4 py-2 text-xs font-semibold flex items-center justify-center gap-2 relative z-50 shadow-sm"
        >
          <WifiOff className="size-4 shrink-0" />
          <span>Internet Connection Lost. Please check your network connection.</span>
          <button
            onClick={() => window.location.reload()}
            className="ml-2 underline font-bold hover:opacity-80 flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className="size-3" /> Retry
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
