import { useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import type { ColumnDef } from '@tanstack/react-table'
import { SimpleTable } from '../../../components/admin/SimpleTable'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { useAuth } from '../../../lib/auth'

interface Profile {
  id: string
  full_name: string | null
  role: string
  is_active: boolean
  company_id: string | null
}

interface Category {
  id: string
  name: string
}

export default function AdminUsuariosPage() {
  const { profile: me } = useAuth()
  const [rows, setRows] = useState<Profile[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [category, setCategory] = useState('')
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [saving, setSaving] = useState(false)

  const canInvite =
    me?.role === 'company_admin' || me?.role === 'super_admin'

  const load = async () => {
    const [pRes, catRes] = await Promise.all([
      fetch('/api/admin/profiles'),
      fetch('/api/categories'),
    ])
    const pData = await pRes.json()
    const catData = await catRes.json()
    if (!pRes.ok) throw new Error(pData.error || 'Error perfiles')
    if (!catRes.ok) throw new Error(catData.error || 'Error categorías')
    setRows(pData.profiles ?? [])
    setCategories(catData.categories ?? [])
    if (!category && catData.categories?.[0]?.name) {
      setCategory(catData.categories[0].name)
    }
  }

  useEffect(() => {
    void load().catch((err) => setError(err instanceof Error ? err.message : 'Error'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const columns = useMemo<ColumnDef<Profile>[]>(
    () => [
      {
        accessorKey: 'full_name',
        header: 'Nombre',
        cell: ({ getValue }) => getValue<string | null>() || '—',
      },
      { accessorKey: 'role', header: 'Rol' },
      {
        accessorKey: 'is_active',
        header: 'Estado',
        cell: ({ getValue }) =>
          getValue<boolean>() ? (
            <span className="text-brand-300">Activo</span>
          ) : (
            <span className="text-white/40">Inactivo</span>
          ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const p = row.original
          if (!canInvite || p.id === me?.id) return null
          return (
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  const next = !p.is_active
                  if (!next && !confirm(`Desactivar a ${p.full_name || p.id}?`)) return
                  const res = await fetch('/api/admin/profiles', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: p.id, is_active: next }),
                  })
                  const data = await res.json()
                  if (!res.ok) {
                    setError(data.error || 'Error')
                    return
                  }
                  await load()
                }}
              >
                {p.is_active ? 'Desactivar' : 'Activar'}
              </Button>
            </div>
          )
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canInvite, me?.id]
  )

  const onInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canInvite) return
    setSaving(true)
    setError('')
    setOk('')
    try {
      const res = await fetch('/api/admin/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          full_name: fullName,
          category: category || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error')
      setEmail('')
      setFullName('')
      // Prefer API message — do not claim email was sent when invited:false
      setOk(
        typeof data.message === 'string' && data.message
          ? data.message
          : data.invited
            ? 'Invitación enviada'
            : 'Usuario vinculado / reactivado (sin nueva invitación por email)'
      )
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
        <title>Usuarios · Admin</title>
      </Head>
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold">Usuarios</h1>
        <p className="mt-1 text-white/60">
          Perfiles Auth de la academia · invitar coach
        </p>
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}
      {ok && (
        <p className="mb-4 rounded-lg border border-brand-500/30 bg-brand-500/10 px-3 py-2 text-sm text-brand-200">
          {ok}
        </p>
      )}

      {canInvite ? (
        <form onSubmit={onInvite} className="mb-6 grid gap-3 sm:grid-cols-4">
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            placeholder="Nombre completo"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
          <select
            className="h-10 rounded-md border border-white/10 bg-pitch-900 px-3 text-sm"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">Sin categoría roster</option>
            {categories.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
          <Button type="submit" disabled={saving}>
            {saving ? 'Invitando…' : 'Invitar coach'}
          </Button>
        </form>
      ) : (
        <p className="mb-6 text-sm text-white/50">
          Solo company_admin / super_admin pueden invitar o desactivar.
        </p>
      )}

      <SimpleTable data={rows} columns={columns} filterPlaceholder="Buscar usuario…" />
    </>
  )
}
