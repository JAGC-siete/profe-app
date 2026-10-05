import { useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card'

interface Stats {
  players_active: number
  coaches_active: number
  categories_active: number
  drills: number
  sessions_active: number
  sessions_this_month: number
}

const LINKS = [
  { href: '/app/admin/categorias', label: 'Categorías' },
  { href: '/app/admin/profes', label: 'Entrenadores' },
  { href: '/app/admin/ninos', label: 'Niños' },
  { href: '/app/admin/sesiones', label: 'Sesiones' },
  { href: '/app/admin/drills', label: 'Drills' },
  { href: '/app/admin/usuarios', label: 'Usuarios' },
]

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/admin/stats')
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Error')
        if (!cancelled) setStats(data.stats)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const cards = [
    { label: 'Niños activos', value: stats?.players_active },
    { label: 'Profes activos', value: stats?.coaches_active },
    { label: 'Categorías', value: stats?.categories_active },
    { label: 'Drills', value: stats?.drills },
    { label: 'Sesiones activas', value: stats?.sessions_active },
    { label: 'Sesiones este mes', value: stats?.sessions_this_month },
  ]

  return (
    <>
      <Head>
        <title>Admin · Profe</title>
      </Head>

      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold tracking-tight">Admin academia</h1>
        <p className="mt-1 text-white/60">
          Alta y baja de categorías, entrenadores, niños, sesiones y drills
        </p>
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.label} className="border-white/10 bg-pitch-900/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-white/55">{c.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-display text-3xl font-bold text-brand-300">
                {c.value == null ? '—' : c.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10"
          >
            {l.label}
          </Link>
        ))}
      </div>
    </>
  )
}
