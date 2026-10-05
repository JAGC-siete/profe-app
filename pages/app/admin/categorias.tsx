import { useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import type { ColumnDef } from '@tanstack/react-table'
import { SimpleTable } from '../../../components/admin/SimpleTable'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'

interface Category {
  id: string
  name: string
  sort_order: number
  is_active: boolean
}

export default function AdminCategoriasPage() {
  const [rows, setRows] = useState<Category[]>([])
  const [name, setName] = useState('')
  const [sortOrder, setSortOrder] = useState('100')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setError('')
    const res = await fetch('/api/categories?all=1')
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Error')
    setRows(data.categories ?? [])
  }

  useEffect(() => {
    void load().catch((err) => setError(err instanceof Error ? err.message : 'Error'))
  }, [])

  const columns = useMemo<ColumnDef<Category>[]>(
    () => [
      { accessorKey: 'name', header: 'Nombre' },
      { accessorKey: 'sort_order', header: 'Orden' },
      {
        accessorKey: 'is_active',
        header: 'Estado',
        cell: ({ getValue }) =>
          getValue<boolean>() ? (
            <span className="text-brand-300">Activa</span>
          ) : (
            <span className="text-white/40">Baja</span>
          ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const cat = row.original
          return (
            <div className="flex justify-end gap-2">
              {cat.is_active ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    if (!confirm(`Dar de baja «${cat.name}»?`)) return
                    const res = await fetch(`/api/categories/${cat.id}`, { method: 'DELETE' })
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
                    const res = await fetch(`/api/categories/${cat.id}`, {
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
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          sort_order: Number(sortOrder) || 0,
        }),
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
        <title>Categorías · Admin</title>
      </Head>
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold">Categorías</h1>
        <p className="mt-1 text-white/60">Alta y baja suave (no borra históricos)</p>
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      <form onSubmit={onCreate} className="mb-6 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-white/50">Nombre</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required className="w-40" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-white/50">Orden</label>
          <Input
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="w-24"
            type="number"
          />
        </div>
        <Button type="submit" disabled={saving}>
          {saving ? 'Guardando…' : 'Alta'}
        </Button>
      </form>

      <SimpleTable data={rows} columns={columns} filterPlaceholder="Filtrar categoría…" />
    </>
  )
}
