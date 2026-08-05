import { BrowserRouter } from 'react-router-dom'

import { AppRoutes } from '@/app/app-routes'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/contexts/auth-context'
import { ModalProvider } from '@/contexts/modal-context'
import { ThemeProvider } from '@/contexts/theme-context'

export function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <ModalProvider>
            <TooltipProvider delayDuration={200}>
              <AppRoutes />
            </TooltipProvider>
          </ModalProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
