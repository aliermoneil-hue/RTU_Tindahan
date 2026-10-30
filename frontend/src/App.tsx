import { AuthProvider } from '@/features/auth'
import { AppRoutes } from '@/features/core/AppRoutes'

/** Root component: gives every page access to the signed-in user, then shows the right page. */
export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
