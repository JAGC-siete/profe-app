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
} from './types'
import { MAX_PITCH_FRAMES } from './types'
import { newElementId } from './coords'

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

/** Pose en tiempo global: frameIndex + localT entre frameIndex y frameIndex+1. */
export function sampleNormalizedAnimation(
  norm: NormalizedAnimation,
  frameIndex: number,
  localT: number
): KeyframePositions {
  if (norm.frames.length === 0) return {}
  const i = Math.min(Math.max(0, frameIndex), norm.frames.length - 1)
  const from = norm.frames[i]?.positions ?? {}
  if (i >= norm.frames.length - 1) return clonePositions(from)
  const to = norm.frames[i + 1]?.positions ?? from
  return interpolateFrames(from, to, localT)
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
