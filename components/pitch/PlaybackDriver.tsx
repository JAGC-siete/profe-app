'use client'

import { useLayoutEffect, useRef, type MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  advancePlayback,
  liftBalls,
  sampleNormalizedAnimation,
  type KeyframePositions,
  type LivePose,
  type PitchKeyframe,
  type PitchType,
  type PlaybackCursor,
} from '../../lib/pitch'

/** Tope de delta: al volver de una pestaña oculta no saltar la jugada entera. */
const MAX_DELTA_S = 0.1

/**
 * Avanza la reproducción dentro del loop de R3F y escribe la pose en
 * `livePositionsRef` (sin setState por frame). Montar dentro del Canvas.
 * Solo notifica a React cuando cambia el frame entero o termina.
 */
export function PlaybackDriver({
  playing,
  frames,
  durationPerFrame,
  cursorRef,
  livePositionsRef,
  pitchType,
  ballIds,
  onFrameChange,
  onEnd,
}: {
  playing: boolean
  frames: PitchKeyframe[]
  durationPerFrame: number
  cursorRef: MutableRefObject<PlaybackCursor>
  livePositionsRef: MutableRefObject<LivePose | null>
  pitchType: PitchType
  /** Balones: se elevan en pases largos. */
  ballIds?: ReadonlySet<string>
  onFrameChange?: (frame: number) => void
  onEnd: (finalPositions: KeyframePositions) => void
}) {
  // El loop puede correr un cuadro más antes de que React aplique playing=false:
  // sin este flag onEnd se dispararía dos veces.
  const finished = useRef(false)
  useLayoutEffect(() => {
    if (playing) finished.current = false
  }, [playing])

  // Prioridad negativa: corre antes que los useFrame de los tokens (sin lag de 1 frame).
  useFrame((_, delta) => {
    if (!playing || finished.current || frames.length < 2) return
    const prevFrame = cursorRef.current.frame
    const next = advancePlayback(
      cursorRef.current,
      Math.min(delta, MAX_DELTA_S),
      durationPerFrame,
      frames.length
    )
    cursorRef.current = { frame: next.frame, t: next.t }
    const norm = { durationPerFrame, frames }
    const pose = sampleNormalizedAnimation(norm, next.frame, next.t)
    livePositionsRef.current = ballIds
      ? liftBalls(pose, norm, next.frame, next.t, ballIds, pitchType)
      : pose
    if (next.done) {
      finished.current = true
      onEnd(pose)
      return
    }
    if (next.frame !== prevFrame) onFrameChange?.(next.frame)
  }, -1)

  return null
}
