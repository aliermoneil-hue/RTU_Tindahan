import { EmptyState } from '@/common/components/EmptyState'
import { Button } from '@/common/components/Button'
import { navigate } from '@/common/router/router'

/** Shown when the address does not match any page. */
export function NotFoundPage() {
  return (
    <EmptyState
      icon="info"
      title="Page not found"
      action={<Button onClick={() => navigate('')}>Go to the home page</Button>}
    >
      The page you opened does not exist.
    </EmptyState>
  )
}
