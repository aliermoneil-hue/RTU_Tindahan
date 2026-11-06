import { EmptyState } from '@/common/components/EmptyState'
import { Link } from '@/common/router/router'
import type { PageInfo } from '../routes'

/**
 * Temporary page for screens that are not built yet (Stage 3).
 * It shows what the page will become and whether the backend supports it.
 * Replace the entry in AppRoutes.tsx with the real page when it is ready.
 */
export function PlaceholderPage({ page }: { page: PageInfo }) {
  return (
    <>
      <div>
        <div className="crumbs">
          <Link to="">Home</Link> / {page.title}
        </div>
        <h1>{page.title}</h1>
      </div>
      <EmptyState icon={page.icon} title={`${page.title} is coming in the next stage`}>
        {page.about}
      </EmptyState>
      <div className={`note ${page.backend === 'available' ? 'green' : ''}`}>
        <b>Development note:</b>
        <span>
          {page.backend === 'available'
            ? 'The backend already has what this page needs.'
            : 'The backend has no API for this page yet, so no real data can be shown. We will not use fake data.'}
        </span>
      </div>
    </>
  )
}
