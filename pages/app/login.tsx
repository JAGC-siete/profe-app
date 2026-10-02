import { useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { createClient } from '../../lib/supabase/client'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password: password.replace(/[\u0009\u000A\u000D\u00A0\u200B\u200C\u200D\uFEFF]/g, ''),
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Error de autenticación')
      }

      if (data?.session?.access_token && data?.session?.refresh_token) {
        const supabase = createClient()
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        })
      }

      await router.push('/app/entrenamientos')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de autenticación')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Head>
        <title>Entrar · Profe</title>
      </Head>
      <div className="relative flex min-h-screen items-center justify-center px-4">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(16,185,129,0.35), transparent 60%)',
          }}
        />
        <Card variant="glass" className="relative z-10 w-full max-w-md">
          <CardHeader>
            <p className="font-display text-3xl font-bold text-brand-300">Profe</p>
            <CardTitle className="text-xl">Sesión de entrenador</CardTitle>
            <CardDescription>Acceso multi-tenant por academia / club</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm text-white/70">Email</label>
                <Input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-white/70">Contraseña</label>
                <Input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {error && (
                <p className="rounded-md bg-red-500/20 px-3 py-2 text-sm text-red-200">{error}</p>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Entrando…' : 'Entrar'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
