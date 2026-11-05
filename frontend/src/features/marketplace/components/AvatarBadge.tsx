import { useState } from 'react'
import { Icon } from '@/common/components/Icon'
import { initialsOf } from '../constants'
import { imgSrc } from '../imageStore'
import type { PrototypeAccount } from '../types'
import './AvatarBadge.css'

interface AvatarBadgeProps {
  account?: PrototypeAccount | null
  name?: string
  photoUrl?: string | null
  isStaff?: boolean
  size?: 'sm' | 'md' | 'lg' | 'xl' | ''
  showVerified?: boolean
  noTip?: boolean
}

export function AvatarBadge({
  account,
  name,
  photoUrl,
  isStaff,
  size = 'md',
  showVerified = true,
  noTip = false,
}: AvatarBadgeProps) {
  const [tipOpen, setTipOpen] = useState(false)
  const [imgFailed, setImgFailed] = useState(false)
  const staff = Boolean(isStaff ?? account?.role === 'moderator')
  const displayName = account?.name || name || (staff ? 'RTU Staff' : 'RTU Student')
  const init = initialsOf(displayName)
  const rawSrc = photoUrl || (account?.avatar ? imgSrc(account.avatar) : null)
  const src = imgFailed ? null : rawSrc
  const ver = showVerified && Boolean(account ? account.verified !== false : true)
  const sizeClass = size ? `av-${size}` : 'av-md'

  return (
    <span className={`avw ${sizeClass}`.trim()}>
      <span className={`avatar ${staff ? 'staff' : ''}`.trim()}>
        {src ? (
          <img
            className="avimg"
            src={src}
            alt=""
            data-ini={init}
            onError={() => setImgFailed(true)}
          />
        ) : (
          init
        )}
      </span>
      {ver &&
        (noTip ? (
          <span className="vbadge" aria-hidden="true">
            <Icon name="check" />
          </span>
        ) : (
          <span
            className={`vbadge ${tipOpen ? 'tip-on' : ''}`.trim()}
            tabIndex={0}
            role="img"
            aria-label="Verified RTU account"
            data-tip="Verified RTU account"
            onClick={(e) => {
              e.stopPropagation()
              e.preventDefault()
              setTipOpen((prev) => !prev)
            }}
            onBlur={() => setTipOpen(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setTipOpen((prev) => !prev)
              } else if (e.key === 'Escape') {
                setTipOpen(false)
              }
            }}
          >
            <Icon name="check" />
          </span>
        ))}
    </span>
  )
}
