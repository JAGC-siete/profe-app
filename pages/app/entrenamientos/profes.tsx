import { useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card'
import { Users } from 'lucide-react'

interface Coach {
  id: string
  full_name: string
  category: string
  notes: string
  is_active: boolean
}

const CATEGORY_ORDER = ['U7', 'U9', 'U13', 'U15', 'Mayor']

export default function ProfesPage() {
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [category, setCategory] = useState('U7')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/coaches')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error')
      setCoaches(data.coaches ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const grouped = useMemo(() => {
    const map = new Map<string, Coach[]>()
    for (const c of coaches) {
      const list = map.get(c.category) ?? []
      list.push(c)
      map.set(c.category, list)
    }
    const keys = [
      ...CATEGORY_ORDER.filter((k) => map.has(k)),
      ...Array.from(map.keys())
        .filter((k) => !CATEGORY_ORDER.includes(k))
        .sort(),
    ]
    return keys.map((k) => ({ category: k, coaches: map.get(k) ?? [] }))
  }, [coaches])

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/coaches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: name, category, notes }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar')
      setName('')
      setNotes('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Head>
        <title>Profes · Profe</title>
      </Head>

      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold tracking-tight">Profes</h1>
        <p className="mt-1 text-white/60">
          Entrenadores por categoría · se usan al crear sesiones
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {loading ? (
            <p className="text-sm text-white/50">Cargando…</p>
          ) : grouped.length === 0 ? (
            <p className="text-sm text-white/50">Aún no hay profes cargados.</p>
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

        <Card variant="glass" className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Agregar profe</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onCreate} className="space-y-3">
              <div>
                <label className="mb-1.5 block text-sm text-white/70">Nombre</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nombre completo"
                  required
                  minLength={2}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-white/70">Categoría</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-white/15 bg-white/5 px-3 text-sm text-white"
                >
                  {CATEGORY_ORDER.map((c) => (
                    <option key={c} value={c} className="bg-pitch-900">
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-white/70">Notas</label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Opcional"
                />
              </div>
              {error ? (
                <p className="rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-100">
                  {error}
                </p>
              ) : null}
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? 'Guardando…' : 'Guardar profe'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
