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
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { Textarea } from '../../../components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card'
import { ArrowDown, ArrowUp, BookmarkPlus, Camera, Plus, Trash2 } from 'lucide-react'

interface DrillOption {
  id: string
  name: string
  explanation: string
  variants_materials: string
  materials_json?: { item: string; qty: number }[]
  diagram_image_url?: string | null
}

function emptyPhase(phase_name: string, sort_order: number) {
  return {
    phase_name,
    explanation: '',
    variants_materials: '',
    materials_json: [] as { item: string; qty: number }[],
    diagram_image_url: '',
    duration_minutes: 15,
    sort_order,
  }
}

const defaultPhases = PHASE_PRESETS.map((name, i) => emptyPhase(name, i))

export default function NuevaSesionPage() {
  const router = useRouter()
  const [submitError, setSubmitError] = useState('')
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null)
  const [drills, setDrills] = useState<DrillOption[]>([])
  const [drillId, setDrillId] = useState('')
  const [savingDrillIndex, setSavingDrillIndex] = useState<number | null>(null)
  const [drillMsg, setDrillMsg] = useState('')

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
      const materials =
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
          materials_json: materials,
          diagram_image_url: phase.diagram_image_url || '',
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

  return (
    <>
      <Head>
        <title>Nueva sesión · Profe</title>
      </Head>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Nueva hoja</h1>
          <p className="mt-1 text-white/60">Fases flexibles · minutos · materiales</p>
        </div>
        <div className="sticky top-2 z-20 rounded-xl border border-brand-500/30 bg-pitch-900/95 px-4 py-2 text-sm backdrop-blur">
          <span className="text-white/60">Total </span>
          <span className="font-display text-lg font-bold text-brand-300">
            {totalMinutes} min
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

        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-xl font-semibold">Fases</h2>
            <div className="flex flex-wrap gap-2">
              {PHASE_PRESETS.map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => append(emptyPhase(preset, fields.length))}
                >
                  + {preset}
                </Button>
              ))}
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => append(emptyPhase('Bloque', fields.length))}
              >
                <Plus className="mr-1 h-4 w-4" />
                Bloque
              </Button>
            </div>
          </div>

          {drills.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-3">
              <select
                className="h-10 min-w-[200px] flex-1 rounded-md border border-white/15 bg-pitch-900 px-3 text-sm"
                value={drillId}
                onChange={(e) => setDrillId(e.target.value)}
              >
                <option value="">Insertar drill…</option>
                {drills.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                size="sm"
                disabled={!drillId}
                onClick={() => {
                  const d = drills.find((x) => x.id === drillId)
                  if (!d) return
                  append({
                    phase_name: d.name,
                    explanation: d.explanation,
                    variants_materials: d.variants_materials ?? '',
                    materials_json: d.materials_json ?? [],
                    diagram_image_url: d.diagram_image_url || '',
                    duration_minutes: 15,
                    sort_order: fields.length,
                  })
                  setDrillId('')
                }}
              >
                Insertar
              </Button>
            </div>
          ) : null}

          {fields.map((field, index) => {
            const diagramUrl = form.watch(`phases.${index}.diagram_image_url`)
            return (
              <Card key={field.id} variant="glass">
                <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                  <div className="flex-1 space-y-2">
                    <Input
                      {...form.register(`phases.${index}.phase_name`)}
                      className="font-display text-base font-semibold text-brand-200"
                    />
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-white/50">Minutos</label>
                      <Input
                        type="number"
                        min={0}
                        max={180}
                        className="w-24"
                        {...form.register(`phases.${index}.duration_minutes`, {
                          valueAsNumber: true,
                        })}
                      />
                    </div>
                  </div>
                  <div className="flex gap-1">
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
                      disabled={index === 0}
                      onClick={() => move(index, index - 1)}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      disabled={index === fields.length - 1}
                      onClick={() => move(index, index + 1)}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      disabled={fields.length <= 1}
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="h-4 w-4 text-red-300" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
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
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm hover:bg-white/10">
                        <Camera className="h-4 w-4" />
                        {uploadingIndex === index ? 'Subiendo…' : 'Foto / diagrama'}
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          disabled={uploadingIndex !== null}
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) void uploadDiagram(index, file)
                          }}
                        />
                      </label>
                      {diagramUrl ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-sm text-red-300"
                          onClick={() =>
                            form.setValue(`phases.${index}.diagram_image_url`, '')
                          }
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
