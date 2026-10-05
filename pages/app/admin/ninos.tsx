import { useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import type { ColumnDef } from '@tanstack/react-table'
import { SimpleTable } from '../../../components/admin/SimpleTable'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'

interface Player {
  id: string
  name: string
  category: string
  jersey_number: number | null
  guardian_phone: string
  is_active: boolean
}

interface Category {
  id: string
  name: string
}

export default function AdminNinosPage() {
  const [rows, setRows] = useState<Player[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [filterCat, setFilterCat] = useState('all')
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const params = new URLSearchParams({ all: '1' })
    if (filterCat !== 'all') params.set('category', filterCat)
    const [pRes, catRes] = await Promise.all([
      fetch(`/api/players?${params}`),
      fetch('/api/categories'),
    ])
    const pData = await pRes.json()
    const catData = await catRes.json()
    if (!pRes.ok) throw new Error(pData.error || 'Error niños')
    if (!catRes.ok) throw new Error(catData.error || 'Error categorías')
    setRows(pData.players ?? [])
    setCategories(catData.categories ?? [])
    if (!category && catData.categories?.[0]?.name) {
      setCategory(catData.categories[0].name)
    }
  }

  useEffect(() => {
    void load().catch((err) => setError(err instanceof Error ? err.message : 'Error'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterCat])

  const columns = useMemo<ColumnDef<Player>[]>(
    () => [
      { accessorKey: 'name', header: 'Nombre' },
      { accessorKey: 'category', header: 'Categoría' },
      {
        accessorKey: 'jersey_number',
        header: '#',
        cell: ({ getValue }) => getValue<number | null>() ?? '—',
      },
      { accessorKey: 'guardian_phone', header: 'Tutor' },
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
          const player = row.original
          return (
            <div className="flex justify-end gap-2">
              {player.is_active ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    if (!confirm(`Dar de baja a ${player.name}?`)) return
                    const res = await fetch(`/api/players/${player.id}`, { method: 'DELETE' })
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
                    const res = await fetch(`/api/players/${player.id}`, {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filterCat]
  )

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, category }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error')
      setName('')
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
        <title>Niños · Admin</title>
      </Head>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Niños</h1>
          <p className="mt-1 text-white/60">Matrícula academia · baja suave</p>
        </div>
        <select
          className="h-10 rounded-md border border-white/10 bg-pitch-900 px-3 text-sm"
          value={filterCat}
          onChange={(e) => setFilterCat(e.target.value)}
        >
          <option value="all">Todas</option>
          {categories.map((c) => (
            <option key={c.id} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      <form onSubmit={onCreate} className="mb-6 flex flex-wrap gap-3">
        <Input
          placeholder="Nombre"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-56"
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
        <Button type="submit" disabled={saving}>
          {saving ? 'Guardando…' : 'Alta'}
        </Button>
      </form>

      <SimpleTable data={rows} columns={columns} filterPlaceholder="Buscar niño…" />
    </>
  )
}
