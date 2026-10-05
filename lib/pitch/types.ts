export type PitchType = 'full_field' | 'half_field' | 'penalty_box'

export type PitchElementType = 'player' | 'cone' | 'ball' | 'goal' | 'marker'

export type PitchTeam = 'home' | 'away' | 'neutral'

export type PitchActionType = 'run' | 'pass' | 'dribble' | 'move'

export type PitchPathType = 'linear' | 'curve'

export interface PitchPosition {
  x: number
  z: number
  rotation?: number
}

export interface PitchElement {
  id: string
  type: PitchElementType
  team?: PitchTeam
  number?: number
  color?: string
  label?: string
  position: PitchPosition
}

/** Legacy action-based step (pre-keyframes). */
export interface PitchAction {
  element_id: string
  action_type: PitchActionType
  path_type: PitchPathType
  control_points?: Array<{ x: number; z: number }>
  target_position: { x: number; z: number; rotation?: number }
}

export interface PitchAnimStep {
  step: number
  actions: PitchAction[]
}

export type KeyframePositions = Record<string, PitchPosition>

export interface PitchKeyframe {
  id: string
  positions: KeyframePositions
}

/** Preferred animation format (V2 editor). */
export interface PitchKeyframeAnimation {
  mode: 'keyframes'
  duration_per_frame: number
  frames: PitchKeyframe[]
}

/** Legacy animation format (Grabar step). */
export interface PitchLegacyAnimation {
  mode?: 'steps'
  duration_per_step: number
  steps: PitchAnimStep[]
}

export type PitchAnimation = PitchKeyframeAnimation | PitchLegacyAnimation

export interface DiagramScene {
  version: 1
  pitch: {
    type: PitchType
    dimensions: [number, number]
  }
  elements: PitchElement[]
  animation?: PitchAnimation
}

/** Runtime-normalized animation used by player/editor. */
export interface NormalizedAnimation {
  durationPerFrame: number
  frames: PitchKeyframe[]
}

export const MAX_PITCH_FRAMES = 24
export const MAX_PITCH_ELEMENTS = 80
