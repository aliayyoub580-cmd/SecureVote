import { Navigate, Outlet } from 'react-router-dom'

import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/contexts/auth-context'
import { ROUTES } from '@/constants/routes'

export function GuestRoute() {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <Skeleton className="h-40 w-full max-w-md rounded-2xl" />
      </div>
    )
  }

  if (user) {
    // Always redirect to the user's own role-specific dashboard — never use stale location state
    if (profile?.role === 'super_admin') {
      return <Navigate to={ROUTES.admin} replace />
    }
    if (profile?.role === 'election_creator') {
      return <Navigate to={ROUTES.creatorDashboard} replace />
    }
    return <Navigate to={ROUTES.dashboard} replace />
  }

  return <Outlet />
}
