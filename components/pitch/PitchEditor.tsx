'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { TransformControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import type { Object3D } from 'three'
import {
  cloneScene,
  newElementId,
  worldToNorm,
  type DiagramScene,
  type PitchElement,
  type PitchElementType,
  type PitchTeam,
} from '../../lib/pitch'
import { Button } from '../ui/button'
import { ExportBridge, PitchCanvasShell, PitchSceneInner, type GlApi } from './PitchSceneCore'
import { capturePitchDataUrl, uploadPitchCapture } from './exportTopDown'

function SelectedTransform({
  selectedId,
  pitchType,
  onMove,
}: {
  selectedId: string | null
  pitchType: DiagramScene['pitch']['type']
  onMove: (id: string, x: number, z: number) => void
}) {
  const { scene } = useThree()
  const obj = useMemo(() => {
    if (!selectedId) return null
    let found: Object3D | null = null
    scene.traverse((o) => {
      if (o.userData?.id === selectedId) found = o
    })
    return found
  }, [scene, selectedId])

  if (!obj || !selectedId) return null

  return (
    <TransformControls
      object={obj}
      mode="translate"
      showY={false}
      onObjectChange={() => {
        const pos = (obj as Object3D).position
        pos.y = 0
        const { x, z } = worldToNorm(pos.x, pos.z, pitchType)
        onMove(selectedId, x, z)
      }}
    />
  )
}

export function PitchEditor({
  initialScene,
  onCancel,
  onSave,
}: {
  initialScene?: DiagramScene | null
  onCancel: () => void
  onSave: (scene: DiagramScene, imageUrl: string) => void
}) {
  const [scene, setScene] = useState(() => cloneScene(initialScene))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const glApi = useRef<GlApi | null>(null)

  const onReady = useCallback((api: GlApi) => {
    glApi.current = api
  }, [])

  const addElement = (type: PitchElementType, team: PitchTeam = 'home') => {
    const el: PitchElement = {
      id: newElementId(type === 'player' ? 'p' : type[0]),
      type,
      team: type === 'player' ? team : 'neutral',
      number: type === 'player' ? scene.elements.filter((e) => e.type === 'player').length + 1 : undefined,
      color: type === 'cone' ? '#f97316' : undefined,
      position: { x: 50, z: 50, rotation: 0 },
    }
    setScene((s) => ({ ...s, elements: [...s.elements, el] }))
    setSelectedId(el.id)
  }

  const removeSelected = () => {
    if (!selectedId) return
    setScene((s) => {
      const anim = s.animation
      let nextAnim = anim
      if (anim && 'steps' in anim && anim.steps) {
        nextAnim = {
          ...anim,
          steps: anim.steps.map((step) => ({
            ...step,
            actions: step.actions.filter((a) => a.element_id !== selectedId),
          })),
        }
      } else if (anim && anim.mode === 'keyframes') {
        nextAnim = {
          ...anim,
          frames: anim.frames.map((f) => {
            const { [selectedId]: _drop, ...rest } = f.positions
            return { ...f, positions: rest }
          }),
        }
      }
      return {
        ...s,
        elements: s.elements.filter((e) => e.id !== selectedId),
        animation: nextAnim,
      }
    })
    setSelectedId(null)
  }

  const onMove = (id: string, x: number, z: number) => {
    setScene((s) => ({
      ...s,
      elements: s.elements.map((e) =>
        e.id === id ? { ...e, position: { ...e.position, x, z } } : e
      ),
    }))
  }

  const recordStepFromSelection = () => {
    if (!selectedId) {
      setError('Selecciona un elemento para grabar un step')
      return
    }
    const el = scene.elements.find((e) => e.id === selectedId)
    if (!el) return
    const prevSteps =
      scene.animation && 'steps' in scene.animation ? scene.animation.steps : []
    const duration =
      scene.animation && 'duration_per_step' in scene.animation
        ? scene.animation.duration_per_step
        : 2.5
    const nextStep = prevSteps.length + 1
    setScene({
      ...scene,
      animation: {
        duration_per_step: duration,
        steps: [
          ...prevSteps,
          {
            step: nextStep,
            actions: [
              {
                element_id: el.id,
                action_type: el.type === 'ball' ? 'pass' : 'run',
                path_type: 'linear',
                target_position: {
                  x: el.position.x,
                  z: el.position.z,
                  rotation: el.position.rotation,
                },
              },
            ],
          },
        ],
      },
    })
    setError('')
  }

  const handleSave = async () => {
    if (!glApi.current) {
      setError('Canvas no listo')
      return
    }
    setBusy(true)
    setError('')
    try {
      setSelectedId(null)
      // wait a frame so TransformControls disappear
      await new Promise((r) => requestAnimationFrame(() => r(null)))
      const dataUrl = capturePitchDataUrl(glApi.current)
      const url = await uploadPitchCapture(dataUrl)
      onSave(scene, url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-[#07140c] text-white">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-brand-300">Editor de cancha</p>
          <p className="font-display text-lg font-semibold">Diagrama táctico 3D</p>
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
        <Button type="button" size="sm" variant="outline" onClick={recordStepFromSelection}>
          Grabar step
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
          {scene.elements.length} elementos
          {scene.animation &&
          'steps' in scene.animation &&
          scene.animation.steps?.length
            ? ` · ${scene.animation.steps.length} steps`
            : scene.animation &&
                scene.animation.mode === 'keyframes' &&
                scene.animation.frames.length
              ? ` · ${scene.animation.frames.length} frames`
              : ''}
        </span>
      </div>

      {error ? (
        <p className="bg-red-500/20 px-4 py-2 text-sm text-red-100">{error}</p>
      ) : null}

      <div className="relative min-h-0 flex-1">
        <PitchCanvasShell className="h-full w-full" onCreated={onReady}>
          <PitchSceneInner
            scene={scene}
            selectedId={selectedId}
            onSelect={setSelectedId}
            enableOrbit
          >
            <SelectedTransform
              selectedId={selectedId}
              pitchType={scene.pitch.type}
              onMove={onMove}
            />
            <ExportBridge onReady={onReady} />
          </PitchSceneInner>
        </PitchCanvasShell>
      </div>
    </div>
  )
}
