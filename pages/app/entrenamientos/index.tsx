import { useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { formatDateOnlyForHonduras } from '../../../lib/timezone'
import { Button } from '../../../components/ui/button'
import { Card, CardContent } from '../../../components/ui/card'
import { cn } from '../../../lib/utils'

interface SessionRow {
  id: string
  coach_name: string
  category: string
  scheduled_date: string
  general_objective: string
}

export default function EntrenamientosIndex() {
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError('')
      try {
        const qs = filter === 'all' ? '' : `?category=${encodeURIComponent(filter)}`
        const res = await fetch(`/api/entrenamientos${qs}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Error al cargar')
        if (cancelled) return
        const list: SessionRow[] = data.sessions ?? []
        setSessions(list)
        if (filter === 'all') {
          const cats = Array.from(new Set(list.map((s) => s.category))).sort()
          setCategories(cats)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [filter])

  return (
    <>
      <Head>
        <title>Entrenamientos · Profe</title>
      </Head>

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Sesiones</h1>
          <p className="mt-1 text-white/60">Hojas de entrenamiento por categoría</p>
        </div>
        <Link href="/app/entrenamientos/nuevo">
          <Button>Nueva sesión</Button>
        </Link>
      </div>

      <div className="no-print mb-6 flex flex-wrap gap-2">
        <FilterChip active={filter === 'all'} onClick={() => setFilter('all')} label="Todas" />
        {categories.map((cat) => (
          <FilterChip
            key={cat}
            active={filter === cat}
            onClick={() => setFilter(cat)}
            label={cat}
          />
        ))}
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-400 border-t-transparent" />
        </div>
      )}

      {error && (
        <p className="rounded-lg bg-red-500/20 px-4 py-3 text-red-100">{error}</p>
      )}

      {!loading && !error && sessions.length === 0 && (
        <Card variant="glass">
          <CardContent className="py-12 text-center text-white/60">
            Sin sesiones aún.{' '}
            <Link href="/app/entrenamientos/nuevo" className="text-brand-300 underline">
              Crear la primera
            </Link>
          </CardContent>
        </Card>
      )}

      <ul className="space-y-3">
        {sessions.map((s) => (
          <li key={s.id}>
            <Link href={`/app/entrenamientos/${s.id}`}>
              <Card
                variant="glass"
                className="transition hover:border-brand-500/40 hover:bg-white/[0.07]"
              >
                <CardContent className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-display text-lg font-semibold text-brand-200">
                      {s.category}
                    </p>
                    <p className="text-sm text-white/70">{s.coach_name}</p>
                    <p className="mt-1 line-clamp-1 text-sm text-white/50">
                      {s.general_objective}
                    </p>
                  </div>
                  <time className="shrink-0 text-sm font-medium text-white/80">
                    {formatDateOnlyForHonduras(s.scheduled_date)}
                  </time>
                </CardContent>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-lg px-3 py-1.5 text-sm transition',
        active
          ? 'bg-brand-600 text-white'
          : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
      )}
    >
      {label}
    </button>
  )
}
