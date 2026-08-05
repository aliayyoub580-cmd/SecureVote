import { Navigate } from 'react-router-dom'

import { ROUTES } from '@/constants/routes'

export function ElectionCreatePage() {
  return <Navigate to={ROUTES.electionWizardNew} replace />
}
