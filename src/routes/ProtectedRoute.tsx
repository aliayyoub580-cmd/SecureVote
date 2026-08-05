import * as React from 'react'
import { Navigate, Outlet } from 'react-router-dom'

import { Skeleton } from '@/components/ui/skeleton'
import { ROUTES } from '@/constants/routes'
import { useAuth } from '@/contexts/auth-context'
import { ensureAuthSession } from '@/middleware/auth-session'

const requireEmailVerification = import.meta.env.VITE_REQUIRE_EMAIL_VERIFICATION === 'true'

export function ProtectedRoute() {
  const { user, loading, sessionValidated, isEmailVerified } = useAuth()
  const [checking, setChecking] = React.useState(true)
  const [sessionOk, setSessionOk] = React.useState(true)

  React.useEffect(() => {
    if (!user) {
      setChecking(false)
      setSessionOk(true)
      return
    }
    let cancelled = false
    void ensureAuthSession().then(({ ok }) => {
      if (cancelled) return
      setSessionOk(ok)
      setChecking(false)
    })
    return () => {
      cancelled = true
    }
  }, [user])

  if (loading || !sessionValidated || checking) {
    return (
      <div className="flex min-h-dvh flex-col gap-4 p-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full max-w-3xl" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!sessionOk) {
    return <Navigate to="/login" replace />
  }

  if (requireEmailVerification && !isEmailVerified) {
    return <Navigate to={ROUTES.verifyEmail} replace state={{ email: user.email }} />
  }

  return <Outlet />
}
