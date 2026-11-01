import { ROLE_LABEL, STATUS_LABEL } from '../lib/types'
import type { AccountStatus, Role } from '../lib/types'

export function RoleBadge({ role }: { role: Role }) {
  return <span className={`badge badge-role-${role}`}>{ROLE_LABEL[role]}</span>
}

export function StatusBadge({ status }: { status: AccountStatus }) {
  return <span className={`badge badge-status-${status}`}>{STATUS_LABEL[status]}</span>
}

export function VerifiedBadge({ verified }: { verified: boolean }) {
  return verified ? (
    <span className="badge badge-ok">Verified</span>
  ) : (
    <span className="badge badge-pending">Not verified</span>
  )
}
