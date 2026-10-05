/** Feature flag cliente: editor V2 (Zustand + drag + keyframes). Default off. */
export function isPitchV2Enabled(): boolean {
  return process.env.NEXT_PUBLIC_PITCH_V2 === '1'
}
