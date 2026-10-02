import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { serialize } from 'cookie'
import { NextApiRequest, NextApiResponse } from 'next'
import { env } from '../env'

export function createClient(req: NextApiRequest, res: NextApiResponse) {
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables')
    return createServerClient('https://placeholder.supabase.co', 'placeholder-key', {
      cookies: {
        get: () => undefined,
        set: () => {},
        remove: () => {},
      },
    })
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return req.cookies[name]
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          const isAuthCookie = name.includes('sb-') && name.includes('auth-token')
          const cookieMaxAge =
            isAuthCookie && !options?.maxAge ? 24 * 60 * 60 : options?.maxAge

          const cookie = serialize(name, value, {
            path: options?.path ?? '/',
            httpOnly: options?.httpOnly ?? true,
            secure: options?.secure ?? process.env.NODE_ENV === 'production',
            sameSite: (options?.sameSite as 'lax' | 'strict' | 'none') ?? 'lax',
            domain: options?.domain,
            maxAge: cookieMaxAge,
            expires: options?.expires,
          })

          const prev = res.getHeader('Set-Cookie')
          if (!prev) res.setHeader('Set-Cookie', cookie)
          else if (Array.isArray(prev)) res.setHeader('Set-Cookie', [...prev, cookie])
          else res.setHeader('Set-Cookie', [prev as string, cookie])
        } catch (error) {
          console.warn('Failed to set cookie:', name, error)
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          const cookie = serialize(name, '', {
            path: options?.path ?? '/',
            httpOnly: options?.httpOnly ?? true,
            secure: options?.secure ?? process.env.NODE_ENV === 'production',
            sameSite: (options?.sameSite as 'lax' | 'strict' | 'none') ?? 'lax',
            domain: options?.domain,
            maxAge: 0,
            expires: new Date(0),
          })

          const prev = res.getHeader('Set-Cookie')
          if (!prev) res.setHeader('Set-Cookie', cookie)
          else if (Array.isArray(prev)) res.setHeader('Set-Cookie', [...prev, cookie])
          else res.setHeader('Set-Cookie', [prev as string, cookie])
        } catch (error) {
          console.warn('Failed to remove cookie:', name, error)
        }
      },
    },
  })
}

export function createAdminClient() {
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL for admin client')
  }
  if (!serviceKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY for admin client')
  }

  return createSupabaseClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
