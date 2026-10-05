'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import {
  applyPositionsToElements,
  sampleNormalizedAnimation,
  type DiagramScene,
} from '../../lib/pitch'
import { usePitchStore } from '../../lib/pitch/store'
import { MAX_PITCH_FRAMES } from '../../lib/pitch/types'
import { Button } from '../ui/button'
import {
  ExportBridge,
  PitchCanvasShell,
  PitchSceneInner,
  type GlApi,
} from './PitchSceneCore'
import { capturePitchDataUrl, uploadPitchCapture } from './exportTopDown'
import { TokenDragBridge } from './TokenDragControls'

export function PitchEditorV2({
  initialScene,
  onCancel,
  onSave,
}: {
  initialScene?: DiagramScene | null
  onCancel: () => void
  onSave: (scene: DiagramScene, imageUrl: string) => void
}) {
  const initFromScene = usePitchStore((s) => s.initFromScene)
  const pitchType = usePitchStore((s) => s.pitchType)
  const elements = usePitchStore((s) => s.elements)
  const frames = usePitchStore((s) => s.frames)
  const frameIndex = usePitchStore((s) => s.frameIndex)
  const selectedId = usePitchStore((s) => s.selectedId)
  const playing = usePitchStore((s) => s.playing)
  const durationPerFrame = usePitchStore((s) => s.durationPerFrame)
  const setSelectedId = usePitchStore((s) => s.setSelectedId)
  const setPlaying = usePitchStore((s) => s.setPlaying)
  const setFrameIndex = usePitchStore((s) => s.setFrameIndex)
  const addElement = usePitchStore((s) => s.addElement)
  const removeSelected = usePitchStore((s) => s.removeSelected)
  const addFrame = usePitchStore((s) => s.addFrame)
  const duplicateFrame = usePitchStore((s) => s.duplicateFrame)
  const deleteFrame = usePitchStore((s) => s.deleteFrame)
  const toScene = usePitchStore((s) => s.toScene)

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [orbitEnabled, setOrbitEnabled] = useState(true)
  const [previewPositions, setPreviewPositions] = useState<
    Record<string, { x: number; z: number; rotation?: number }> | null
  >(null)
  const glApi = useRef<GlApi | null>(null)
  const beginDragRef = useRef<
    ((id: string, e: ThreeEvent<PointerEvent>) => void) | null
  >(null)
  const raf = useRef<number | null>(null)
  const playCursor = useRef({ frame: 0, t: 0 })

  useEffect(() => {
    initFromScene(initialScene)
  }, [initialScene, initFromScene])

  const onReady = useCallback((api: GlApi) => {
    glApi.current = api
  }, [])

  const framePositions = frames[frameIndex]?.positions

  const sceneForRender: DiagramScene = useMemo(() => {
    const positions = previewPositions ?? framePositions ?? {}
    return {
      version: 1,
      pitch: { type: pitchType, dimensions: [105, 68] },
      elements: applyPositionsToElements(elements, positions),
    }
  }, [pitchType, elements, previewPositions, framePositions])

  // Playback preview (respect document.hidden)
  useEffect(() => {
    if (!playing || frames.length < 2) {
      if (!playing) setPreviewPositions(null)
      return
    }

    let cancelled = false
    playCursor.current = { frame: 0, t: 0 }
    let last = performance.now()
    const framesSnap = frames
    const dur = durationPerFrame

    const tick = (now: number) => {
      if (cancelled) return
      if (typeof document !== 'undefined' && document.hidden) {
        last = now
        raf.current = requestAnimationFrame(tick)
        return
      }
      const dt = (now - last) / 1000
      last = now
      let { frame, t } = playCursor.current
      t += dt / dur
      while (t >= 1 && frame < framesSnap.length - 1) {
        t -= 1
        frame += 1
      }
      if (frame >= framesSnap.length - 1 && t >= 1) {
        playCursor.current = { frame: framesSnap.length - 1, t: 1 }
        setPreviewPositions(
          sampleNormalizedAnimation(
            { durationPerFrame: dur, frames: framesSnap },
            framesSnap.length - 2,
            1
          )
        )
        setPlaying(false)
        setFrameIndex(framesSnap.length - 1)
        return
      }
      playCursor.current = { frame, t }
      setPreviewPositions(
        sampleNormalizedAnimation(
          { durationPerFrame: dur, frames: framesSnap },
          frame,
          t
        )
      )
      raf.current = requestAnimationFrame(tick)
    }

    raf.current = requestAnimationFrame(tick)
    return () => {
      cancelled = true
      if (raf.current != null) cancelAnimationFrame(raf.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- start only when play toggles
  }, [playing, frames, durationPerFrame, setPlaying, setFrameIndex])

  const handleSave = async () => {
    if (!glApi.current) {
      setError('Canvas no listo')
      return
    }
    setBusy(true)
    setError('')
    setPlaying(false)
    setPreviewPositions(null)
    setSelectedId(null)
    try {
      await new Promise((r) => requestAnimationFrame(() => r(null)))
      const scene = toScene()
      const dataUrl = capturePitchDataUrl(glApi.current)
      const url = await uploadPitchCapture(dataUrl)
      onSave(scene, url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setBusy(false)
    }
  }

  const onPointerDownElement = (id: string, e: ThreeEvent<PointerEvent>) => {
    if (playing) return
    beginDragRef.current?.(id, e)
  }

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-[#07140c] text-white">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-brand-300">
            Editor de cancha V2
          </p>
          <p className="font-display text-lg font-semibold">
            Drag + keyframes
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={busy}>
            Cancelar
          </Button>
          <Button type="button" size="sm" onClick={() => void handleSave()} disabled={busy}>
            {busy ? 'Guardando…' : 'Guardar diagrama'}
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap gap-2 border-b border-white/10 px-4 py-2">
        <Button type="button" size="sm" variant="secondary" onClick={() => addElement('player', 'home')}>
          + Jugador local
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => addElement('player', 'away')}>
          + Rival
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => addElement('cone')}>
          + Cono
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => addElement('ball')}>
          + Balón
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => addElement('goal')}>
          + Arco
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!selectedId}
          onClick={removeSelected}
        >
          Eliminar
        </Button>
        <span className="ml-auto self-center text-xs text-white/50">
          {elements.length} elementos · {frames.length} frames
        </span>
      </div>

      {/* Timeline */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={frames.length < 2}
          onClick={() => {
            if (playing) {
              setPlaying(false)
              setPreviewPositions(null)
            } else {
              setFrameIndex(0)
              setPlaying(true)
            }
          }}
        >
          {playing ? 'Pausa' : 'Play'}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            setPlaying(false)
            setPreviewPositions(null)
            setFrameIndex(0)
          }}
        >
          Reset
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={frames.length >= MAX_PITCH_FRAMES || playing}
          onClick={addFrame}
        >
          + Frame
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={frames.length >= MAX_PITCH_FRAMES || playing}
          onClick={duplicateFrame}
        >
          Duplicar
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={frames.length <= 1 || playing}
          onClick={deleteFrame}
        >
          Borrar frame
        </Button>
        <div className="flex flex-wrap gap-1">
          {frames.map((f, i) => (
            <button
              key={f.id}
              type="button"
              disabled={playing}
              onClick={() => {
                setPreviewPositions(null)
                setFrameIndex(i)
              }}
              className={`rounded px-2 py-1 text-xs ${
                i === frameIndex
                  ? 'bg-brand-500 text-white'
                  : 'bg-white/10 text-white/70 hover:bg-white/20'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
        {frames.length >= 2 ? (
          <input
            type="range"
            min={0}
            max={frames.length - 1}
            step={1}
            value={frameIndex}
            disabled={playing}
            onChange={(e) => {
              setPreviewPositions(null)
              setFrameIndex(Number(e.target.value))
            }}
            className="ml-2 w-32 accent-brand-400"
            aria-label="Scrubber de frames"
          />
        ) : null}
      </div>

      {error ? (
        <p className="bg-red-500/20 px-4 py-2 text-sm text-red-100">{error}</p>
      ) : null}

      <div className="relative min-h-0 flex-1 touch-none select-none">
        <PitchCanvasShell className="h-full w-full" onCreated={onReady}>
          <PitchSceneInner
            scene={sceneForRender}
            selectedId={selectedId}
            onSelect={(id) => {
              if (!playing) setSelectedId(id)
            }}
            onPointerDownElement={onPointerDownElement}
            enableOrbit
            orbitEnabled={orbitEnabled && !playing}
          >
            <TokenDragBridge
              pitchType={pitchType}
              beginDragRef={beginDragRef}
              onDraggingChange={(d) => setOrbitEnabled(!d)}
            />
            <ExportBridge onReady={onReady} />
          </PitchSceneInner>
        </PitchCanvasShell>
      </div>
    </div>
  )
}
