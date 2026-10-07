'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import {
  applyPositionsToElements,
  pitchDimensions,
  STROKE_PALETTE,
  type DiagramScene,
  type KeyframePositions,
  type LivePose,
  type PlaybackCursor,
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
import { capturePitchWithStrokes, uploadPitchCapture } from './exportTopDown'
import { TokenDragBridge } from './TokenDragControls'
import { DrawingOverlay } from './DrawingOverlay'
import { PlaybackDriver } from './PlaybackDriver'

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
  const strokes = usePitchStore((s) => s.strokes)
  const drawTool = usePitchStore((s) => s.drawTool)
  const strokeColor = usePitchStore((s) => s.strokeColor)
  const setDrawTool = usePitchStore((s) => s.setDrawTool)
  const setStrokeColor = usePitchStore((s) => s.setStrokeColor)
  const addStroke = usePitchStore((s) => s.addStroke)
  const eraseAt = usePitchStore((s) => s.eraseAt)
  const clearStrokes = usePitchStore((s) => s.clearStrokes)

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [orbitEnabled, setOrbitEnabled] = useState(true)
  const glApi = useRef<GlApi | null>(null)
  const beginDragRef = useRef<
    ((id: string, e: ThreeEvent<PointerEvent>) => void) | null
  >(null)
  const playCursor = useRef<PlaybackCursor>({ frame: 0, t: 0 })
  // Pose de preview escrita por PlaybackDriver (sin re-render por frame).
  const previewPositionsRef = useRef<LivePose | null>(null)

  useEffect(() => {
    initFromScene(initialScene)
  }, [initialScene, initFromScene])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [busy, onCancel])

  const onReady = useCallback((api: GlApi) => {
    glApi.current = api
  }, [])

  const framePositions = frames[frameIndex]?.positions
  const ballIds = useMemo(
    () => new Set(elements.filter((el) => el.type === 'ball').map((el) => el.id)),
    [elements]
  )

  const sceneForRender: DiagramScene = useMemo(() => {
    return {
      version: 1,
      pitch: { type: pitchType, dimensions: pitchDimensions(pitchType) },
      elements: applyPositionsToElements(elements, framePositions ?? {}),
    }
  }, [pitchType, elements, framePositions])

  useEffect(() => {
    if (!playing) previewPositionsRef.current = null
  }, [playing])

  const onPlaybackEnd = useCallback(() => {
    previewPositionsRef.current = null
    // setFrameIndex también pone playing=false en el store.
    setFrameIndex(frames.length - 1)
  }, [frames.length, setFrameIndex])

  const handleSave = async () => {
    if (!glApi.current) {
      setError('Canvas no listo')
      return
    }
    setBusy(true)
    setError('')
    setPlaying(false)
    previewPositionsRef.current = null
    setSelectedId(null)
    try {
      await new Promise((r) => requestAnimationFrame(() => r(null)))
      const scene = toScene()
      const dataUrl = await capturePitchWithStrokes(
        glApi.current,
        scene.strokes ?? []
      )
      const url = await uploadPitchCapture(dataUrl)
      onSave(scene, url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setBusy(false)
    }
  }

  const onPointerDownElement = (id: string, e: ThreeEvent<PointerEvent>) => {
    if (playing || drawTool !== 'none') return
    beginDragRef.current?.(id, e)
  }

  const drawingMode = drawTool !== 'none'

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col bg-[#07140c] text-white"
      role="dialog"
      aria-modal="true"
      aria-label="Editor de cancha — Diagrama táctico"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-brand-300">
            Editor de cancha
          </p>
          <p className="font-display text-lg font-semibold">Diagrama táctico</p>
          <p className="text-xs text-white/45">
            Arrastra tokens · frames · flechas · Escape para salir
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
          disabled={!selectedId || drawingMode}
          onClick={removeSelected}
        >
          Eliminar
        </Button>
        <span className="mx-1 h-5 w-px bg-white/15" />
        <Button
          type="button"
          size="sm"
          variant={drawTool === 'none' ? 'secondary' : 'outline'}
          onClick={() => setDrawTool('none')}
        >
          Mover
        </Button>
        <Button
          type="button"
          size="sm"
          variant={drawTool === 'arrow' ? 'secondary' : 'outline'}
          onClick={() => setDrawTool('arrow')}
        >
          Flecha
        </Button>
        <Button
          type="button"
          size="sm"
          variant={drawTool === 'eraser' ? 'secondary' : 'outline'}
          onClick={() => setDrawTool('eraser')}
        >
          Goma
        </Button>
        {STROKE_PALETTE.map((c) => (
          <button
            key={c}
            type="button"
            title={c}
            onClick={() => setStrokeColor(c)}
            className={`h-7 w-7 rounded-full border-2 ${
              strokeColor === c ? 'border-white' : 'border-transparent'
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={strokes.length === 0}
          onClick={clearStrokes}
        >
          Limpiar trazos
        </Button>
        <span className="ml-auto self-center text-xs text-white/50">
          {elements.length} elementos · {frames.length} frames
          {strokes.length ? ` · ${strokes.length} trazos` : ''}
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
            } else {
              setFrameIndex(0)
              playCursor.current = { frame: 0, t: 0 }
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
              onClick={() => setFrameIndex(i)}
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
            onChange={(e) => setFrameIndex(Number(e.target.value))}
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
              if (!playing && drawTool === 'none') setSelectedId(id)
            }}
            onPointerDownElement={onPointerDownElement}
            livePositionsRef={previewPositionsRef}
            enableOrbit
            orbitEnabled={orbitEnabled && !playing && !drawingMode}
          >
            <TokenDragBridge
              pitchType={pitchType}
              beginDragRef={beginDragRef}
              onDraggingChange={(d) => setOrbitEnabled(!d)}
            />
            <ExportBridge onReady={onReady} />
            <PlaybackDriver
              playing={playing}
              frames={frames}
              durationPerFrame={durationPerFrame}
              cursorRef={playCursor}
              livePositionsRef={previewPositionsRef}
              pitchType={pitchType}
              ballIds={ballIds}
              onEnd={onPlaybackEnd}
            />
          </PitchSceneInner>
        </PitchCanvasShell>
        <DrawingOverlay
          strokes={strokes}
          tool={playing ? 'none' : drawTool}
          color={strokeColor}
          interactive={!playing}
          onAddStroke={addStroke}
          onEraseAt={eraseAt}
        />
        {elements.length === 0 && !drawingMode ? (
          <div className="pointer-events-none absolute inset-x-0 top-6 flex justify-center px-4">
            <p className="rounded-lg border border-white/15 bg-black/55 px-4 py-2 text-center text-sm text-white/80 backdrop-blur">
              Añade jugadores o material · arrastra en la cancha · usa Flecha para trazos
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
