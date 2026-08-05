import { Navigate, Outlet } from 'react-router-dom'
import { toast } from '@/lib/toast'

import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/contexts/auth-context'
import { ROUTES } from '@/constants/routes'
import type { UserRole } from '@/types/database'

function getRoleDashboard(role: UserRole | undefined): string {
  if (role === 'super_admin') return ROUTES.admin
  if (role === 'election_creator') return ROUTES.creatorDashboard
  return ROUTES.dashboard
}

export function RoleGuard({ allow }: { allow: UserRole[] }) {
  const { profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-dvh flex-col gap-4 p-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full max-w-3xl" />
      </div>
    )
  }

  if (!profile || !allow.includes(profile.role)) {
    // Only show the error toast when the user IS authenticated but lacks the required role.
    // If profile is null, they are not logged in — redirect silently.
    if (profile) {
      toast.error('You do not have access to that area.')
    }
    // Always redirect to the user's own dashboard — never bleed into another role's area.
    return <Navigate to={getRoleDashboard(profile?.role)} replace />
  }

  return <Outlet />
}

