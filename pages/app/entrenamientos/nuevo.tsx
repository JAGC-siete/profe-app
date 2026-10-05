import { useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  PHASE_PRESETS,
  trainingSessionSchema,
  type TrainingSessionInput,
} from '../../../lib/validations/training-session'
import { aggregateMaterials, parseMaterialsText } from '../../../lib/materials'
import { getTodayInHonduras } from '../../../lib/timezone'
import { cn } from '../../../lib/utils'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { Textarea } from '../../../components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card'
import {
  BookmarkPlus,
  Camera,
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

export default function NuevaSesionPage() {
  const router = useRouter()
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

  const { fields, append, remove, move } = useFieldArray({
    control: form.control,
    name: 'phases',
  })

  const watchedPhases = form.watch('phases')
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

  const applyDrill = (drill: DrillOption, mode: DrillModalMode) => {
    if (mode.kind === 'append') {
      append({
        phase_name: drill.name,
        explanation: drill.explanation,
        variants_materials: drill.variants_materials ?? '',
        materials_json: drill.materials_json ?? [],
        diagram_image_url: drill.diagram_image_url || '',
        diagram_scene_json: drill.diagram_scene_json ?? {},
        duration_minutes: 15,
        sort_order: fields.length,
      })
    } else {
      const i = mode.index
      form.setValue(`phases.${i}.phase_name`, drill.name, { shouldDirty: true })
      form.setValue(`phases.${i}.explanation`, drill.explanation, { shouldDirty: true })
      form.setValue(
        `phases.${i}.variants_materials`,
        drill.variants_materials ?? '',
        { shouldDirty: true }
      )
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
      await form.trigger()
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

  return (
    <>
      <Head>
        <title>Nueva sesión · Profe</title>
      </Head>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Nueva hoja</h1>
          <p className="mt-1 text-white/60">
            Fases flexibles · minutos · materiales · menos scroll
          </p>
        </div>
        <div className="sticky top-2 z-20 rounded-xl border border-brand-500/30 bg-pitch-900/95 px-4 py-2 text-sm backdrop-blur">
          <span className="text-white/60">Total </span>
          <span className="font-display text-lg font-bold text-brand-300">
            {totalMinutes} min
          </span>
          <span className="ml-3 text-white/40">
            {fields.length} fase{fields.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          void save(false)
        }}
        className="space-y-8 pb-24"
      >
        <Card variant="glass">
          <CardHeader>
            <CardTitle className="text-lg">Datos generales</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Entrenador" error={form.formState.errors.coach_name?.message}>
              <Input {...form.register('coach_name')} placeholder="Gustavo Villela" />
            </Field>
            <Field label="Categoría" error={form.formState.errors.category?.message}>
              <Input {...form.register('category')} placeholder="Hope U7" />
            </Field>
            <Field label="Fecha" error={form.formState.errors.scheduled_date?.message}>
              <Input type="date" {...form.register('scheduled_date')} />
            </Field>
            <Field label="Tema devocional">
              <Input {...form.register('devotional_theme')} />
            </Field>
            <div className="sm:col-span-2">
              <Field
                label="Objetivo general"
                error={form.formState.errors.general_objective?.message}
              >
                <Textarea rows={2} {...form.register('general_objective')} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Objetivo físico">
                <Textarea rows={2} {...form.register('physical_objective')} />
              </Field>
            </div>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader>
            <CardTitle className="text-base">Materiales de sesión</CardTitle>
          </CardHeader>
          <CardContent>
            {materials.length === 0 ? (
              <p className="text-sm text-white/50">
                Se agregan solos al escribir materiales por fase (ej. &quot;12 conos&quot;).
              </p>
            ) : (
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
            )}
          </CardContent>
        </Card>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-xl font-semibold">Fases</h2>
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
                Colapsar todas
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
                Expandir todas
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

            return (
              <Card
                key={field.id}
                variant="glass"
                draggable={false}
                onDragOver={onDragOver(index)}
                onDrop={onDrop(index)}
                className={cn(
                  'transition-colors',
                  dragOver === index && dragFrom !== index && 'ring-2 ring-brand-400/60'
                )}
              >
                <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
                  <button
                    type="button"
                    className="cursor-grab touch-none rounded p-1 text-white/40 hover:bg-white/10 hover:text-white active:cursor-grabbing"
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
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    onClick={() => {
                      if (collapsedNow) expandOnly(field.id)
                      else setPhaseCollapsed(field.id, true)
                    }}
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-600/25 text-xs font-bold text-brand-200">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-display text-base font-semibold text-brand-200">
                        {phaseName}
                      </span>
                      {collapsedNow ? (
                        <span className="block truncate text-xs text-white/45">
                          {mins} min
                          {preview ? ` · ${preview}` : ' · sin explicación'}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 rounded-md bg-white/10 px-2 py-0.5 text-xs text-white/70">
                      {mins} min
                    </span>
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
                      onClick={() => remove(index)}
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
                        Importar Drill
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
                        placeholder="12 conos&#10;3 balones"
                      />
                    </Field>
                    <div>
                      <label className="mb-1.5 block text-sm text-white/70">
                        Diseño de ejercicio
                      </label>
                      <div className="flex flex-wrap items-center gap-3">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => setPitchEditorIndex(index)}
                        >
                          Editor 3D
                        </Button>
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm hover:bg-white/10">
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
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm hover:bg-white/10">
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
          <p className="rounded-lg bg-brand-500/15 px-4 py-3 text-brand-100">{drillMsg}</p>
        )}
        {submitError && (
          <p className="rounded-lg bg-red-500/20 px-4 py-3 text-red-100">{submitError}</p>
        )}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Guardando…' : 'Guardar sesión'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={form.formState.isSubmitting}
            onClick={() => void save(true)}
          >
            Guardar como plantilla
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancelar
          </Button>
        </div>
      </form>

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
          onClick={() => setDrillModal(null)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-white/15 bg-pitch-900 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div>
                <p className="font-display text-lg font-semibold">Importar Drill</p>
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
                onClick={() => setDrillModal(null)}
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
