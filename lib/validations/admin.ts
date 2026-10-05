import { z } from 'zod'

export const categorySchema = z.object({
  name: z.string().min(1, 'Nombre requerido').max(80),
  sort_order: z.number().int().min(0).max(9999).optional().default(0),
  is_active: z.boolean().optional().default(true),
})

export const categoryUpdateSchema = categorySchema.partial().extend({
  name: z.string().min(1).max(80).optional(),
})

export const coachUpdateSchema = z.object({
  full_name: z.string().min(2).max(120).optional(),
  category: z.string().min(1).max(80).optional(),
  notes: z.string().max(500).optional(),
  is_active: z.boolean().optional(),
})

export const inviteCoachSchema = z.object({
  email: z.string().email('Email inválido').max(200),
  full_name: z.string().min(2).max(120),
  category: z.string().min(1).max(80).optional(),
})

export const profileStatusSchema = z.object({
  is_active: z.boolean(),
})

export const sessionArchiveSchema = z.object({
  is_archived: z.boolean(),
})
