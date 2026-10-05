import React, { createContext, useContext, useEffect, useState } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { createClient } from './supabase/client'
import { isAdminRole } from './auth/roles'

export interface ProfeProfile {
  id: string
  email?: string | null
  full_name?: string | null
  role: string
  company_id: string | null
  is_active: boolean
}

interface AuthContextValue {
  user: User | null
  session: Session | null
  profile: ProfeProfile | null
  loading: boolean
  isAdmin: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  profile: null,
  loading: true,
  isAdmin: false,
  signOut: async () => {},
  refreshProfile: async () => {},
})

async function fetchProfile(): Promise<ProfeProfile | null> {
  try {
    const res = await fetch('/api/auth/me')
    if (!res.ok) return null
    const data = await res.json()
    return data.user ?? null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<ProfeProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshProfile = async () => {
    const next = await fetchProfile()
    setProfile(next)
  }

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false
    let gen = 0

    const applySession = async (nextSession: Session | null) => {
      const my = ++gen
      setLoading(true)
      setSession(nextSession)
      setUser(nextSession?.user ?? null)
      if (nextSession?.user) {
        const nextProfile = await fetchProfile()
        if (cancelled || my !== gen) return
        setProfile(nextProfile)
      } else {
        if (cancelled || my !== gen) return
        setProfile(null)
      }
      if (cancelled || my !== gen) return
      setLoading(false)
    }

    void supabase.auth.getSession().then(({ data }) => applySession(data.session))

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void applySession(nextSession)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    const supabase = createClient()
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
    setProfile(null)
    window.location.href = '/app/login'
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        isAdmin: isAdminRole(profile?.role),
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
