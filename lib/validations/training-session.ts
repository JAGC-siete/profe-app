import { z } from 'zod'

export const PHASE_PRESETS = [
  'Orientación',
  'Aprendizaje',
  'Aplicación',
  'Juego',
] as const

/** @deprecated usar PHASE_PRESETS */
export const PHASE_NAMES = PHASE_PRESETS

export const materialItemSchema = z.object({
  item: z.string().min(1).max(80),
  qty: z.number().int().min(0).max(9999),
})

export const trainingPhaseSchema = z.object({
  phase_name: z.string().min(1, 'Nombre de fase requerido').max(80),
  explanation: z
    .string()
    .min(1, 'Explicación requerida')
    .max(4000, 'Máximo 4000 caracteres'),
  variants_materials: z.string().max(2000),
  materials_json: z.array(materialItemSchema).max(40),
  diagram_image_url: z.union([z.string().url('URL de diagrama inválida'), z.literal('')]),
  duration_minutes: z
    .number()
    .int()
    .min(0)
    .max(180)
    .catch(0)
    .transform((n) => (Number.isFinite(n) ? n : 0)),
  sort_order: z.number().int().min(0).max(20),
})

export const trainingSessionSchema = z.object({
  coach_name: z.string().min(2, 'Nombre del entrenador requerido').max(120),
  category: z.string().min(1, 'Categoría requerida').max(80),
  scheduled_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha YYYY-MM-DD'),
  general_objective: z.string().min(1, 'Objetivo general requerido').max(2000),
  physical_objective: z.string().max(2000),
  devotional_theme: z.string().max(2000),
  is_template: z.boolean(),
  phases: z
    .array(trainingPhaseSchema)
    .min(1, 'Al menos una fase')
    .max(12, 'Máximo 12 fases'),
})

export const shareSessionSchema = z.object({
  to: z.array(z.string().email()).min(1, 'Al menos un destinatario').max(20),
  message: z.string().max(1000).optional(),
})

export const drillSchema = z.object({
  name: z.string().min(2).max(120),
  explanation: z.string().min(1).max(4000),
  variants_materials: z.string().max(2000).optional().default(''),
  materials_json: z.array(materialItemSchema).max(40).optional().default([]),
  diagram_image_url: z
    .union([z.string().url(), z.literal(''), z.null()])
    .optional()
    .nullable(),
  tags: z.array(z.string().max(40)).max(20).optional().default([]),
  category: z.string().max(80).optional().nullable(),
})

export const playerSchema = z.object({
  name: z.string().min(1).max(120),
  category: z.string().min(1).max(80),
  is_active: z.boolean().optional().default(true),
})

export const attendanceSchema = z.object({
  entries: z
    .array(
      z.object({
        player_id: z.string().uuid(),
        present: z.boolean(),
      })
    )
    .max(200),
})

export const sessionReviewSchema = z.object({
  intensity: z.number().int().min(1).max(5),
  objective_met: z.boolean(),
  notes: z.string().max(2000),
})

export type TrainingPhaseInput = z.infer<typeof trainingPhaseSchema>
export type TrainingSessionInput = z.infer<typeof trainingSessionSchema>
export type DrillInput = z.infer<typeof drillSchema>
