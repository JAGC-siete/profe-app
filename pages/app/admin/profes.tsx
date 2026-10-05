import { useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import type { ColumnDef } from '@tanstack/react-table'
import { SimpleTable } from '../../../components/admin/SimpleTable'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'

interface Coach {
  id: string
  full_name: string
  category: string
  notes: string
  is_active: boolean
}

interface Category {
  id: string
  name: string
}

export default function AdminProfesPage() {
  const [rows, setRows] = useState<Coach[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [fullName, setFullName] = useState('')
  const [category, setCategory] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const [cRes, catRes] = await Promise.all([
      fetch('/api/coaches?all=1'),
      fetch('/api/categories'),
    ])
    const cData = await cRes.json()
    const catData = await catRes.json()
    if (!cRes.ok) throw new Error(cData.error || 'Error coaches')
    if (!catRes.ok) throw new Error(catData.error || 'Error categorías')
    setRows(cData.coaches ?? [])
    setCategories(catData.categories ?? [])
    if (!category && catData.categories?.[0]?.name) {
      setCategory(catData.categories[0].name)
    }
  }

  useEffect(() => {
    void load().catch((err) => setError(err instanceof Error ? err.message : 'Error'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const columns = useMemo<ColumnDef<Coach>[]>(
    () => [
      { accessorKey: 'full_name', header: 'Nombre' },
      { accessorKey: 'category', header: 'Categoría' },
      {
        accessorKey: 'notes',
        header: 'Notas',
        cell: ({ getValue }) => (
          <span className="line-clamp-1 max-w-[200px] text-white/55">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: 'is_active',
        header: 'Estado',
        cell: ({ getValue }) =>
          getValue<boolean>() ? (
            <span className="text-brand-300">Activo</span>
          ) : (
            <span className="text-white/40">Baja</span>
          ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const coach = row.original
          return (
            <div className="flex justify-end gap-2">
              {coach.is_active ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    if (!confirm(`Dar de baja a ${coach.full_name}?`)) return
                    const res = await fetch(`/api/coaches/${coach.id}`, { method: 'DELETE' })
                    const data = await res.json()
                    if (!res.ok) {
                      setError(data.error || 'Error')
                      return
                    }
                    await load()
                  }}
                >
                  Baja
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    const res = await fetch(`/api/coaches/${coach.id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ is_active: true }),
                    })
                    const data = await res.json()
                    if (!res.ok) {
                      setError(data.error || 'Error')
                      return
                    }
                    await load()
                  }}
                >
                  Activar
                </Button>
              )}
            </div>
          )
        },
      },
    ],
    []
  )

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/coaches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName, category, notes }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error')
      setFullName('')
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
        <title>Entrenadores · Admin</title>
      </Head>
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold">Entrenadores</h1>
        <p className="mt-1 text-white/60">Listado por categoría · baja suave</p>
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      <form onSubmit={onCreate} className="mb-6 grid gap-3 sm:grid-cols-4">
        <Input
          placeholder="Nombre"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
        />
        <select
          className="h-10 rounded-md border border-white/10 bg-pitch-900 px-3 text-sm"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          required
        >
          {categories.map((c) => (
            <option key={c.id} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
        <Input placeholder="Notas" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <Button type="submit" disabled={saving}>
          {saving ? 'Guardando…' : 'Alta'}
        </Button>
      </form>

      <SimpleTable data={rows} columns={columns} filterPlaceholder="Buscar profe…" />
    </>
  )
}
