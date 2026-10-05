import { useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { Button } from '../../../../components/ui/button'
import { Input } from '../../../../components/ui/input'
import { Textarea } from '../../../../components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/card'
import { cn } from '../../../../lib/utils'

interface Player {
  id: string
  name: string
  category: string
  jersey_number?: number | null
}

export default function CierreSesionPage() {
  const router = useRouter()
  const id = typeof router.query.id === 'string' ? router.query.id : ''
  const [players, setPlayers] = useState<Player[]>([])
  const [present, setPresent] = useState<Record<string, boolean>>({})
  const [category, setCategory] = useState('')
  const [newName, setNewName] = useState('')
  const [intensity, setIntensity] = useState(3)
  const [objectiveMet, setObjectiveMet] = useState(true)
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    if (!id) return
    setLoading(true)
    const res = await fetch(`/api/entrenamientos/${id}/cierre`)
    const data = await res.json()
    if (res.ok) {
      setPlayers(data.players ?? [])
      setCategory(data.category ?? '')
      const map: Record<string, boolean> = {}
      for (const p of data.players ?? []) map[p.id] = true
      for (const a of data.attendance ?? []) map[a.player_id] = a.present
      setPresent(map)
      if (data.review) {
        setIntensity(data.review.intensity)
        setObjectiveMet(data.review.objective_met)
        setNotes(data.review.notes ?? '')
      }
    }
    setLoading(false)
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const addPlayer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim() || !category) return
    const res = await fetch('/api/players', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), category, is_active: true }),
    })
    const data = await res.json()
    if (res.ok) {
      setNewName('')
      await load()
      if (data.player?.id) {
        setPresent((prev) => ({ ...prev, [data.player.id]: true }))
      }
    }
  }

  const save = async () => {
    setStatus('')
    const entries = players.map((p) => ({
      player_id: p.id,
      present: present[p.id] !== false,
    }))
    const res = await fetch(`/api/entrenamientos/${id}/cierre`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        attendance: { entries },
        review: {
          intensity,
          objective_met: objectiveMet,
          notes,
        },
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      setStatus(data.error || 'Error al guardar')
      return
    }
    setStatus('Cierre guardado')
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-400 border-t-transparent" />
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>Cierre · Profe</title>
      </Head>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Cierre de sesión</h1>
          <p className="mt-1 text-white/60">Asistencia · {category}</p>
        </div>
        <Link href={`/app/entrenamientos/${id}`}>
          <Button variant="outline">Volver</Button>
        </Link>
      </div>

      <Card variant="glass" className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Pase de lista</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {players.length === 0 ? (
            <p className="text-sm text-white/50">Sin jugadores en esta categoría. Agrega abajo.</p>
          ) : (
            <ul className="space-y-2">
              {players.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() =>
                      setPresent((prev) => ({ ...prev, [p.id]: !prev[p.id] }))
                    }
                    className={cn(
                      'flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-base transition',
                      present[p.id] !== false
                        ? 'bg-brand-600/30 text-white'
                        : 'bg-white/5 text-white/40 line-through'
                    )}
                  >
                    <span>
                      {p.jersey_number != null ? (
                        <span className="mr-2 text-brand-300">#{p.jersey_number}</span>
                      ) : null}
                      {p.name}
                    </span>
                    <span className="text-sm">
                      {present[p.id] !== false ? 'Presente' : 'Ausente'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={addPlayer} className="flex gap-2 pt-2">
            <Input
              placeholder="Nuevo jugador"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <Button type="submit" size="sm">
              Agregar
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card variant="glass" className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Evaluación</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="mb-2 text-sm text-white/60">Intensidad (1–5)</p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setIntensity(n)}
                  className={cn(
                    'h-12 w-12 rounded-lg text-lg font-bold',
                    intensity === n ? 'bg-brand-600 text-white' : 'bg-white/10 text-white/60'
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={objectiveMet}
              onChange={(e) => setObjectiveMet(e.target.checked)}
              className="h-4 w-4"
            />
            Objetivo cumplido
          </label>
          <Textarea
            rows={3}
            placeholder="Bitácora / incidentes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </CardContent>
      </Card>

      {status ? <p className="mb-3 text-sm text-brand-200">{status}</p> : null}
      <Button onClick={() => void save()}>Guardar cierre</Button>
    </>
  )
}
