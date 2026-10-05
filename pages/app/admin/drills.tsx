import { useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import type { ColumnDef } from '@tanstack/react-table'
import { SimpleTable } from '../../../components/admin/SimpleTable'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'

interface Drill {
  id: string
  name: string
  category: string | null
  explanation: string
  tags: string[]
}

export default function AdminDrillsPage() {
  const [rows, setRows] = useState<Drill[]>([])
  const [name, setName] = useState('')
  const [explanation, setExplanation] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const res = await fetch('/api/drills')
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Error')
    setRows(data.drills ?? [])
  }

  useEffect(() => {
    void load().catch((err) => setError(err instanceof Error ? err.message : 'Error'))
  }, [])

  const columns = useMemo<ColumnDef<Drill>[]>(
    () => [
      { accessorKey: 'name', header: 'Nombre' },
      {
        accessorKey: 'category',
        header: 'Categoría',
        cell: ({ getValue }) => getValue<string | null>() || '—',
      },
      {
        accessorKey: 'explanation',
        header: 'Explicación',
        cell: ({ getValue }) => (
          <span className="line-clamp-1 max-w-[280px] text-white/65">{getValue<string>()}</span>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const drill = row.original
          return (
            <div className="flex justify-end gap-2">
              <Link
                href="/app/entrenamientos/drills"
                className="rounded-md px-2 py-1 text-sm text-white/70 hover:bg-white/5"
              >
                Biblioteca
              </Link>
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  if (!confirm(`Eliminar drill «${drill.name}»?`)) return
                  const res = await fetch(`/api/drills/${drill.id}`, { method: 'DELETE' })
                  const data = await res.json()
                  if (!res.ok) {
                    setError(data.error || 'Error')
                    return
                  }
                  await load()
                }}
              >
                Eliminar
              </Button>
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
      const res = await fetch('/api/drills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          explanation,
          variants_materials: '',
          materials_json: [],
          tags: [],
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error')
      setName('')
      setExplanation('')
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
        <title>Drills · Admin</title>
      </Head>
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold">Drills</h1>
        <p className="mt-1 text-white/60">Biblioteca de ejercicios</p>
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      <form onSubmit={onCreate} className="mb-6 grid gap-3 sm:grid-cols-[1fr_2fr_auto]">
        <Input
          placeholder="Nombre"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Input
          placeholder="Explicación breve"
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          required
        />
        <Button type="submit" disabled={saving}>
          {saving ? 'Guardando…' : 'Alta'}
        </Button>
      </form>

      <SimpleTable data={rows} columns={columns} filterPlaceholder="Buscar drill…" />
    </>
  )
}
