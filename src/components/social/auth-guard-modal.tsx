/**
 * AuthGuardModal — shown when a guest clicks an authenticated social action.
 * Provides a clean "Sign in to …" prompt with Sign In / Cancel buttons.
 * Used by PostCard, PostComposer, ProfilePage, etc.
 */
import * as React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { LogIn, X, Shield } from 'lucide-react'

interface AuthGuardModalProps {
  open:    boolean
  action:  string          // e.g. "like this post", "follow this user"
  onClose: () => void
}

export function AuthGuardModal({ open, action, onClose }: AuthGuardModalProps) {
  const navigate  = useNavigate()
  const location  = useLocation()

  const handleSignIn = () => {
    onClose()
    navigate('/login', { state: { from: location.pathname } })
  }

  // Close on Escape
  React.useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 16 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed left-1/2 top-1/2 z-[201] -translate-x-1/2 -translate-y-1/2 w-full max-w-sm mx-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-modal-title"
          >
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[var(--border)]">
                <div className="flex items-center gap-2.5">
                  <div className="size-8 rounded-xl bg-[var(--accent-primary)]/15 border border-[var(--accent-primary)]/30 flex items-center justify-center">
                    <Shield className="size-4 text-[var(--accent-primary)]" />
                  </div>
                  <h2 id="auth-modal-title" className="text-sm font-bold text-[var(--foreground)]">
                    Sign in required
                  </h2>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
                  aria-label="Close"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Body */}
              <div className="px-5 py-5 text-center space-y-4">
                <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
                  Sign in to{' '}
                  <span className="font-semibold text-[var(--foreground)]">{action}</span>.
                </p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  You can browse and read all public posts without an account.
                </p>
              </div>

              {/* Actions */}
              <div className="px-5 pb-5 flex items-center gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl bg-[var(--muted)] text-[var(--muted-foreground)] text-sm font-semibold hover:bg-[var(--muted)]/80 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSignIn}
                  className="flex-1 py-2.5 rounded-xl bg-[var(--accent-primary)] text-[var(--primary-foreground)] text-sm font-bold hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  <LogIn className="size-4" />
                  Sign In
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

/**
 * useAuthGuard — hook that wraps any action with an auth check.
 * If the user is logged in, runs the action.
 * If not, shows the modal with the provided action description.
 */
export function useAuthGuard(userId: string | undefined) {
  const [modalOpen,   setModalOpen]   = React.useState(false)
  const [modalAction, setModalAction] = React.useState('')

  const guard = React.useCallback(
    (actionLabel: string, fn: () => void) => {
      if (userId) {
        fn()
      } else {
        setModalAction(actionLabel)
        setModalOpen(true)
      }
    },
    [userId],
  )

  const closeModal = React.useCallback(() => setModalOpen(false), [])

  return { guard, modalOpen, modalAction, closeModal }
}
