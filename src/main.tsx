import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from '@/app/app'
import { ErrorBoundary } from '@/components/feedback/error-boundary'
import { getPublicEnv } from '@/lib/env'

import './index.css'

getPublicEnv()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
