/**
 * Profile settings store — friends, blocks, privacy.
 * Persisted in localStorage under rtu:profile-settings:<email>.
 */

import { useCallback, useState } from 'react'

export interface PrivacySettings {
  profile: 'Everyone' | 'Friends only' | 'Only me'
  shop: 'Everyone' | 'Friends only'
  messages: 'Everyone' | 'Friends only' | 'No one'
  showContact: boolean
}

export interface ProfileSettingsData {
  friends: string[]
  sent: string[]
  received: string[]
  blocked: string[]
  privacy: PrivacySettings
}

const DEFAULT_PRIVACY: PrivacySettings = {
  profile: 'Everyone',
  shop: 'Everyone',
  messages: 'Everyone',
  showContact: true,
}

function storageKey(email: string): string {
  return `rtu:profile-settings:${email}`
}

function loadData(email: string): ProfileSettingsData {
  try {
    const raw = localStorage.getItem(storageKey(email))
    if (!raw) return emptyData()
    const parsed = JSON.parse(raw) as Partial<ProfileSettingsData>
    return {
      friends: parsed.friends ?? [],
      sent: parsed.sent ?? [],
      received: parsed.received ?? [],
      blocked: parsed.blocked ?? [],
      privacy: {
        ...DEFAULT_PRIVACY,
        ...parsed.privacy,
      },
    }
  } catch {
    return emptyData()
  }
}

function emptyData(): ProfileSettingsData {
  return {
    friends: [],
    sent: [],
    received: [],
    blocked: [],
    privacy: { ...DEFAULT_PRIVACY },
  }
}

function saveData(email: string, data: ProfileSettingsData): void {
  try {
    localStorage.setItem(storageKey(email), JSON.stringify(data))
  } catch {
    /* localStorage unavailable or quota-exceeded; ignore */
  }
}

export function useProfileSettings(email: string) {
  const [data, setData] = useState<ProfileSettingsData>(() => loadData(email))

  const persist = useCallback(
    (updater: (prev: ProfileSettingsData) => ProfileSettingsData) => {
      setData((prev) => {
        const next = updater(prev)
        saveData(email, next)
        return next
      })
    },
    [email],
  )

  const addFriend = useCallback(
    (friendEmail: string) => {
      persist((prev: ProfileSettingsData) => {
        if (prev.friends.includes(friendEmail)) return prev
        const next: ProfileSettingsData = {
          ...prev,
          friends: [...prev.friends, friendEmail],
          sent: prev.sent.filter((e: string) => e !== friendEmail),
          received: prev.received.filter((e: string) => e !== friendEmail),
          blocked: prev.blocked.filter((e: string) => e !== friendEmail),
        }
        return next
      })
    },
    [persist],
  )

  const cancelRequest = useCallback(
    (targetEmail: string) => {
      persist((prev: ProfileSettingsData) => ({
        ...prev,
        sent: prev.sent.filter((e: string) => e !== targetEmail),
      }))
    },
    [persist],
  )

  const acceptRequest = useCallback(
    (fromEmail: string) => {
      persist((prev: ProfileSettingsData) => {
        if (prev.friends.includes(fromEmail)) return prev
        return {
          ...prev,
          friends: [...prev.friends, fromEmail],
          received: prev.received.filter((e: string) => e !== fromEmail),
        }
      })
    },
    [persist],
  )

  const declineRequest = useCallback(
    (fromEmail: string) => {
      persist((prev: ProfileSettingsData) => ({
        ...prev,
        received: prev.received.filter((e: string) => e !== fromEmail),
      }))
    },
    [persist],
  )

  const unfriend = useCallback(
    (friendEmail: string) => {
      persist((prev: ProfileSettingsData) => ({
        ...prev,
        friends: prev.friends.filter((e: string) => e !== friendEmail),
        blocked: prev.blocked.filter((e: string) => e !== friendEmail),
      }))
    },
    [persist],
  )

  const block = useCallback(
    (targetEmail: string) => {
      persist((prev: ProfileSettingsData) => {
        if (prev.blocked.includes(targetEmail)) return prev
        return {
          ...prev,
          blocked: [...prev.blocked, targetEmail],
          friends: prev.friends.filter((e: string) => e !== targetEmail),
          sent: prev.sent.filter((e: string) => e !== targetEmail),
          received: prev.received.filter((e: string) => e !== targetEmail),
        }
      })
    },
    [persist],
  )

  const unblock = useCallback(
    (targetEmail: string) => {
      persist((prev: ProfileSettingsData) => ({
        ...prev,
        blocked: prev.blocked.filter((e: string) => e !== targetEmail),
      }))
    },
    [persist],
  )

  const setPrivacy = useCallback(
    (updates: Partial<PrivacySettings>) => {
      persist((prev: ProfileSettingsData) => ({
        ...prev,
        privacy: { ...prev.privacy, ...updates },
      }))
    },
    [persist],
  )

  return {
    friends: data.friends,
    sent: data.sent,
    received: data.received,
    blocked: data.blocked,
    privacy: data.privacy,
    addFriend,
    cancelRequest,
    acceptRequest,
    declineRequest,
    unfriend,
    block,
    unblock,
    setPrivacy,
  }
}
