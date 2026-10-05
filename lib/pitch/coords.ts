import type { PitchType } from './types'

/** Ancho/largo del plano Three (unidades locales). */
export const PITCH_WORLD = { width: 68, length: 105 } as const

export function pitchAspect(type: PitchType): { width: number; length: number } {
  switch (type) {
    case 'half_field':
      return { width: PITCH_WORLD.width, length: PITCH_WORLD.length / 2 }
    case 'penalty_box':
      return { width: 40.32, length: 16.5 }
    default:
      return { width: PITCH_WORLD.width, length: PITCH_WORLD.length }
  }
}

/** Dimensiones metadata [largo, ancho] en metros (schema). */
export function pitchDimensions(type: PitchType): [number, number] {
  const { width, length } = pitchAspect(type)
  return [length, width]
}

/** Normalizado 0–100 → mundo Three (centrado en origen, Y=0). */
export function normToWorld(
  x: number,
  z: number,
  type: PitchType = 'full_field'
): [number, number, number] {
  const { width, length } = pitchAspect(type)
  const wx = ((x / 100) - 0.5) * width
  const wz = ((z / 100) - 0.5) * length
  return [wx, 0, wz]
}

export function worldToNorm(
  wx: number,
  wz: number,
  type: PitchType = 'full_field'
): { x: number; z: number } {
  const { width, length } = pitchAspect(type)
  const x = ((wx / width) + 0.5) * 100
  const z = ((wz / length) + 0.5) * 100
  return {
    x: clamp(x, 0, 100),
    z: clamp(z, 0, 100),
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

export function newElementId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`
}
