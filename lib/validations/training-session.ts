import { z } from 'zod'

export const PHASE_NAMES = [
  'Orientación',
  'Aprendizaje',
  'Aplicación',
  'Juego',
] as const

export const trainingPhaseSchema = z.object({
  phase_name: z.enum(PHASE_NAMES),
  explanation: z
    .string()
    .min(1, 'Explicación requerida')
    .max(4000, 'Máximo 4000 caracteres'),
  variants_materials: z.string().max(2000),
  diagram_image_url: z.union([z.string().url('URL de diagrama inválida'), z.literal('')]),
  sort_order: z.number().int().min(0).max(10),
})

export const trainingSessionSchema = z.object({
  coach_name: z
    .string()
    .min(2, 'Nombre del entrenador requerido')
    .max(120),
  category: z
    .string()
    .min(1, 'Categoría requerida')
    .max(80),
  scheduled_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha YYYY-MM-DD'),
  general_objective: z.string().min(1, 'Objetivo general requerido').max(2000),
  physical_objective: z.string().max(2000),
  devotional_theme: z.string().max(2000),
  phases: z
    .array(trainingPhaseSchema)
    .min(1, 'Al menos una fase')
    .max(4, 'Máximo 4 fases'),
})

export const shareSessionSchema = z.object({
  to: z.array(z.string().email()).min(1, 'Al menos un destinatario').max(20),
  message: z.string().max(1000).optional(),
})

export type TrainingPhaseInput = z.infer<typeof trainingPhaseSchema>
export type TrainingSessionInput = z.infer<typeof trainingSessionSchema>
