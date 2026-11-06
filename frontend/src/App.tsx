import { AuthProvider } from '@/features/authentication'
import { AppRoutes } from '@/features/core/AppRoutes'
import { TindahanProvider } from '@/features/marketplace/context/TindahanContext'

/** Root component: gives every page access to the signed-in user and marketplace state, then shows the right page. */
export default function App() {
  return (
    <AuthProvider>
      <TindahanProvider>
        <AppRoutes />
      </TindahanProvider>
    </AuthProvider>
  )
}
