/**
 * Shared types used across all features.
 * Keep these generic so no single feature owns them.
 */

export type Role = 'visitor' | 'user' | 'office_staff' | 'moderator' | 'administrator'

export type MemberType = 'student' | 'faculty' | 'personnel'

export type AccountStatus = 'active' | 'suspended' | 'banned'

export interface User {
  id: string
  email: string
  display_name: string
  role: Role
  member_type: MemberType
  college: string
  year_level: number | null
  contact_number: string
  profile_photo: string | null
  status: AccountStatus
  is_verified: boolean
  date_joined: string
}

export interface Listing {
  id: string
  title: string
  description: string
  price: number
  category: string
  condition?: 'new' | 'like_new' | 'used' | 'damaged'
  photos: string[]
  seller_id: string
  seller_name: string
  is_service: boolean
  is_published: boolean
  created_at: string
}

export interface AuthFormData {
  email: string
  display_name: string
  password: string
  password_confirm: string
  member_type: MemberType
  college: string
  year_level: number | null
  contact_number: string
  privacy_consent: boolean
}

export interface ApiError {
  message: string
  field?: string
}
