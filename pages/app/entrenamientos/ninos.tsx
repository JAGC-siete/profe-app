import { useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card'
import { cn } from '../../../lib/utils'
import { Pencil, Phone, Shield, UserMinus, UserPlus } from 'lucide-react'
import { useAuth } from '../../../lib/auth'
import { fetchActiveCategories, type ProfeCategory } from '../../../lib/categories'

interface Player {
  id: string
  name: string
  category: string
  jersey_number: number | null
  birthdate: string | null
  guardian_phone: string
  notes: string
  is_active: boolean
}

function ageFromBirthdate(birthdate: string | null): string {
  if (!birthdate) return '—'
  const d = new Date(`${birthdate}T12:00:00`)
  if (Number.isNaN(d.getTime())) return '—'
  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1
  return `${age} a`
}

function waLink(phone: string): string | null {
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 8) return null
  return `https://wa.me/${digits}`
}

const emptyForm = {
  name: '',
  category: '',
  jersey_number: '',
  birthdate: '',
  guardian_phone: '',
  notes: '',
}

export default function NinosPage() {
  const { isAdmin } = useAuth()
  const [players, setPlayers] = useState<Player[]>([])
  const [categories, setCategories] = useState<ProfeCategory[]>([])
  const [category, setCategory] = useState<string>('')
  const [showInactive, setShowInactive] = useState(false)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<Player | null>(null)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (showInactive) params.set('all', '1')
      const qs = params.toString() ? `?${params}` : ''
      const [res, cats] = await Promise.all([
        fetch(`/api/players${qs}`),
        fetchActiveCategories(),
      ])
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error')
      setPlayers(data.players ?? [])
      setCategories(cats)
      setCategory((prev) => prev || cats[0]?.name || '')
      setForm((prev) => ({
        ...prev,
        category: prev.category || cats[0]?.name || '',
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [showInactive])

  const counts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const c of categories) map[c.name] = 0
    for (const p of players) {
      if (!p.is_active) continue
      map[p.category] = (map[p.category] ?? 0) + 1
    }
    return map
  }, [players, categories])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return players
      .filter((p) => p.category === category)
      .filter((p) => (showInactive ? true : p.is_active))
      .filter((p) => !q || p.name.toLowerCase().includes(q))
  }, [players, category, query, showInactive])

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const jersey =
        form.jersey_number.trim() === ''
          ? null
          : Number.parseInt(form.jersey_number, 10)
      const res = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          category: form.category,
          jersey_number: Number.isFinite(jersey as number) ? jersey : null,
          birthdate: form.birthdate || null,
          guardian_phone: form.guardian_phone,
          notes: form.notes,
          is_active: true,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo crear')
      setForm({ ...emptyForm, category: form.category })
      setCategory(form.category)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editing) return
    setSaving(true)
    setError('')
    try {
      const jersey =
        form.jersey_number.trim() === ''
          ? null
          : Number.parseInt(form.jersey_number, 10)
      const res = await fetch(`/api/players/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          category: form.category,
          jersey_number: Number.isFinite(jersey as number) ? jersey : null,
          birthdate: form.birthdate || null,
          guardian_phone: form.guardian_phone,
          notes: form.notes,
          is_active: editing.is_active,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo actualizar')
      setEditing(null)
      setForm({ ...emptyForm, category })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  const softDelete = async (p: Player) => {
    if (!window.confirm(`¿Dar de baja a ${p.name}?`)) return
    const res = await fetch(`/api/players/${p.id}`, { method: 'DELETE' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data.error || 'No se pudo dar de baja')
      return
    }
    await load()
  }

  const reactivate = async (p: Player) => {
    const res = await fetch(`/api/players/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: true }),
    })
    if (res.ok) await load()
  }

  const startEdit = (p: Player) => {
    setEditing(p)
    setForm({
      name: p.name,
      category: p.category,
      jersey_number: p.jersey_number != null ? String(p.jersey_number) : '',
      birthdate: p.birthdate ?? '',
      guardian_phone: p.guardian_phone ?? '',
      notes: p.notes === '[ejemplo]' ? '' : p.notes ?? '',
    })
  }

  const cancelEdit = () => {
    setEditing(null)
    setForm({ ...emptyForm, category })
  }

  return (
    <>
      <Head>
        <title>Niños · Profe</title>
      </Head>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Niños</h1>
          <p className="mt-1 text-white/60">
            Inscritos por categoría · usados en el pase de lista
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {isAdmin && (
            <Link href="/app/admin/ninos">
              <Button size="sm" variant="secondary" className="gap-1.5">
                <Shield className="h-4 w-4" />
                Admin
              </Button>
            </Link>
          )}
          {isAdmin && (
            <label className="inline-flex items-center gap-2 text-sm text-white/70">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="rounded border-white/30"
              />
              Mostrar dados de baja
            </label>
          )}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              setCategory(c.name)
              if (!editing) setForm((f) => ({ ...f, category: c.name }))
            }}
            className={cn(
              'rounded-lg px-3 py-2 text-sm transition',
              category === c.name
                ? 'bg-brand-600 text-white'
                : 'bg-white/10 text-white/70 hover:bg-white/15'
            )}
          >
            {c.name}{' '}
            <span className="opacity-70">({counts[c.name] ?? 0})</span>
          </button>
        ))}
      </div>

      <div className="mb-6">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Buscar en ${category}…`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card variant="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">
              {category} · {filtered.length} inscrito
              {filtered.length === 1 ? '' : 's'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-white/50">Cargando…</p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-white/50">Sin niños en esta categoría.</p>
            ) : (
              <ul className="divide-y divide-white/10">
                {filtered.map((p) => {
                  const wa = waLink(p.guardian_phone)
                  return (
                    <li
                      key={p.id}
                      className={cn(
                        'flex flex-wrap items-center gap-3 py-3',
                        !p.is_active && 'opacity-50'
                      )}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-600/25 text-xs font-bold text-brand-100">
                        {p.jersey_number ?? '—'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-white">
                          {p.name}
                          {!p.is_active ? (
                            <span className="ml-2 text-xs text-red-300">baja</span>
                          ) : null}
                        </p>
                        <p className="text-xs text-white/45">
                          {ageFromBirthdate(p.birthdate)}
                          {p.guardian_phone
                            ? ` · ${p.guardian_phone}`
                            : ' · sin teléfono'}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        {p.guardian_phone ? (
                          <a
                            href={wa ?? `tel:${p.guardian_phone}`}
                            target={wa ? '_blank' : undefined}
                            rel={wa ? 'noreferrer' : undefined}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-brand-300 hover:bg-white/10"
                            title="Contactar tutor"
                          >
                            <Phone className="h-4 w-4" />
                          </a>
                        ) : null}
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          title="Editar"
                          onClick={() => startEdit(p)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {isAdmin &&
                          (p.is_active ? (
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              title="Dar de baja"
                              onClick={() => void softDelete(p)}
                            >
                              <UserMinus className="h-4 w-4 text-red-300" />
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              title="Reactivar"
                              onClick={() => void reactivate(p)}
                            >
                              <UserPlus className="h-4 w-4 text-brand-300" />
                            </Button>
                          ))}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card variant="glass" className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">
              {editing ? 'Editar niño' : 'Agregar niño'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={editing ? saveEdit : submitCreate}
              className="space-y-3"
            >
              <div>
                <label className="mb-1.5 block text-sm text-white/70">Nombre</label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  minLength={1}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-white/70">Categoría</label>
                <select
                  value={form.category}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, category: e.target.value }))
                  }
                  className="flex h-10 w-full rounded-md border border-white/15 bg-white/5 px-3 text-sm text-white"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.name} className="bg-pitch-900">
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm text-white/70">Dorsal</label>
                  <Input
                    type="number"
                    min={1}
                    max={99}
                    value={form.jersey_number}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, jersey_number: e.target.value }))
                    }
                    placeholder="1–99"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm text-white/70">Nacimiento</label>
                  <Input
                    type="date"
                    value={form.birthdate}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, birthdate: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-white/70">
                  Tel / WhatsApp tutor
                </label>
                <Input
                  value={form.guardian_phone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, guardian_phone: e.target.value }))
                  }
                  placeholder="+504…"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-white/70">Notas</label>
                <Input
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Opcional"
                />
              </div>
              {error ? (
                <p className="rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-100">
                  {error}
                </p>
              ) : null}
              <div className="flex gap-2">
                {editing ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={cancelEdit}
                  >
                    Cancelar
                  </Button>
                ) : null}
                <Button type="submit" className="flex-1" disabled={saving}>
                  {saving ? 'Guardando…' : editing ? 'Guardar' : 'Agregar'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
