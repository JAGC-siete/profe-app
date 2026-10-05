import { useEffect, useRef, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useAuth } from '../../../../lib/auth'
import { Button } from '../../../../components/ui/button'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

interface Phase {
  id: string
  phase_name: string
  explanation: string
  variants_materials: string
  duration_minutes?: number
  diagram_image_url: string | null
}

interface Session {
  id: string
  category: string
  coach_name: string
  phases: Phase[]
  total_minutes?: number
}

const SWIPE_THRESHOLD_PX = 56

export default function ModoCampoPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const id = typeof router.query.id === 'string' ? router.query.id : ''
  const [session, setSession] = useState<Session | null>(null)
  const [index, setIndex] = useState(0)
  const [error, setError] = useState('')
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)

  useEffect(() => {
    if (!authLoading && !user) {
      void router.replace('/app/login')
    }
  }, [authLoading, user, router])

  useEffect(() => {
    if (!id || !user) return
    fetch(`/api/entrenamientos/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.session) setSession(data.session)
        else setError(data.error || 'Error')
      })
      .catch(() => setError('Error de red'))
  }, [id, user])

  const goPrev = () => setIndex((i) => Math.max(0, i - 1))
  const goNext = () =>
    setIndex((i) => {
      const max = (session?.phases?.length ?? 1) - 1
      return Math.min(max, i + 1)
    })

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.changedTouches[0]
    touchStartX.current = t.clientX
    touchStartY.current = t.clientY
  }

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null || touchStartY.current == null) return
    const t = e.changedTouches[0]
    const dx = t.clientX - touchStartX.current
    const dy = t.clientY - touchStartY.current
    touchStartX.current = null
    touchStartY.current = null
    // Ignorar scroll vertical dominante
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) < Math.abs(dy)) return
    if (dx < 0) goNext()
    else goPrev()
  }

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-brand-400 border-t-transparent" />
      </div>
    )
  }
  if (error) return <p className="p-6 text-red-200">{error}</p>
  if (!session) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-brand-400 border-t-transparent" />
      </div>
    )
  }

  const phases = session.phases ?? []
  const phase = phases[index]
  if (!phase) return <p className="p-6">Sin fases</p>

  return (
    <>
      <Head>
        <title>Modo cancha · {session.category}</title>
      </Head>
      <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
        <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-brand-300">Modo cancha</p>
            <p className="font-display text-lg font-bold">{session.category}</p>
          </div>
          <Link href={`/app/entrenamientos/${id}`}>
            <Button size="icon" variant="ghost">
              <X className="h-5 w-5" />
            </Button>
          </Link>
        </header>

        <main
          className="flex flex-1 flex-col overflow-auto px-5 py-6 touch-pan-y"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <p className="text-sm text-white/50">
            Fase {index + 1}/{phases.length}
            {session.total_minutes ? ` · Total ${session.total_minutes} min` : ''}
            <span className="ml-2 text-white/30">· desliza</span>
          </p>
          <h1 className="mt-2 font-display text-4xl font-bold leading-tight text-brand-300 sm:text-5xl">
            {phase.phase_name}
          </h1>
          <p className="mt-2 text-2xl font-semibold text-white/80">
            {phase.duration_minutes ?? 0} min
          </p>
          <p className="mt-8 whitespace-pre-wrap text-2xl leading-relaxed sm:text-3xl">
            {phase.explanation}
          </p>
          {phase.variants_materials ? (
            <p className="mt-8 whitespace-pre-wrap text-xl text-white/70">
              {phase.variants_materials}
            </p>
          ) : null}
          {phase.diagram_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={phase.diagram_image_url}
              alt=""
              className="mt-8 max-h-[40vh] rounded-lg object-contain"
              draggable={false}
            />
          ) : null}
        </main>

        <footer className="flex items-center justify-between gap-3 border-t border-white/10 p-4">
          <Button
            size="lg"
            variant="secondary"
            disabled={index === 0}
            onClick={goPrev}
            className="flex-1"
          >
            <ChevronLeft className="mr-1 h-5 w-5" />
            Anterior
          </Button>
          <Button
            size="lg"
            disabled={index >= phases.length - 1}
            onClick={goNext}
            className="flex-1"
          >
            Siguiente
            <ChevronRight className="ml-1 h-5 w-5" />
          </Button>
        </footer>
      </div>
    </>
  )
}
