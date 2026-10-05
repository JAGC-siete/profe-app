/**
 * Feature flag cliente: editor V2 (Zustand + drag + keyframes).
 * Default ON. Forzar V1 con NEXT_PUBLIC_PITCH_V2=0.
 */
export function isPitchV2Enabled(): boolean {
  return process.env.NEXT_PUBLIC_PITCH_V2 !== '0'
}
