'use client'

import { useEffect, type ReactNode } from 'react'
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { Camera, Scene, WebGLRenderer } from 'three'
import type { DiagramScene } from '../../lib/pitch'
import { pitchAspect } from '../../lib/pitch'
import { FieldPlane } from './FieldPlane'
import { PitchElements, type LivePositionsRef } from './PitchElements'

export type GlApi = { gl: WebGLRenderer; scene: Scene; camera: Camera }

function TopDownCamera({ pitchType }: { pitchType: DiagramScene['pitch']['type'] }) {
  const { camera, size } = useThree()
  const { width, length } = pitchAspect(pitchType)

  useEffect(() => {
    const span = Math.max(width, length) * 0.72
    camera.position.set(0, span, 0.01)
    camera.up.set(0, 0, -1)
    camera.lookAt(0, 0, 0)
    camera.updateProjectionMatrix()
  }, [camera, width, length, size.width, size.height, pitchType])

  return null
}

export function PitchSceneInner({
  scene,
  selectedId,
  onSelect,
  onPointerDownElement,
  livePositions,
  livePositionsRef,
  enableOrbit = false,
  orbitEnabled = true,
  children,
}: {
  scene: DiagramScene
  selectedId?: string | null
  onSelect?: (id: string) => void
  onPointerDownElement?: (id: string, e: ThreeEvent<PointerEvent>) => void
  livePositions?: Record<string, { x: number; z: number; rotation?: number }>
  /** Pose por frame sin re-render (reproducción). */
  livePositionsRef?: LivePositionsRef
  enableOrbit?: boolean
  /** Disable pan/zoom while dragging tokens. */
  orbitEnabled?: boolean
  children?: ReactNode
}) {
  return (
    <>
      <color attach="background" args={['#0b1f12']} />
      <ambientLight intensity={0.85} />
      <directionalLight position={[20, 40, 10]} intensity={0.65} />
      <TopDownCamera pitchType={scene.pitch.type} />
      <FieldPlane type={scene.pitch.type} />
      <PitchElements
        scene={scene}
        selectedId={selectedId}
        onSelect={onSelect}
        onPointerDownElement={onPointerDownElement}
        livePositions={livePositions}
        livePositionsRef={livePositionsRef}
      />
      {enableOrbit ? (
        <OrbitControls
          enablePan
          enableRotate={false}
          enableZoom
          minDistance={20}
          maxDistance={120}
          target={[0, 0, 0]}
          enabled={orbitEnabled}
        />
      ) : null}
      {children}
    </>
  )
}

export function PitchCanvasShell({
  children,
  className,
  onCreated,
}: {
  children: ReactNode
  className?: string
  onCreated?: (api: GlApi) => void
}) {
  return (
    <Canvas
      className={className}
      dpr={[1, 1.5]}
      gl={{
        antialias: true,
        preserveDrawingBuffer: true,
        powerPreference: 'low-power',
      }}
      camera={{ position: [0, 80, 0.01], fov: 35, near: 0.1, far: 500 }}
      onCreated={({ gl, scene, camera }) => {
        gl.setClearColor('#0b1f12')
        onCreated?.({ gl, scene, camera })
      }}
    >
      {children}
    </Canvas>
  )
}

export function ExportBridge({ onReady }: { onReady: (api: GlApi) => void }) {
  const { gl, scene, camera } = useThree()
  useEffect(() => {
    onReady({ gl, scene, camera })
  }, [gl, scene, camera, onReady])
  return null
}
