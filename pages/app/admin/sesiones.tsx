import { useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import type { ColumnDef } from '@tanstack/react-table'
import { SimpleTable } from '../../../components/admin/SimpleTable'
import { Button } from '../../../components/ui/button'
import { formatDateOnlyForHonduras } from '../../../lib/timezone'

interface SessionRow {
  id: string
  coach_name: string
  category: string
  scheduled_date: string
  general_objective: string
  is_template?: boolean
  is_archived?: boolean
}

export default function AdminSesionesPage() {
  const [rows, setRows] = useState<SessionRow[]>([])
  const [showArchived, setShowArchived] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    const params = new URLSearchParams()
    if (showArchived) params.set('archived', '1')
    const qs = params.toString() ? `?${params}` : ''
    const res = await fetch(`/api/entrenamientos${qs}`)
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Error')
    setRows(data.sessions ?? [])
  }

  useEffect(() => {
    void load().catch((err) => setError(err instanceof Error ? err.message : 'Error'))
  }, [showArchived])

  const columns = useMemo<ColumnDef<SessionRow>[]>(
    () => [
      {
        accessorKey: 'scheduled_date',
        header: 'Fecha',
        cell: ({ getValue }) => formatDateOnlyForHonduras(getValue<string>()),
      },
      { accessorKey: 'category', header: 'Categoría' },
      { accessorKey: 'coach_name', header: 'Profe' },
      {
        accessorKey: 'general_objective',
        header: 'Objetivo',
        cell: ({ getValue }) => (
          <span className="line-clamp-1 max-w-[240px] text-white/70">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: 'is_archived',
        header: 'Estado',
        cell: ({ getValue }) =>
          getValue<boolean>() ? (
            <span className="text-white/40">Archivada</span>
          ) : (
            <span className="text-brand-300">Activa</span>
          ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const s = row.original
          return (
            <div className="flex justify-end gap-2">
              <Link
                href={`/app/entrenamientos/${s.id}`}
                className="rounded-md px-2 py-1 text-sm text-white/70 hover:bg-white/5"
              >
                Ver
              </Link>
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  const next = !s.is_archived
                  if (next && !confirm('Archivar esta sesión?')) return
                  const res = await fetch(`/api/admin/sessions/${s.id}/archive`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ is_archived: next }),
                  })
                  const data = await res.json()
                  if (!res.ok) {
                    setError(data.error || 'Error')
                    return
                  }
                  await load()
                }}
              >
                {s.is_archived ? 'Restaurar' : 'Archivar'}
              </Button>
            </div>
          )
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showArchived]
  )

  return (
    <>
      <Head>
        <title>Sesiones · Admin</title>
      </Head>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Sesiones</h1>
          <p className="mt-1 text-white/60">Archivar en vez de borrar</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-white/70">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          Incluir archivadas
        </label>
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      <SimpleTable data={rows} columns={columns} filterPlaceholder="Buscar sesión…" />
    </>
  )
}
