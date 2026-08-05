import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ROUTES } from '@/constants/routes'
import { useAuth } from '@/contexts/auth-context'

export function CreatorApplicationStatusPage() {
  const { profile } = useAuth()
  const status = profile?.creator_application_status ?? 'none'

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Creator application</h1>
        <p className="text-sm text-muted-foreground">Election creator tools unlock only after Super Admin approval.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {status === 'pending'
              ? 'Pending review'
              : status === 'rejected'
                ? 'Not approved'
                : 'No active request'}
          </CardTitle>
          <CardDescription>
            {status === 'pending'
              ? 'You will receive a notification when a decision is recorded.'
              : status === 'rejected'
                ? 'Your account remains a voter. You can still join elections and cast ballots.'
                : 'Submit a creator request from registration or ask an admin to change your role.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            Role: <span className="font-mono font-medium">{profile?.role}</span>
          </p>
          <p>
            Application status: <span className="font-mono font-medium">{status}</span>
          </p>
          <Button asChild variant="outline" className="rounded-xl">
            <Link to={ROUTES.dashboard}>Back to dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
