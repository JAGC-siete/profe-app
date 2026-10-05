import { useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { Button } from '../../../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card'
import { Users, Shield } from 'lucide-react'
import { useAuth } from '../../../lib/auth'
import {
  fetchActiveCategories,
  sortCategoryKeys,
  type ProfeCategory,
} from '../../../lib/categories'

interface Coach {
  id: string
  full_name: string
  category: string
  notes: string
  is_active: boolean
}

export default function ProfesPage() {
  const { isAdmin } = useAuth()
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [catalog, setCatalog] = useState<ProfeCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const [cRes, cats] = await Promise.all([
          fetch('/api/coaches'),
          fetchActiveCategories(),
        ])
        const data = await cRes.json()
        if (!cRes.ok) throw new Error(data.error || 'Error')
        if (!cancelled) {
          setCoaches(data.coaches ?? [])
          setCatalog(cats)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const grouped = useMemo(() => {
    const map = new Map<string, Coach[]>()
    for (const c of coaches) {
      const list = map.get(c.category) ?? []
      list.push(c)
      map.set(c.category, list)
    }
    const keys = sortCategoryKeys(Array.from(map.keys()), catalog)
    return keys.map((k) => ({ category: k, coaches: map.get(k) ?? [] }))
  }, [coaches, catalog])

  return (
    <>
      <Head>
        <title>Profes · Profe</title>
      </Head>

      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Profes</h1>
          <p className="mt-1 text-white/60">
            Entrenadores por categoría · se usan al crear sesiones
          </p>
        </div>
        {isAdmin && (
          <Link href="/app/admin/profes">
            <Button size="sm" variant="secondary" className="gap-1.5">
              <Shield className="h-4 w-4" />
              Gestionar en Admin
            </Button>
          </Link>
        )}
      </div>

      {error ? (
        <p className="mb-4 rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-100">{error}</p>
      ) : null}

      <div className="space-y-4">
        {loading ? (
          <p className="text-sm text-white/50">Cargando…</p>
        ) : grouped.length === 0 ? (
          <p className="text-sm text-white/50">
            Aún no hay profes cargados.
            {isAdmin ? ' Usa Admin → Entrenadores para dar de alta.' : ''}
          </p>
        ) : (
          grouped.map((g) => (
            <Card key={g.category} variant="glass">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-brand-200">{g.category}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="divide-y divide-white/10">
                  {g.coaches.map((c) => (
                    <li
                      key={c.id}
                      className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <div>
                        <p className="font-medium text-white">{c.full_name}</p>
                        {c.notes ? (
                          <p className="mt-0.5 text-xs text-white/45">{c.notes}</p>
                        ) : null}
                      </div>
                      <Users className="mt-0.5 h-4 w-4 shrink-0 text-brand-300/70" />
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </>
  )
}
