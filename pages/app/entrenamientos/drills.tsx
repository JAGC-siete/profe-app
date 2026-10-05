import { useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { Textarea } from '../../../components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card'
import { Trash2 } from 'lucide-react'

interface Drill {
  id: string
  name: string
  explanation: string
  variants_materials: string
  category: string | null
}

export default function DrillsPage() {
  const [drills, setDrills] = useState<Drill[]>([])
  const [q, setQ] = useState('')
  const [name, setName] = useState('')
  const [explanation, setExplanation] = useState('')
  const [materials, setMaterials] = useState('')
  const [category, setCategory] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async (query = q) => {
    setLoading(true)
    const qs = query ? `?q=${encodeURIComponent(query)}` : ''
    const res = await fetch(`/api/drills${qs}`)
    const data = await res.json()
    if (res.ok) setDrills(data.drills ?? [])
    else setError(data.error || 'Error')
    setLoading(false)
  }

  useEffect(() => {
    void load('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const res = await fetch('/api/drills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        explanation,
        variants_materials: materials,
        materials_json: [],
        tags: [],
        category: category || null,
        diagram_image_url: '',
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'No se pudo crear')
      return
    }
    setName('')
    setExplanation('')
    setMaterials('')
    await load()
  }

  const remove = async (id: string) => {
    if (!confirm('¿Eliminar drill?')) return
    await fetch(`/api/drills/${id}`, { method: 'DELETE' })
    await load()
  }

  return (
    <>
      <Head>
        <title>Drills · Profe</title>
      </Head>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Biblioteca de drills</h1>
          <p className="mt-1 text-white/60">Reutiliza ejercicios en nuevas sesiones</p>
        </div>
        <Link href="/app/entrenamientos/nuevo">
          <Button variant="outline">Nueva sesión</Button>
        </Link>
      </div>

      <Card variant="glass" className="mb-8">
        <CardHeader>
          <CardTitle className="text-base">Nuevo drill</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={create} className="grid gap-3 sm:grid-cols-2">
            <Input
              placeholder="Nombre"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Input
              placeholder="Categoría (opcional)"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
            <div className="sm:col-span-2">
              <Textarea
                placeholder="Explicación"
                rows={3}
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                required
              />
            </div>
            <div className="sm:col-span-2">
              <Textarea
                placeholder="Materiales (ej. 12 conos)"
                rows={2}
                value={materials}
                onChange={(e) => setMaterials(e.target.value)}
              />
            </div>
            <Button type="submit">Guardar drill</Button>
          </form>
          {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
        </CardContent>
      </Card>

      <div className="mb-4 flex gap-2">
        <Input
          placeholder="Buscar…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void load(q)
          }}
        />
        <Button type="button" variant="secondary" onClick={() => void load(q)}>
          Buscar
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-400 border-t-transparent" />
        </div>
      ) : (
        <ul className="space-y-3">
          {drills.map((d) => (
            <li key={d.id}>
              <Card variant="glass">
                <CardContent className="flex items-start justify-between gap-3 py-4">
                  <div>
                    <p className="font-display text-lg font-semibold text-brand-200">
                      {d.name}
                    </p>
                    {d.category ? (
                      <p className="text-xs text-white/40">{d.category}</p>
                    ) : null}
                    <p className="mt-1 whitespace-pre-wrap text-sm text-white/70">
                      {d.explanation}
                    </p>
                    {d.variants_materials ? (
                      <p className="mt-2 text-xs text-white/50">{d.variants_materials}</p>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => void remove(d.id)}
                  >
                    <Trash2 className="h-4 w-4 text-red-300" />
                  </Button>
                </CardContent>
              </Card>
            </li>
          ))}
          {drills.length === 0 ? (
            <p className="text-center text-white/50">Sin drills aún.</p>
          ) : null}
        </ul>
      )}
    </>
  )
}
