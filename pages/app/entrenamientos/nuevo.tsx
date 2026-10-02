import { useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  PHASE_NAMES,
  trainingSessionSchema,
  type TrainingSessionInput,
} from '../../../lib/validations/training-session'
import { getTodayInHonduras } from '../../../lib/timezone'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { Textarea } from '../../../components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card'
import { Camera, Trash2 } from 'lucide-react'

const defaultPhases = PHASE_NAMES.map((phase_name, sort_order) => ({
  phase_name,
  explanation: '',
  variants_materials: '',
  diagram_image_url: '',
  sort_order,
}))

export default function NuevaSesionPage() {
  const router = useRouter()
  const [submitError, setSubmitError] = useState('')
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null)

  const form = useForm<TrainingSessionInput>({
    resolver: zodResolver(trainingSessionSchema),
    defaultValues: {
      coach_name: '',
      category: '',
      scheduled_date: getTodayInHonduras(),
      general_objective: '',
      physical_objective: '',
      devotional_theme: '',
      phases: defaultPhases,
    },
  })

  const { fields } = useFieldArray({ control: form.control, name: 'phases' })

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitError('')
    try {
      const res = await fetch('/api/entrenamientos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo guardar')
      }
      await router.push(`/app/entrenamientos/${data.id}`)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Error al guardar')
    }
  })

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

      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold">Nueva hoja</h1>
        <p className="mt-1 text-white/60">Cabecera + 4 fases del entrenamiento</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-8">
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
            <Field
              label="Tema devocional"
              error={form.formState.errors.devotional_theme?.message}
            >
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
              <Field
                label="Objetivo físico"
                error={form.formState.errors.physical_objective?.message}
              >
                <Textarea rows={2} {...form.register('physical_objective')} />
              </Field>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h2 className="font-display text-xl font-semibold">Fases</h2>
          {fields.map((field, index) => {
            const diagramUrl = form.watch(`phases.${index}.diagram_image_url`)
            return (
              <Card key={field.id} variant="glass">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-brand-200">
                    {PHASE_NAMES[index]}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <input
                    type="hidden"
                    {...form.register(`phases.${index}.phase_name`)}
                    value={PHASE_NAMES[index]}
                  />
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
                  <Field
                    label="Variantes / materiales"
                    error={
                      form.formState.errors.phases?.[index]?.variants_materials?.message
                    }
                  >
                    <Textarea
                      rows={2}
                      {...form.register(`phases.${index}.variants_materials`)}
                      placeholder="* 12 tortugas, * 3 balones"
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
                        alt={`Diagrama ${PHASE_NAMES[index]}`}
                        className="mt-3 max-h-48 rounded-lg border border-white/10 object-contain"
                      />
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {submitError && (
          <p className="rounded-lg bg-red-500/20 px-4 py-3 text-red-100">{submitError}</p>
        )}

        <div className="flex gap-3">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Guardando…' : 'Guardar sesión'}
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
