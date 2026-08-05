import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ROUTES } from '@/constants/routes'

export function NotFoundPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <Card className="max-w-md text-center">
        <CardHeader>
          <CardTitle>Page not found</CardTitle>
          <CardDescription>The route you requested does not exist.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link to={ROUTES.dashboard}>Go to dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
