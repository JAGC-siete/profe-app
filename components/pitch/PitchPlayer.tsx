'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  hasNormalizedAnimation,
  normalizeAnimation,
  positionsFromElements,
  type DiagramScene,
  type KeyframePositions,
  type LivePose,
  type PlaybackCursor,
} from '../../lib/pitch'
import { Button } from '../ui/button'
import { PitchCanvasShell, PitchSceneInner } from './PitchSceneCore'
import { DrawingOverlay } from './DrawingOverlay'
import { PlaybackDriver } from './PlaybackDriver'

export function PitchPlayer({ scene }: { scene: DiagramScene }) {
  const norm = useMemo(() => normalizeAnimation(scene), [scene])
  const canPlay = hasNormalizedAnimation(norm)
  // Pose estática (pausa / scrub). Durante play manda livePositionsRef.
  const [live, setLive] = useState<KeyframePositions>(() =>
    positionsFromElements(scene.elements)
  )
  const [playing, setPlaying] = useState(false)
  const [frameIndex, setFrameIndex] = useState(0)
  const cursor = useRef<PlaybackCursor>({ frame: 0, t: 0 })
  const livePositionsRef = useRef<LivePose | null>(null)
  const ballIds = useMemo(
    () => new Set(scene.elements.filter((el) => el.type === 'ball').map((el) => el.id)),
    [scene.elements]
  )

  useEffect(() => {
    setLive(positionsFromElements(scene.elements))
    setFrameIndex(0)
    setPlaying(false)
    cursor.current = { frame: 0, t: 0 }
    livePositionsRef.current = null
  }, [scene])

  /** Vuelca la pose del loop a React y suelta el ref. */
  const freeze = useCallback((pose: KeyframePositions | null) => {
    if (pose) setLive(pose)
    livePositionsRef.current = null
  }, [])

  const onEnd = useCallback(
    (pose: KeyframePositions) => {
      freeze(pose)
      cursor.current = { frame: norm.frames.length - 1, t: 0 }
      setFrameIndex(norm.frames.length - 1)
      setPlaying(false)
    },
    [freeze, norm.frames.length]
  )

  const reset = () => {
    setPlaying(false)
    freeze(null)
    cursor.current = { frame: 0, t: 0 }
    setLive(
      norm.frames[0]?.positions ?? positionsFromElements(scene.elements)
    )
    setFrameIndex(0)
  }

  const togglePlay = () => {
    if (playing) {
      setPlaying(false)
      freeze(livePositionsRef.current)
      return
    }
    if (frameIndex >= norm.frames.length - 1) reset()
    setPlaying(true)
  }

  const label = useMemo(() => {
    if (!canPlay) return 'Sin animación'
    return `Frame ${Math.min(frameIndex + 1, norm.frames.length)}/${norm.frames.length}`
  }, [canPlay, frameIndex, norm.frames.length])

  return (
    <div className="mt-6 overflow-hidden rounded-lg border border-white/10">
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
        <p className="text-xs uppercase tracking-wider text-white/50">{label}</p>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={!canPlay}
            onClick={togglePlay}
          >
            {playing ? 'Pausa' : 'Play'}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={reset}>
            Reset
          </Button>
        </div>
      </div>
      {canPlay ? (
        <div className="border-b border-white/10 px-3 py-2">
          <input
            type="range"
            min={0}
            max={Math.max(0, norm.frames.length - 1)}
            step={1}
            value={frameIndex}
            disabled={playing}
            onChange={(e) => {
              const i = Number(e.target.value)
              setPlaying(false)
              freeze(null)
              cursor.current = { frame: i, t: 0 }
              setFrameIndex(i)
              setLive(
                norm.frames[i]?.positions ??
                  positionsFromElements(scene.elements)
              )
            }}
            className="w-full accent-brand-400"
            aria-label="Scrubber"
          />
        </div>
      ) : null}
      <div className="relative h-[42vh] min-h-[220px] w-full">
        <PitchCanvasShell className="h-full w-full">
          <PitchSceneInner
            scene={scene}
            livePositions={live}
            livePositionsRef={livePositionsRef}
          >
            <PlaybackDriver
              playing={playing && canPlay}
              frames={norm.frames}
              durationPerFrame={norm.durationPerFrame}
              cursorRef={cursor}
              livePositionsRef={livePositionsRef}
              pitchType={scene.pitch.type}
              ballIds={ballIds}
              onFrameChange={setFrameIndex}
              onEnd={onEnd}
            />
          </PitchSceneInner>
        </PitchCanvasShell>
        <DrawingOverlay
          strokes={scene.strokes ?? []}
          tool="none"
          color="#F2D98A"
          interactive={false}
        />
      </div>
    </div>
  )
}
