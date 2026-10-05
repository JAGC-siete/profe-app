'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  hasNormalizedAnimation,
  normalizeAnimation,
  positionsFromElements,
  sampleNormalizedAnimation,
  type DiagramScene,
  type KeyframePositions,
} from '../../lib/pitch'
import { Button } from '../ui/button'
import { PitchCanvasShell, PitchSceneInner } from './PitchSceneCore'

export function PitchPlayer({ scene }: { scene: DiagramScene }) {
  const norm = useMemo(() => normalizeAnimation(scene), [scene])
  const canPlay = hasNormalizedAnimation(norm)
  const [live, setLive] = useState<KeyframePositions>(() =>
    positionsFromElements(scene.elements)
  )
  const [playing, setPlaying] = useState(false)
  const [frameIndex, setFrameIndex] = useState(0)
  const raf = useRef<number | null>(null)
  const cursor = useRef({ frame: 0, t: 0 })

  useEffect(() => {
    setLive(positionsFromElements(scene.elements))
    setFrameIndex(0)
    setPlaying(false)
  }, [scene])

  useEffect(() => {
    if (!playing || !canPlay) return

    let cancelled = false
    // Start from current scrub position once; do not re-bind on frameIndex updates.
    cursor.current = { frame: frameIndex, t: 0 }
    let last = performance.now()
    const duration = norm.durationPerFrame
    const frames = norm.frames

    const tick = (now: number) => {
      if (cancelled) return
      if (typeof document !== 'undefined' && document.hidden) {
        last = now
        raf.current = requestAnimationFrame(tick)
        return
      }
      const dt = (now - last) / 1000
      last = now
      let { frame, t } = cursor.current
      t += dt / duration
      while (t >= 1 && frame < frames.length - 1) {
        t -= 1
        frame += 1
      }
      if (frame >= frames.length - 1 && t >= 1) {
        setLive(
          sampleNormalizedAnimation(
            { durationPerFrame: duration, frames },
            frames.length - 2,
            1
          )
        )
        setFrameIndex(frames.length - 1)
        setPlaying(false)
        return
      }
      cursor.current = { frame, t }
      setLive(
        sampleNormalizedAnimation(
          { durationPerFrame: duration, frames },
          frame,
          t
        )
      )
      setFrameIndex(frame)
      raf.current = requestAnimationFrame(tick)
    }

    raf.current = requestAnimationFrame(tick)
    return () => {
      cancelled = true
      if (raf.current != null) cancelAnimationFrame(raf.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- start only when play toggles
  }, [playing, canPlay, norm])

  const reset = () => {
    setPlaying(false)
    setLive(
      norm.frames[0]?.positions ?? positionsFromElements(scene.elements)
    )
    setFrameIndex(0)
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
            onClick={() => {
              if (!playing && frameIndex >= norm.frames.length - 1) reset()
              setPlaying((p) => !p)
            }}
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
      <div className="h-[42vh] min-h-[220px] w-full">
        <PitchCanvasShell className="h-full w-full">
          <PitchSceneInner scene={scene} livePositions={live} />
        </PitchCanvasShell>
      </div>
    </div>
  )
}
