import { z } from 'zod'
import type { DiagramScene } from './types'
import { MAX_PITCH_ELEMENTS, MAX_PITCH_FRAMES, MAX_PITCH_STROKES } from './types'
import { isKeyframeAnimation, isLegacyAnimation } from './animation'

const positionSchema = z.object({
  x: z.number().min(0).max(100),
  z: z.number().min(0).max(100),
  rotation: z.number().min(0).max(360).optional(),
})

const elementSchema = z.object({
  id: z.string().min(1).max(40),
  type: z.enum(['player', 'cone', 'ball', 'goal', 'marker']),
  team: z.enum(['home', 'away', 'neutral']).optional(),
  number: z.number().int().min(0).max(99).optional(),
  color: z.string().max(32).optional(),
  label: z.string().max(40).optional(),
  position: positionSchema,
})

const actionSchema = z.object({
  element_id: z.string().min(1).max(40),
  action_type: z.enum(['run', 'pass', 'dribble', 'move']),
  path_type: z.enum(['linear', 'curve']),
  control_points: z
    .array(z.object({ x: z.number().min(0).max(100), z: z.number().min(0).max(100) }))
    .max(8)
    .optional(),
  target_position: positionSchema,
})

const animStepSchema = z.object({
  step: z.number().int().min(1).max(40),
  actions: z.array(actionSchema).max(40),
})

const keyframeSchema = z.object({
  id: z.string().min(1).max(40),
  positions: z.record(z.string(), positionSchema),
})

const keyframeAnimationSchema = z.object({
  mode: z.literal('keyframes'),
  duration_per_frame: z.number().min(0.3).max(12),
  frames: z.array(keyframeSchema).max(MAX_PITCH_FRAMES),
})

const legacyAnimationSchema = z.object({
  mode: z.literal('steps').optional(),
  duration_per_step: z.number().min(0.3).max(12).default(2.5),
  steps: z.array(animStepSchema).max(40),
})

export const pitchAnimationSchema = z.union([
  keyframeAnimationSchema,
  legacyAnimationSchema,
])

const strokePointSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
})

const strokeSchema = z.object({
  id: z.string().min(1).max(40),
  kind: z.enum(['arrow', 'pen']),
  color: z.enum(['#F2D98A', '#46E3FF', '#E63946', '#FFFFFF']),
  width: z.number().min(0.001).max(0.05),
  points: z.array(strokePointSchema).min(1).max(400),
  curvature: z.enum(['flat', 'convex', 'concave']).optional(),
})

export const diagramSceneSchema = z.object({
  version: z.literal(1),
  pitch: z.object({
    type: z.enum(['full_field', 'half_field', 'penalty_box']),
    dimensions: z.tuple([
      z.number().min(10).max(200),
      z.number().min(10).max(200),
    ]),
  }),
  elements: z.array(elementSchema).max(MAX_PITCH_ELEMENTS),
  animation: pitchAnimationSchema.optional(),
  strokes: z.array(strokeSchema).max(MAX_PITCH_STROKES).optional(),
})

/** Escena válida o placeholder vacío en formulario/DB. */
export type DiagramSceneJson = DiagramScene | Record<string, unknown>

export const diagramSceneJsonSchema = z.union([
  diagramSceneSchema,
  z.record(z.string(), z.unknown()),
])

export function parseDiagramScene(val: unknown): DiagramScene | null {
  const parsed = diagramSceneSchema.safeParse(val)
  return parsed.success ? (parsed.data as DiagramScene) : null
}

/** Normaliza para insert/update en JSONB. */
export function sceneForDb(val: unknown): DiagramScene | Record<string, never> {
  const parsed = diagramSceneSchema.safeParse(val)
  if (!parsed.success) return {}
  return parsed.data as DiagramScene
}

export function hasSceneContent(scene: DiagramScene | null | undefined): boolean {
  return Boolean(
    scene && (scene.elements.length > 0 || (scene.strokes?.length ?? 0) > 0)
  )
}

export function hasAnimation(scene: DiagramScene | null | undefined): boolean {
  if (!scene?.animation) return false
  if (isKeyframeAnimation(scene.animation)) {
    return scene.animation.frames.length >= 2
  }
  if (isLegacyAnimation(scene.animation)) {
    return scene.animation.steps.length > 0
  }
  return false
}
