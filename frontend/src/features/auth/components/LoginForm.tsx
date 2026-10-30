'use client'

import { useState } from 'react'
import { Button } from '@/common/components/Button'
import type { LoginCredentials } from '../types'

interface LoginFormProps {
  onSubmit: (data: LoginCredentials) => void
  isLoading: boolean
  error: string | null
}

export function LoginForm({ onSubmit, isLoading, error }: LoginFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({ email, password })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-full max-w-md mx-auto">
      <h2 className="text-2xl font-semibold text-center text-slate-900">Sign in</h2>

      <div className="space-y-2">
        <label htmlFor="email" className="block text-sm font-medium text-slate-700">
          RTU Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          placeholder="student@rtu.edu.ph"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className="block text-sm font-medium text-slate-700">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 text-center bg-red-50 px-3 py-2 rounded-md">
          {error}
        </p>
      )}

      <Button type="submit" variant="primary" size="lg" isLoading={isLoading} disabled={isLoading}>
        Sign in
      </Button>

      <p className="text-sm text-center text-slate-600 mt-4">
        Demo accounts: <br />
        student@rtu.edu.ph / staff@rtu.edu.ph (password: password123)
      </p>
    </form>
  )
}
