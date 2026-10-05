import { useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { formatDateOnlyForHonduras } from '../../../lib/timezone'
import type { MaterialItem } from '../../../lib/materials'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { Textarea } from '../../../components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card'
import {
  Copy,
  Mail,
  MessageCircle,
  Play,
  Printer,
  Trash2,
  ClipboardCheck,
} from 'lucide-react'

interface Phase {
  id: string
  phase_name: string
  explanation: string
  variants_materials: string
  materials_json?: MaterialItem[]
  diagram_image_url: string | null
  duration_minutes?: number
  sort_order: number
}

interface Session {
  id: string
  coach_name: string
  category: string
  scheduled_date: string
  general_objective: string
  physical_objective: string
  devotional_theme: string
  is_template?: boolean
  phases: Phase[]
  total_minutes?: number
  materials?: MaterialItem[]
}

export default function SesionDetallePage() {
  const router = useRouter()
  const id = typeof router.query.id === 'string' ? router.query.id : ''
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [shareOpen, setShareOpen] = useState(false)
  const [shareTo, setShareTo] = useState('')
  const [shareMessage, setShareMessage] = useState('')
  const [shareStatus, setShareStatus] = useState('')

  useEffect(() => {
    if (!id) return
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const res = await fetch(`/api/entrenamientos/${id}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Error')
        if (!cancelled) setSession(data.session)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [id])

  const handleDelete = async () => {
    if (!id || !confirm('¿Archivar esta sesión? Podrás restaurarla desde Admin.')) return
    const res = await fetch(`/api/entrenamientos/${id}`, { method: 'DELETE' })
    if (res.ok) await router.push('/app/entrenamientos')
  }

  const handleDuplicate = async (asTemplate = false) => {
    const res = await fetch(`/api/entrenamientos/${id}/duplicate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ as_template: asTemplate }),
    })
    const data = await res.json()
    if (res.ok) await router.push(`/app/entrenamientos/${data.id}`)
  }

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault()
    setShareStatus('')
    const to = shareTo
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean)
    const res = await fetch(`/api/entrenamientos/${id}/share`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, message: shareMessage }),
    })
    const data = await res.json()
    if (!res.ok) {
      setShareStatus(data.error || 'No se pudo enviar')
      return
    }
    setShareStatus('Enviado')
    setShareOpen(false)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-400 border-t-transparent" />
      </div>
    )
  }

  if (error || !session) {
    return <p className="text-red-200">{error || 'Sesión no encontrada'}</p>
  }

  const dateLabel = formatDateOnlyForHonduras(session.scheduled_date)
  const total = session.total_minutes ?? 0
  const materialsLine =
    session.materials && session.materials.length > 0
      ? `\nMateriales: ${session.materials.map((m) => `${m.qty} ${m.item}`).join(', ')}`
      : ''
  const waText = encodeURIComponent(
    `Entrenamiento ${session.category} — ${dateLabel} (${total} min)\n${session.general_objective}${materialsLine}\n${typeof window !== 'undefined' ? window.location.href : ''}`
  )

  return (
    <>
      <Head>
        <title>
          {session.category} · {dateLabel} · Profe
        </title>
      </Head>

      <div className="no-print mb-6 flex flex-wrap items-center gap-2">
        <Link href={`/app/entrenamientos/${id}/campo`}>
          <Button size="sm">
            <Play className="mr-1.5 h-4 w-4" />
            Modo cancha
          </Button>
        </Link>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="mr-1.5 h-4 w-4" />
          PDF / Imprimir
        </Button>
        <a
          href={`https://wa.me/?text=${waText}`}
          target="_blank"
          rel="noreferrer"
        >
          <Button variant="secondary" size="sm">
            <MessageCircle className="mr-1.5 h-4 w-4" />
            WhatsApp
          </Button>
        </a>
        <Button variant="secondary" size="sm" onClick={() => setShareOpen((v) => !v)}>
          <Mail className="mr-1.5 h-4 w-4" />
          Email
        </Button>
        <Button variant="ghost" size="sm" onClick={() => void handleDuplicate(false)}>
          <Copy className="mr-1.5 h-4 w-4" />
          Duplicar
        </Button>
        {!session.is_template && (
          <Button variant="ghost" size="sm" onClick={() => void handleDuplicate(true)}>
            Guardar plantilla
          </Button>
        )}
        <Link href={`/app/entrenamientos/${id}/cierre`}>
          <Button variant="ghost" size="sm">
            <ClipboardCheck className="mr-1.5 h-4 w-4" />
            Cierre
          </Button>
        </Link>
        <Button variant="ghost" size="sm" onClick={handleDelete}>
          <Trash2 className="mr-1.5 h-4 w-4" />
          Archivar
        </Button>
      </div>

      {shareOpen && (
        <Card variant="glass" className="no-print mb-6">
          <CardHeader>
            <CardTitle className="text-base">Enviar por email (Resend)</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleShare} className="space-y-3">
              <div>
                <label className="mb-1 block text-sm text-white/70">
                  Destinatarios (separados por coma)
                </label>
                <Input
                  value={shareTo}
                  onChange={(e) => setShareTo(e.target.value)}
                  placeholder="padre@mail.com, asistente@mail.com"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-white/70">Nota (opcional)</label>
                <Textarea
                  rows={2}
                  value={shareMessage}
                  onChange={(e) => setShareMessage(e.target.value)}
                />
              </div>
              <Button type="submit" size="sm">
                Enviar resumen
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {shareStatus && (
        <p className="no-print mb-4 text-sm text-brand-200">{shareStatus}</p>
      )}

      <article className="print-area print-sheet space-y-6 rounded-xl border border-white/10 bg-white/5 p-6 text-white shadow-xl backdrop-blur-md print:border-0 print:bg-white print:p-0 print:text-slate-900 print:shadow-none">
        <header className="border-b border-white/10 pb-4 print:border-slate-200">
          <p className="font-display text-sm font-semibold uppercase tracking-widest text-brand-300 print:text-emerald-700">
            Profe · hoja de entrenamiento
            {session.is_template ? ' · plantilla' : ''}
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold">{session.category}</h1>
          <p className="mt-2 text-white/70 print:text-slate-600">
            {dateLabel} · {session.coach_name} · {total} min
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-3">
          <ObjectiveBlock title="Objetivo general" body={session.general_objective} />
          <ObjectiveBlock title="Objetivo físico" body={session.physical_objective} />
          <ObjectiveBlock title="Tema devocional" body={session.devotional_theme} />
        </section>

        {session.materials && session.materials.length > 0 ? (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-white/50 print:text-slate-500">
              Materiales
            </h3>
            <ul className="mt-2 flex flex-wrap gap-2">
              {session.materials.map((m) => (
                <li
                  key={m.item}
                  className="rounded-md bg-brand-600/20 px-2.5 py-1 text-sm print:bg-emerald-50 print:text-emerald-900"
                >
                  {m.qty} {m.item}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="space-y-4">
          {session.phases.map((phase) => (
            <div
              key={phase.id}
              className="rounded-lg border border-white/10 bg-black/20 p-4 print:border-slate-200 print:bg-transparent"
            >
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="font-display text-lg font-semibold text-brand-200 print:text-emerald-800">
                  {phase.phase_name}
                </h2>
                <span className="text-sm text-white/50 print:text-slate-500">
                  {phase.duration_minutes ?? 0} min
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
                {phase.explanation}
              </p>
              {phase.variants_materials ? (
                <p className="mt-3 whitespace-pre-wrap text-sm text-white/70 print:text-slate-600">
                  <span className="font-medium text-white print:text-slate-800">
                    Variantes / materiales:{' '}
                  </span>
                  {phase.variants_materials}
                </p>
              ) : null}
              {phase.diagram_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={phase.diagram_image_url}
                  alt={`Diagrama ${phase.phase_name}`}
                  className="mt-4 max-h-64 rounded-md border border-white/10 object-contain print:border-slate-200"
                />
              ) : null}
            </div>
          ))}
        </section>
      </article>
    </>
  )
}

function ObjectiveBlock({ title, body }: { title: string; body: string }) {
  if (!body) return null
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-white/50 print:text-slate-500">
        {title}
      </h3>
      <p className="mt-1 text-sm whitespace-pre-wrap">{body}</p>
    </div>
  )
}
