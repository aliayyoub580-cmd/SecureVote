import { Navigate } from 'react-router-dom'

import { ROUTES } from '@/constants/routes'
import { useAuth } from '@/contexts/auth-context'
import { LandingPage } from '@/pages/landing/landing-page'

export function RootRedirect() {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div
          className="size-9 animate-spin rounded-full border-2 border-primary border-t-transparent"
          aria-hidden
        />
      </div>
    )
  }

  if (user) {
    // Strict role-based redirect — always sends user to their own dashboard
    if (profile?.role === 'super_admin') {
      return <Navigate to={ROUTES.admin} replace />
    }
    if (profile?.role === 'election_creator') {
      return <Navigate to={ROUTES.creatorDashboard} replace />
    }
    // voter or any other authenticated role → voter dashboard
    return <Navigate to={ROUTES.dashboard} replace />
  }

  return <LandingPage />
}
