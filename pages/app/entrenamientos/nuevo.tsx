import { useEffect, useMemo, useRef, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  PHASE_PRESETS,
  trainingSessionSchema,
  type TrainingSessionInput,
} from '../../../lib/validations/training-session'
import {
  aggregateMaterials,
  normalizeMultilineText,
  parseMaterialsText,
} from '../../../lib/materials'
import { getTodayInHonduras } from '../../../lib/timezone'
import { cn } from '../../../lib/utils'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { Textarea } from '../../../components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card'
import {
  BookmarkPlus,
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
  GripVertical,
  ImagePlus,
  Library,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import { DynamicPitchEditor } from '../../../components/pitch/dynamic'
import {
  hasSceneContent,
  parseDiagramScene,
  type DiagramScene,
} from '../../../lib/pitch'

interface DrillOption {
  id: string
  name: string
  explanation: string
  variants_materials: string
  materials_json?: { item: string; qty: number }[]
  diagram_image_url?: string | null
  diagram_scene_json?: DiagramScene | Record<string, unknown> | null
  category?: string | null
}

const SESSION_PREFS_KEY = 'profe.sessionFormPrefs'

function emptyPhase(phase_name: string, sort_order: number) {
  return {
    phase_name,
    explanation: '',
    variants_materials: '',
    materials_json: [] as { item: string; qty: number }[],
    diagram_image_url: '',
    diagram_scene_json: {},
    duration_minutes: 15,
    sort_order,
  }
}

const defaultPhases = PHASE_PRESETS.map((name, i) => emptyPhase(name, i))

type DrillModalMode =
  | { kind: 'append' }
  | { kind: 'fill'; index: number }

function readSessionPrefs(): { coach_name?: string; category?: string } {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(SESSION_PREFS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as { coach_name?: string; category?: string }
    return {
      coach_name: typeof parsed.coach_name === 'string' ? parsed.coach_name : undefined,
      category: typeof parsed.category === 'string' ? parsed.category : undefined,
    }
  } catch {
    return {}
  }
}

function writeSessionPrefs(coach_name: string, category: string) {
  try {
    localStorage.setItem(
      SESSION_PREFS_KEY,
      JSON.stringify({ coach_name, category })
    )
  } catch {
    /* ignore quota / private mode */
  }
}

export default function NuevaSesionPage() {
  const router = useRouter()
  const formTopRef = useRef<HTMLDivElement>(null)
  const [submitError, setSubmitError] = useState('')
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null)
  const [drills, setDrills] = useState<DrillOption[]>([])
  const [savingDrillIndex, setSavingDrillIndex] = useState<number | null>(null)
  const [drillMsg, setDrillMsg] = useState('')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)
  const [drillModal, setDrillModal] = useState<DrillModalMode | null>(null)
  const [drillQuery, setDrillQuery] = useState('')
  const [pitchEditorIndex, setPitchEditorIndex] = useState<number | null>(null)
  const [prefsReady, setPrefsReady] = useState(false)

  useEffect(() => {
    fetch('/api/drills')
      .then((r) => r.json())
      .then((d) => setDrills(d.drills ?? []))
      .catch(() => setDrills([]))
  }, [])

  const form = useForm<TrainingSessionInput>({
    resolver: zodResolver(trainingSessionSchema),
    defaultValues: {
      coach_name: '',
      category: '',
      scheduled_date: getTodayInHonduras(),
      general_objective: '',
      physical_objective: '',
      devotional_theme: '',
      is_template: false,
      phases: defaultPhases,
    },
  })

  useEffect(() => {
    const prefs = readSessionPrefs()
    if (prefs.coach_name) form.setValue('coach_name', prefs.coach_name)
    if (prefs.category) form.setValue('category', prefs.category)
    setPrefsReady(true)
  }, [form])

  useEffect(() => {
    if (!drillMsg) return
    const t = window.setTimeout(() => setDrillMsg(''), 4000)
    return () => window.clearTimeout(t)
  }, [drillMsg])

  useEffect(() => {
    if (!drillModal) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDrillModal(null)
        setDrillQuery('')
      }
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [drillModal])

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!form.formState.isDirty) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [form.formState.isDirty])

  const { fields, append, remove, move } = useFieldArray({
    control: form.control,
    name: 'phases',
  })

  const watchedPhases = form.watch('phases')
  const watchedMeta = form.watch([
    'coach_name',
    'category',
    'scheduled_date',
    'general_objective',
  ])
  const totalMinutes = useMemo(
    () =>
      (watchedPhases ?? []).reduce(
        (sum, p) => sum + (Number(p?.duration_minutes) || 0),
        0
      ),
    [watchedPhases]
  )
  const materials = useMemo(
    () =>
      aggregateMaterials(
        (watchedPhases ?? []).map((p) => ({
          materials_json:
            p.materials_json?.length > 0
              ? p.materials_json
              : parseMaterialsText(p.variants_materials ?? ''),
          variants_materials: p.variants_materials,
        }))
      ),
    [watchedPhases]
  )

  const requiredProgress = useMemo(() => {
    const [coach, category, date, objective] = watchedMeta
    const metaDone = [
      (coach ?? '').trim().length >= 2,
      (category ?? '').trim().length >= 1,
      /^\d{4}-\d{2}-\d{2}$/.test(date ?? ''),
      (objective ?? '').trim().length >= 1,
    ].filter(Boolean).length
    const phasesDone = (watchedPhases ?? []).filter(
      (p) => (p?.phase_name ?? '').trim() && (p?.explanation ?? '').trim()
    ).length
    const phasesTotal = Math.max(fields.length, 1)
    return {
      metaDone,
      metaTotal: 4,
      phasesDone,
      phasesTotal,
      ready: metaDone === 4 && phasesDone === phasesTotal,
    }
  }, [watchedMeta, watchedPhases, fields.length])

  const filteredDrills = useMemo(() => {
    const q = drillQuery.trim().toLowerCase()
    if (!q) return drills
    return drills.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        (d.category ?? '').toLowerCase().includes(q) ||
        d.explanation.toLowerCase().includes(q)
    )
  }, [drills, drillQuery])

  const isCollapsed = (fieldId: string, index: number) => {
    if (collapsed[fieldId] !== undefined) return collapsed[fieldId]
    // Por defecto: con >3 fases, colapsar todas salvo la última (anti scroll fatigue)
    return fields.length > 3 && index < fields.length - 1
  }

  const setPhaseCollapsed = (fieldId: string, value: boolean) => {
    setCollapsed((prev) => ({ ...prev, [fieldId]: value }))
  }

  const expandOnly = (fieldId: string) => {
    const next: Record<string, boolean> = {}
    for (const f of fields) next[f.id] = f.id !== fieldId
    setCollapsed(next)
  }

  const addPhase = (name: string) => {
    // Resetear overrides: con >3 fases el default colapsa todo salvo la última (la nueva)
    setCollapsed({})
    append(emptyPhase(name, fields.length))
  }

  const removePhase = (index: number) => {
    if (fields.length <= 1) return
    const phase = form.getValues(`phases.${index}`)
    const hasContent = Boolean(
      phase?.explanation?.trim() ||
        phase?.variants_materials?.trim() ||
        phase?.diagram_image_url ||
        hasSceneContent(parseDiagramScene(phase?.diagram_scene_json))
    )
    if (
      hasContent &&
      !window.confirm(`¿Eliminar la fase «${phase.phase_name || index + 1}»?`)
    ) {
      return
    }
    remove(index)
  }

  const applyDrill = (drill: DrillOption, mode: DrillModalMode) => {
    const variants = normalizeMultilineText(drill.variants_materials ?? '')
    const explanation = normalizeMultilineText(drill.explanation ?? '')
    if (mode.kind === 'append') {
      append({
        phase_name: drill.name,
        explanation,
        variants_materials: variants,
        materials_json: drill.materials_json ?? [],
        diagram_image_url: drill.diagram_image_url || '',
        diagram_scene_json: drill.diagram_scene_json ?? {},
        duration_minutes: 15,
        sort_order: fields.length,
      })
    } else {
      const i = mode.index
      form.setValue(`phases.${i}.phase_name`, drill.name, { shouldDirty: true })
      form.setValue(`phases.${i}.explanation`, explanation, { shouldDirty: true })
      form.setValue(`phases.${i}.variants_materials`, variants, { shouldDirty: true })
      form.setValue(
        `phases.${i}.materials_json`,
        drill.materials_json ?? [],
        { shouldDirty: true }
      )
      form.setValue(
        `phases.${i}.diagram_image_url`,
        drill.diagram_image_url || '',
        { shouldDirty: true }
      )
      form.setValue(
        `phases.${i}.diagram_scene_json`,
        drill.diagram_scene_json ?? {},
        { shouldDirty: true }
      )
      setPhaseCollapsed(fields[i]?.id ?? '', false)
    }
    setDrillModal(null)
    setDrillQuery('')
    setDrillMsg(`Drill «${drill.name}» aplicado`)
  }

  const focusFirstError = async () => {
    const ok = await form.trigger()
    if (ok) return
    // RHF actualiza errors tras await trigger(); releer desde formState
    const { errors } = form.formState
    const metaKeys = [
      'coach_name',
      'category',
      'scheduled_date',
      'general_objective',
    ] as const
    for (const key of metaKeys) {
      if (errors[key]) {
        form.setFocus(key)
        formTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        return
      }
    }
    const phaseErrors = errors.phases
    if (Array.isArray(phaseErrors)) {
      const idx = phaseErrors.findIndex((p) => p && Object.keys(p).length > 0)
      if (idx >= 0) {
        const fieldId = fields[idx]?.id
        if (fieldId) setPhaseCollapsed(fieldId, false)
        const focusName = phaseErrors[idx]?.phase_name
          ? `phases.${idx}.phase_name`
          : `phases.${idx}.explanation`
        window.setTimeout(() => {
          form.setFocus(focusName as `phases.${number}.phase_name`)
          document
            .getElementById(`phase-card-${idx}`)
            ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 50)
      }
    }
  }

  const save = async (asTemplate: boolean) => {
    setSubmitError('')
    const values = form.getValues()
    const parsed = trainingSessionSchema.safeParse({
      ...values,
      is_template: asTemplate,
      phases: values.phases.map((p, i) => ({
        ...p,
        sort_order: i,
        duration_minutes: Number.isFinite(p.duration_minutes)
          ? Math.trunc(p.duration_minutes)
          : 0,
        materials_json:
          p.materials_json?.length > 0
            ? p.materials_json
            : parseMaterialsText(p.variants_materials ?? ''),
      })),
    })
    if (!parsed.success) {
      await focusFirstError()
      setSubmitError('Revisa los campos marcados')
      return
    }
    try {
      const res = await fetch('/api/entrenamientos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar')
      writeSessionPrefs(parsed.data.coach_name, parsed.data.category)
      form.reset(parsed.data)
      await router.push(`/app/entrenamientos/${data.id}`)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Error al guardar')
    }
  }

  const savePhaseAsDrill = async (index: number) => {
    setDrillMsg('')
    const phase = form.getValues(`phases.${index}`)
    const category = form.getValues('category')
    if (!phase?.phase_name?.trim() || !phase?.explanation?.trim()) {
      setDrillMsg('Nombre y explicación de la fase son requeridos para guardar drill')
      return
    }
    setSavingDrillIndex(index)
    try {
      const mats =
        phase.materials_json?.length > 0
          ? phase.materials_json
          : parseMaterialsText(phase.variants_materials ?? '')
      const res = await fetch('/api/drills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: phase.phase_name.trim(),
          explanation: phase.explanation.trim(),
          variants_materials: phase.variants_materials || '',
          materials_json: mats,
          diagram_image_url: phase.diagram_image_url || '',
          diagram_scene_json: phase.diagram_scene_json ?? {},
          tags: [],
          category: category || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar drill')
      const listRes = await fetch('/api/drills')
      const listData = await listRes.json()
      setDrills(listData.drills ?? [])
      setDrillMsg(`Drill «${phase.phase_name.trim()}» guardado`)
    } catch (err) {
      setDrillMsg(err instanceof Error ? err.message : 'Error al guardar drill')
    } finally {
      setSavingDrillIndex(null)
    }
  }

  const uploadDiagram = async (index: number, file: File) => {
    setUploadingIndex(index)
    setSubmitError('')
    try {
      const base64 = await fileToBase64(file)
      const res = await fetch('/api/entrenamientos/upload-diagram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileBase64: base64,
          fileName: file.name,
          contentType: file.type || 'image/jpeg',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al subir')
      form.setValue(`phases.${index}.diagram_image_url`, data.url, {
        shouldValidate: true,
      })
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Error al subir diagrama')
    } finally {
      setUploadingIndex(null)
    }
  }

  const onDragStart = (index: number) => (e: React.DragEvent) => {
    setDragFrom(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
  }

  const onDragOver = (index: number) => (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOver !== index) setDragOver(index)
  }

  const onDrop = (toIndex: number) => (e: React.DragEvent) => {
    e.preventDefault()
    const from =
      dragFrom ?? Number.parseInt(e.dataTransfer.getData('text/plain'), 10)
    setDragFrom(null)
    setDragOver(null)
    if (!Number.isFinite(from) || from === toIndex) return
    move(from, toIndex)
  }

  const cancel = () => {
    if (
      form.formState.isDirty &&
      !window.confirm('Hay cambios sin guardar. ¿Salir de todas formas?')
    ) {
      return
    }
    void router.back()
  }

  return (
    <>
      <Head>
        <title>Nueva sesión · Profe</title>
      </Head>

      <div
        ref={formTopRef}
        className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <h1 className="font-display text-3xl font-bold">Nueva sesión</h1>
          <p className="mt-1 text-sm text-white/60">
            {prefsReady && requiredProgress.ready
              ? 'Lista para guardar'
              : `${requiredProgress.metaDone}/${requiredProgress.metaTotal} datos · ${requiredProgress.phasesDone}/${requiredProgress.phasesTotal} fases listas`}
          </p>
        </div>
        <div className="hidden items-center gap-3 text-sm sm:flex">
          <span className="rounded-lg border border-brand-500/30 bg-pitch-900/80 px-3 py-1.5">
            <span className="text-white/50">Total </span>
            <span className="font-display text-lg font-bold text-brand-300">
              {totalMinutes} min
            </span>
          </span>
          <span className="text-white/40">
            {fields.length} fase{fields.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          void save(false)
        }}
        className="space-y-6 pb-36"
      >
        <Card variant="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Datos generales</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Entrenador" error={form.formState.errors.coach_name?.message}>
              <Input
                {...form.register('coach_name')}
                placeholder="Nombre del entrenador"
                autoComplete="name"
              />
            </Field>
            <Field label="Categoría" error={form.formState.errors.category?.message}>
              <Input
                {...form.register('category')}
                placeholder="Hope U7"
                autoComplete="off"
              />
            </Field>
            <Field label="Fecha" error={form.formState.errors.scheduled_date?.message}>
              <Input type="date" {...form.register('scheduled_date')} />
            </Field>
            <Field label="Tema devocional">
              <Input {...form.register('devotional_theme')} placeholder="Opcional" />
            </Field>
            <div className="sm:col-span-2">
              <Field
                label="Objetivo general"
                error={form.formState.errors.general_objective?.message}
              >
                <Textarea
                  rows={2}
                  {...form.register('general_objective')}
                  placeholder="¿Qué deben lograr hoy?"
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Objetivo físico">
                <Textarea
                  rows={2}
                  {...form.register('physical_objective')}
                  placeholder="Opcional"
                />
              </Field>
            </div>
          </CardContent>
        </Card>

        {materials.length > 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-white/45">
              Materiales de sesión
            </p>
            <ul className="flex flex-wrap gap-2">
              {materials.map((m) => (
                <li
                  key={m.item}
                  className="rounded-md bg-brand-600/20 px-2.5 py-1 text-sm text-brand-100"
                >
                  {m.qty} {m.item}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-xl font-semibold">Fases</h2>
              <p className="text-xs text-white/45">
                Escribe materiales por fase (ej. 12 conos) — se suman solos
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  const next: Record<string, boolean> = {}
                  for (const f of fields) next[f.id] = true
                  setCollapsed(next)
                }}
              >
                Colapsar
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  const next: Record<string, boolean> = {}
                  for (const f of fields) next[f.id] = false
                  setCollapsed(next)
                }}
              >
                Expandir
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => {
                  setDrillQuery('')
                  setDrillModal({ kind: 'append' })
                }}
              >
                <Library className="mr-1 h-4 w-4" />
                Importar drill
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {PHASE_PRESETS.map((preset) => (
              <Button
                key={preset}
                type="button"
                size="sm"
                variant="outline"
                onClick={() => addPhase(preset)}
              >
                + {preset}
              </Button>
            ))}
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => addPhase('Bloque')}
            >
              <Plus className="mr-1 h-4 w-4" />
              Bloque
            </Button>
          </div>

          {fields.map((field, index) => {
            const diagramUrl = form.watch(`phases.${index}.diagram_image_url`)
            const phaseName = watchedPhases?.[index]?.phase_name || `Fase ${index + 1}`
            const mins = Number(watchedPhases?.[index]?.duration_minutes) || 0
            const preview = (watchedPhases?.[index]?.explanation || '').trim()
            const collapsedNow = isCollapsed(field.id, index)
            const phaseReady = Boolean(
              (watchedPhases?.[index]?.phase_name || '').trim() && preview
            )

            return (
              <Card
                key={field.id}
                id={`phase-card-${index}`}
                variant="glass"
                draggable={false}
                onDragOver={onDragOver(index)}
                onDrop={onDrop(index)}
                className={cn(
                  'transition-colors',
                  dragOver === index && dragFrom !== index && 'ring-2 ring-brand-400/60'
                )}
              >
                <CardHeader className="flex flex-row items-center gap-1 space-y-0 pb-2 sm:gap-2">
                  <div className="flex shrink-0 flex-col sm:hidden">
                    <button
                      type="button"
                      className="rounded p-1 text-white/40 hover:bg-white/10 hover:text-white disabled:opacity-30"
                      aria-label="Subir fase"
                      disabled={index === 0}
                      onClick={() => move(index, index - 1)}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="rounded p-1 text-white/40 hover:bg-white/10 hover:text-white disabled:opacity-30"
                      aria-label="Bajar fase"
                      disabled={index >= fields.length - 1}
                      onClick={() => move(index, index + 1)}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>
                  <button
                    type="button"
                    className="hidden cursor-grab touch-none rounded p-1 text-white/40 hover:bg-white/10 hover:text-white active:cursor-grabbing sm:block"
                    title="Arrastrar para reordenar"
                    aria-label="Arrastrar fase"
                    draggable
                    onDragStart={onDragStart(index)}
                    onDragEnd={() => {
                      setDragFrom(null)
                      setDragOver(null)
                    }}
                  >
                    <GripVertical className="h-5 w-5" />
                  </button>

                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2 text-left sm:gap-3"
                    onClick={() => {
                      if (collapsedNow) expandOnly(field.id)
                      else setPhaseCollapsed(field.id, true)
                    }}
                  >
                    <span
                      className={cn(
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-bold',
                        phaseReady
                          ? 'bg-brand-500/30 text-brand-100'
                          : 'bg-white/10 text-white/50'
                      )}
                      aria-label={phaseReady ? 'Fase completa' : 'Fase incompleta'}
                    >
                      {phaseReady ? <Check className="h-3.5 w-3.5" /> : index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-base font-semibold leading-tight text-brand-200 [overflow-wrap:anywhere]">
                        {phaseName}
                      </span>
                      {collapsedNow ? (
                        <span className="mt-0.5 block line-clamp-2 text-xs text-white/45">
                          {mins} min
                          {preview ? ` · ${preview}` : ' · falta explicación'}
                        </span>
                      ) : null}
                    </span>
                    {!collapsedNow ? (
                      <span className="shrink-0 rounded-md bg-white/10 px-2 py-0.5 text-xs text-white/70">
                        {mins} min
                      </span>
                    ) : null}
                    {collapsedNow ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-white/50" />
                    ) : (
                      <ChevronUp className="h-4 w-4 shrink-0 text-white/50" />
                    )}
                  </button>

                  <div className="flex shrink-0 gap-0.5">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      title="Guardar fase como drill"
                      aria-label="Guardar fase como drill"
                      disabled={savingDrillIndex === index}
                      onClick={() => void savePhaseAsDrill(index)}
                    >
                      <BookmarkPlus className="h-4 w-4 text-brand-300" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      disabled={fields.length <= 1}
                      title="Eliminar fase"
                      aria-label="Eliminar fase"
                      onClick={() => removePhase(index)}
                    >
                      <Trash2 className="h-4 w-4 text-red-300" />
                    </Button>
                  </div>
                </CardHeader>

                {!collapsedNow ? (
                  <CardContent className="space-y-4 pt-0">
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="min-w-[160px] flex-1">
                        <Field label="Nombre de fase">
                          <Input
                            {...form.register(`phases.${index}.phase_name`)}
                            className="font-display text-base font-semibold text-brand-200"
                          />
                        </Field>
                      </div>
                      <div className="w-28">
                        <Field label="Minutos">
                          <Input
                            type="number"
                            min={0}
                            max={180}
                            inputMode="numeric"
                            {...form.register(`phases.${index}.duration_minutes`, {
                              valueAsNumber: true,
                            })}
                          />
                        </Field>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setDrillQuery('')
                          setDrillModal({ kind: 'fill', index })
                        }}
                      >
                        <Library className="mr-1 h-4 w-4" />
                        Importar drill
                      </Button>
                    </div>

                    <Field
                      label="Explicación / ejercicio"
                      error={form.formState.errors.phases?.[index]?.explanation?.message}
                    >
                      <Textarea
                        rows={3}
                        {...form.register(`phases.${index}.explanation`)}
                        placeholder="Coordinación y conducción..."
                      />
                    </Field>
                    <Field label="Variantes / materiales">
                      <Textarea
                        rows={2}
                        {...form.register(`phases.${index}.variants_materials`)}
                        placeholder={'12 conos\n3 balones'}
                      />
                    </Field>
                    <div>
                      <label className="mb-1.5 block text-sm text-white/70">
                        Diseño de ejercicio
                      </label>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => setPitchEditorIndex(index)}
                        >
                          Editor 3D
                        </Button>
                        <label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-md border border-white/20 bg-white/10 px-3 text-xs hover:bg-brand-800 hover:border-brand-600">
                          <Camera className="h-4 w-4" />
                          {uploadingIndex === index ? 'Subiendo…' : 'Cámara'}
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            disabled={uploadingIndex !== null}
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) void uploadDiagram(index, file)
                              e.target.value = ''
                            }}
                          />
                        </label>
                        <label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-md border border-white/20 bg-white/10 px-3 text-xs hover:bg-brand-800 hover:border-brand-600">
                          <ImagePlus className="h-4 w-4" />
                          Galería
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={uploadingIndex !== null}
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) void uploadDiagram(index, file)
                              e.target.value = ''
                            }}
                          />
                        </label>
                        {diagramUrl ||
                        hasSceneContent(
                          parseDiagramScene(
                            form.getValues(`phases.${index}.diagram_scene_json`)
                          )
                        ) ? (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-sm text-red-300"
                            onClick={() => {
                              form.setValue(`phases.${index}.diagram_image_url`, '')
                              form.setValue(`phases.${index}.diagram_scene_json`, {})
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Quitar
                          </button>
                        ) : null}
                      </div>
                      {diagramUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={diagramUrl}
                          alt="Diagrama"
                          className="mt-3 max-h-48 rounded-lg border border-white/10 object-contain"
                        />
                      ) : null}
                    </div>
                  </CardContent>
                ) : null}
              </Card>
            )
          })}
        </div>

        {drillMsg && (
          <p
            role="status"
            className="rounded-lg bg-brand-500/15 px-4 py-3 text-brand-100"
          >
            {drillMsg}
          </p>
        )}
        {submitError && (
          <p
            role="alert"
            className="rounded-lg bg-red-500/20 px-4 py-3 text-red-100"
          >
            {submitError}
          </p>
        )}

        {/* Desktop secondary actions; primary save lives in sticky bar */}
        <div className="hidden flex-wrap gap-3 sm:flex">
          <Button
            type="button"
            variant="secondary"
            disabled={form.formState.isSubmitting}
            onClick={() => void save(true)}
          >
            Guardar como plantilla
          </Button>
          <Button type="button" variant="outline" onClick={cancel}>
            Cancelar
          </Button>
        </div>
      </form>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-pitch-950/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-bold text-brand-300">
              {totalMinutes}{' '}
              <span className="text-sm font-medium text-white/50">min</span>
            </p>
            <p className="truncate text-xs text-white/45">
              {fields.length} fase{fields.length === 1 ? '' : 's'}
              {materials.length > 0
                ? ` · ${materials.length} material${materials.length === 1 ? '' : 'es'}`
                : ''}
              {!requiredProgress.ready ? ' · faltan datos' : ''}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="hidden shrink-0 sm:inline-flex"
            disabled={form.formState.isSubmitting}
            onClick={() => void save(true)}
          >
            Plantilla
          </Button>
          <Button
            type="button"
            className="shrink-0 min-w-[8.5rem]"
            disabled={form.formState.isSubmitting}
            onClick={() => void save(false)}
          >
            {form.formState.isSubmitting ? 'Guardando…' : 'Guardar sesión'}
          </Button>
        </div>
      </div>

      {pitchEditorIndex != null ? (
        <DynamicPitchEditor
          initialScene={parseDiagramScene(
            form.getValues(`phases.${pitchEditorIndex}.diagram_scene_json`)
          )}
          onCancel={() => setPitchEditorIndex(null)}
          onSave={(scene, imageUrl) => {
            form.setValue(`phases.${pitchEditorIndex}.diagram_scene_json`, scene, {
              shouldDirty: true,
            })
            form.setValue(`phases.${pitchEditorIndex}.diagram_image_url`, imageUrl, {
              shouldDirty: true,
              shouldValidate: true,
            })
            setPitchEditorIndex(null)
          }}
        />
      ) : null}

      {drillModal ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Importar drill"
          onClick={() => {
            setDrillModal(null)
            setDrillQuery('')
          }}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-white/15 bg-pitch-900 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div>
                <p className="font-display text-lg font-semibold">Importar drill</p>
                <p className="text-xs text-white/50">
                  {drillModal.kind === 'append'
                    ? 'Añade una fase nueva con el ejercicio'
                    : `Rellena la fase ${drillModal.index + 1}`}
                </p>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Cerrar"
                onClick={() => {
                  setDrillModal(null)
                  setDrillQuery('')
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="border-b border-white/10 p-3">
              <Input
                value={drillQuery}
                onChange={(e) => setDrillQuery(e.target.value)}
                placeholder="Buscar por nombre o categoría…"
                autoFocus
              />
            </div>
            <ul className="flex-1 overflow-auto p-2">
              {drills.length === 0 ? (
                <li className="px-3 py-8 text-center text-sm text-white/50">
                  No hay drills. Guarda uno desde una fase o en Biblioteca.
                </li>
              ) : filteredDrills.length === 0 ? (
                <li className="px-3 py-8 text-center text-sm text-white/50">
                  Sin resultados para «{drillQuery}»
                </li>
              ) : (
                filteredDrills.map((d) => (
                  <li key={d.id}>
                    <button
                      type="button"
                      className="w-full rounded-xl px-3 py-3 text-left hover:bg-white/10"
                      onClick={() => applyDrill(d, drillModal)}
                    >
                      <span className="block font-medium text-brand-100">{d.name}</span>
                      <span className="mt-0.5 line-clamp-2 block text-xs text-white/50">
                        {d.category ? `${d.category} · ` : ''}
                        {d.explanation}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  )
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm text-white/70">{label}</label>
      {children}
      {error ? <p className="mt-1 text-xs text-red-300">{error}</p> : null}
    </div>
  )
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'))
    reader.readAsDataURL(file)
  })
}
