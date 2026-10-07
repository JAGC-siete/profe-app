import type {
  DiagramScene,
  KeyframePositions,
  NormalizedAnimation,
  PitchAnimation,
  PitchElement,
  PitchKeyframe,
  PitchKeyframeAnimation,
  PitchLegacyAnimation,
  PitchPosition,
  PitchType,
} from './types'
import { MAX_PITCH_FRAMES } from './types'
import { newElementId, normToWorld } from './coords'

function clamp01to100(n: number) {
  return Math.min(100, Math.max(0, n))
}

function clonePositions(pos: KeyframePositions): KeyframePositions {
  const out: KeyframePositions = {}
  for (const [id, p] of Object.entries(pos)) {
    out[id] = { x: p.x, z: p.z, rotation: p.rotation }
  }
  return out
}

export function positionsFromElements(elements: PitchElement[]): KeyframePositions {
  const out: KeyframePositions = {}
  for (const el of elements) {
    out[el.id] = {
      x: el.position.x,
      z: el.position.z,
      rotation: el.position.rotation,
    }
  }
  return out
}

export function isKeyframeAnimation(
  anim: PitchAnimation | undefined
): anim is PitchKeyframeAnimation {
  return Boolean(anim && anim.mode === 'keyframes' && Array.isArray(anim.frames))
}

export function isLegacyAnimation(
  anim: PitchAnimation | undefined
): anim is PitchLegacyAnimation {
  return Boolean(anim && Array.isArray((anim as PitchLegacyAnimation).steps))
}

/** Convierte steps legacy → frames (frame0 = pose base, luego targets por step). */
export function legacyStepsToFrames(
  elements: PitchElement[],
  anim: PitchLegacyAnimation
): PitchKeyframe[] {
  let current = positionsFromElements(elements)
  const frames: PitchKeyframe[] = [
    { id: 'f0', positions: clonePositions(current) },
  ]

  for (const step of anim.steps ?? []) {
    const next = clonePositions(current)
    for (const action of step.actions ?? []) {
      next[action.element_id] = {
        x: clamp01to100(action.target_position.x),
        z: clamp01to100(action.target_position.z),
        rotation: action.target_position.rotation,
      }
    }
    frames.push({
      id: newElementId('f'),
      positions: next,
    })
    current = next
    if (frames.length >= MAX_PITCH_FRAMES) break
  }

  return frames
}

/**
 * Read path: keyframes preferidos; steps legacy convertidos.
 * Sin animación → frames vacíos (player usa pose de elements).
 */
export function normalizeAnimation(scene: DiagramScene): NormalizedAnimation {
  const anim = scene.animation

  if (isKeyframeAnimation(anim) && anim.frames.length > 0) {
    return {
      durationPerFrame: anim.duration_per_frame || 2.5,
      frames: anim.frames.slice(0, MAX_PITCH_FRAMES).map((f) => ({
        id: f.id,
        positions: clonePositions(f.positions),
      })),
    }
  }

  if (isLegacyAnimation(anim) && anim.steps.length > 0) {
    return {
      durationPerFrame: anim.duration_per_step || 2.5,
      frames: legacyStepsToFrames(scene.elements, anim),
    }
  }

  return { durationPerFrame: 2.5, frames: [] }
}

export function hasNormalizedAnimation(norm: NormalizedAnimation): boolean {
  return norm.frames.length >= 2
}

/** Interpola entre dos frames (t en [0,1]). */
export function interpolateFrames(
  from: KeyframePositions,
  to: KeyframePositions,
  t: number
): KeyframePositions {
  const tt = Math.min(1, Math.max(0, t))
  const ids = new Set([...Object.keys(from), ...Object.keys(to)])
  const out: KeyframePositions = {}
  for (const id of ids) {
    const a = from[id]
    const b = to[id]
    if (a && b) {
      out[id] = {
        x: a.x + (b.x - a.x) * tt,
        z: a.z + (b.z - a.z) * tt,
        rotation:
          a.rotation != null && b.rotation != null
            ? a.rotation + (b.rotation - a.rotation) * tt
            : b.rotation ?? a.rotation,
      }
    } else if (b) {
      out[id] = { ...b }
    } else if (a) {
      out[id] = { ...a }
    }
  }
  return out
}

export type EasingFn = (t: number) => number

export const linearEase: EasingFn = (t) => t

/**
 * Hermite cúbica en [0,1] con pendientes v0/v1 en los extremos (1 = lineal).
 * (0,0) = arranque y frenado suaves; (1,1) = lineal.
 */
export function hermiteEase(t: number, v0: number, v1: number): number {
  const tt = Math.min(1, Math.max(0, t))
  const t2 = tt * tt
  const t3 = t2 * tt
  return (t3 - 2 * t2 + tt) * v0 + (3 * t2 - 2 * t3) + (t3 - t2) * v1
}

const MOVE_EPS = 1e-3

function moves(a: PitchPosition | undefined, b: PitchPosition | undefined) {
  return Boolean(
    a && b && (Math.abs(a.x - b.x) > MOVE_EPS || Math.abs(a.z - b.z) > MOVE_EPS)
  )
}

/**
 * t suavizado de un elemento en el tramo frameIndex → frameIndex+1.
 * Solo frena si después se queda quieto y solo acelera si venía quieto:
 * un jugador que sigue corriendo no se detiene en cada keyframe.
 */
export function elementSegmentT(
  norm: NormalizedAnimation,
  frameIndex: number,
  id: string,
  localT: number
): number {
  const f = norm.frames
  const startsFromRest = !moves(f[frameIndex - 1]?.positions[id], f[frameIndex]?.positions[id])
  const endsAtRest = !moves(f[frameIndex + 1]?.positions[id], f[frameIndex + 2]?.positions[id])
  return hermiteEase(localT, startsFromRest ? 0 : 1, endsAtRest ? 0 : 1)
}

/**
 * Pose en tiempo global: frameIndex + localT entre frameIndex y frameIndex+1.
 * Sin `ease`, cada elemento usa elementSegmentT; con `ease`, t uniforme.
 */
export function sampleNormalizedAnimation(
  norm: NormalizedAnimation,
  frameIndex: number,
  localT: number,
  ease?: EasingFn
): KeyframePositions {
  if (norm.frames.length === 0) return {}
  const i = Math.min(Math.max(0, frameIndex), norm.frames.length - 1)
  const from = norm.frames[i]?.positions ?? {}
  if (i >= norm.frames.length - 1) return clonePositions(from)
  const to = norm.frames[i + 1]?.positions ?? from
  if (ease) return interpolateFrames(from, to, ease(localT))

  const out: KeyframePositions = {}
  for (const id of new Set([...Object.keys(from), ...Object.keys(to)])) {
    const t = elementSegmentT(norm, i, id, localT)
    Object.assign(out, interpolateFrames(pick(from, id), pick(to, id), t))
  }
  return out
}

function pick(pos: KeyframePositions, id: string): KeyframePositions {
  const p = pos[id]
  return p ? { [id]: p } : {}
}

/** Pose en vivo: como KeyframePositions + altura opcional (m) sobre el césped. */
export type LivePose = Record<string, PitchPosition & { y?: number }>

/** Pases más cortos que esto van rasos. */
const LOFT_MIN_DISTANCE_M = 12
const LOFT_PER_M = 0.14
const LOFT_MAX_M = 6

/** Altura máxima (m) de un pase según su distancia. */
export function passPeakHeight(distanceM: number): number {
  if (distanceM <= LOFT_MIN_DISTANCE_M) return 0
  return Math.min(LOFT_MAX_M, (distanceM - LOFT_MIN_DISTANCE_M) * LOFT_PER_M)
}

/** Parábola del pase en t ∈ [0,1] (mismo t suavizado que x/z). */
export function passArcHeight(distanceM: number, t: number): number {
  const tt = Math.min(1, Math.max(0, t))
  return 4 * passPeakHeight(distanceM) * tt * (1 - tt)
}

/** Añade `y` a los balones que viajan entre frameIndex y frameIndex+1. */
export function liftBalls(
  pose: KeyframePositions,
  norm: NormalizedAnimation,
  frameIndex: number,
  localT: number,
  ballIds: ReadonlySet<string>,
  pitchType: PitchType
): LivePose {
  const from = norm.frames[frameIndex]?.positions
  const to = norm.frames[frameIndex + 1]?.positions
  if (!from || !to || ballIds.size === 0) return pose
  const out: LivePose = { ...pose }
  for (const id of ballIds) {
    const a = from[id]
    const b = to[id]
    const p = pose[id]
    if (!a || !b || !p) continue
    const [ax, , az] = normToWorld(a.x, a.z, pitchType)
    const [bx, , bz] = normToWorld(b.x, b.z, pitchType)
    const t = elementSegmentT(norm, frameIndex, id, localT)
    out[id] = { ...p, y: passArcHeight(Math.hypot(bx - ax, bz - az), t) }
  }
  return out
}

export interface PlaybackCursor {
  frame: number
  t: number
}

/**
 * Avanza el cursor `dt` segundos. Al llegar al último frame devuelve
 * done=true con cursor (frameCount-2, 1) para que sample dé la pose final.
 */
export function advancePlayback(
  cursor: PlaybackCursor,
  dt: number,
  durationPerFrame: number,
  frameCount: number
): PlaybackCursor & { done: boolean } {
  const last = frameCount - 1
  let { frame, t } = cursor
  t += dt / Math.max(durationPerFrame, 0.01)
  while (t >= 1 && frame < last) {
    t -= 1
    frame += 1
  }
  if (frame >= last) return { frame: Math.max(0, last - 1), t: 1, done: true }
  return { frame, t, done: false }
}

export function buildKeyframeAnimation(
  frames: PitchKeyframe[],
  durationPerFrame = 2.5
): PitchKeyframeAnimation | undefined {
  if (frames.length < 2) return undefined
  return {
    mode: 'keyframes',
    duration_per_frame: durationPerFrame,
    frames: frames.slice(0, MAX_PITCH_FRAMES),
  }
}

export function applyPositionsToElements(
  elements: PitchElement[],
  positions: KeyframePositions
): PitchElement[] {
  return elements.map((el) => {
    const p = positions[el.id]
    if (!p) return el
    return {
      ...el,
      position: {
        x: clamp01to100(p.x),
        z: clamp01to100(p.z),
        rotation: p.rotation ?? el.position.rotation,
      },
    }
  })
}

export function mergeElementPosition(
  positions: KeyframePositions,
  id: string,
  patch: Partial<PitchPosition>
): KeyframePositions {
  const prev = positions[id] ?? { x: 50, z: 50 }
  return {
    ...positions,
    [id]: {
      x: clamp01to100(patch.x ?? prev.x),
      z: clamp01to100(patch.z ?? prev.z),
      rotation: patch.rotation ?? prev.rotation,
    },
  }
}
