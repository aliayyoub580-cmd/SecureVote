import { Component, type ErrorInfo, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { logger } from '@/lib/logger'

type Props = { children: ReactNode }

type State = { hasError: boolean; message?: string }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logger.error('ErrorBoundary', error.message, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-dvh items-center justify-center p-6">
          <Card className="max-w-lg border-destructive/30">
            <CardHeader>
              <CardTitle>Something went wrong</CardTitle>
              <CardDescription>
                The application hit an unexpected error. You can try again or return home.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="max-h-40 overflow-auto rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                {this.state.message}
              </pre>
            </CardContent>
            <CardFooter>
              <Button type="button" onClick={() => window.location.assign('/')}>
                Reload app
              </Button>
            </CardFooter>
          </Card>
        </div>
      )
    }
    return this.props.children
  }
}
