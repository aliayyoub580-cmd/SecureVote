import { Outlet } from 'react-router-dom'

/** Auth routes render their own full-screen layout (e.g. split). */
export function AuthLayout() {
  return <Outlet />
}
