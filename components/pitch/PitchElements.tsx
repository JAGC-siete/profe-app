'use client'

import { useMemo, useRef, type MutableRefObject } from 'react'
import { Html } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { CanvasTexture, type Group, type Mesh, type MeshBasicMaterial } from 'three'
import type {
  DiagramScene,
  LivePose,
  PitchElement,
  PitchTeam,
} from '../../lib/pitch'
import { normToWorld } from '../../lib/pitch'
import { EXPORT_HIDDEN } from './exportTopDown'

/** Pose escrita fuera de React (PlaybackDriver); null = usar props. */
export type LivePositionsRef = MutableRefObject<LivePose | null>

/** Escala visual: tokens ~reales se ven como puntos en cancha completa. */
const TOKEN_SCALE = 3.2

const TEAM_COLOR: Record<PitchTeam, string> = {
  home: '#2563eb',
  away: '#dc2626',
  neutral: '#eab308',
}

function elementColor(el: PitchElement): string {
  if (el.color) return el.color
  if (el.type === 'cone') return '#f97316'
  if (el.type === 'ball') return '#f8fafc'
  if (el.type === 'goal') return '#e2e8f0'
  if (el.type === 'marker') return '#a78bfa'
  return TEAM_COLOR[el.team ?? 'home']
}

/** Sombra difusa compartida (gradiente radial). */
let shadowTexture: CanvasTexture | null = null
function getShadowTexture(): CanvasTexture {
  if (shadowTexture) return shadowTexture
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    g.addColorStop(0, 'rgba(0,0,0,1)')
    g.addColorStop(0.55, 'rgba(0,0,0,0.55)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, size, size)
  }
  shadowTexture = new CanvasTexture(canvas)
  return shadowTexture
}

/** Radio de sombra (unidades locales del token); sin sombra = no se dibuja. */
const SHADOW_RADIUS: Partial<Record<PitchElement['type'], number>> = {
  player: 0.6,
  cone: 0.5,
  ball: 0.4,
}
const SHADOW_OPACITY = 0.4
/** Luz cenital ligeramente oblicua: la sombra se corre al alejarse del suelo. */
const SHADOW_OFFSET = { x: 0.12, z: 0.18 }
const SHADOW_SHIFT_PER_M = 0.3

/** m/s a partir de los cuales el indicador de dirección se ve entero. */
const FULL_SPEED_MS = 5
const TURN_RATE = 10
/** Más que esto en un solo cuadro = salto de pose (reset/replay), no carrera. */
const TELEPORT_M = 5
const SPEED_SMOOTHING = 8

function dampAngle(current: number, target: number, rate: number, dt: number) {
  const diff = Math.atan2(Math.sin(target - current), Math.cos(target - current))
  return current + diff * (1 - Math.exp(-rate * dt))
}

function ElementMesh({
  el,
  pitchType,
  selected,
  onSelect,
  onPointerDownElement,
  livePositionsRef,
}: {
  el: PitchElement
  pitchType: DiagramScene['pitch']['type']
  selected?: boolean
  onSelect?: (id: string) => void
  onPointerDownElement?: (id: string, e: ThreeEvent<PointerEvent>) => void
  livePositionsRef?: LivePositionsRef
}) {
  const [x, , z] = normToWorld(el.position.x, el.position.z, pitchType)
  const rotY = ((el.position.rotation ?? 0) * Math.PI) / 180
  const color = elementColor(el)
  const shadowRadius = SHADOW_RADIUS[el.type]
  const isPlayer = el.type === 'player'

  const groupRef = useRef<Group>(null)
  const bodyRef = useRef<Group>(null)
  const shadowRef = useRef<Mesh>(null)
  const headingMatRef = useRef<MeshBasicMaterial>(null)
  const motion = useRef({ wx: x, wz: z, speed: 0, heading: rotY })

  // Siempre reaplica (ref o props): tras una reproducción el grupo no queda
  // con una pose mutada que React no sabe que cambió.
  useFrame((_, rawDelta) => {
    const group = groupRef.current
    const body = bodyRef.current
    if (!group || !body || !livePositionsRef) return
    const dt = Math.min(rawDelta, 0.1)
    const live = livePositionsRef.current?.[el.id]
    const p = live ?? el.position
    const [wx, , wz] = normToWorld(p.x, p.z, pitchType)
    const lift = live?.y ?? 0
    const m = motion.current

    // Velocidad solo durante la reproducción (arrastrar no cuenta como correr).
    const dx = wx - m.wx
    const dz = wz - m.wz
    const jump = Math.hypot(dx, dz)
    const step = jump > TELEPORT_M ? 0 : jump
    const rawSpeed = live && dt > 0 ? step / dt : 0
    m.speed += (rawSpeed - m.speed) * (1 - Math.exp(-SPEED_SMOOTHING * dt))
    m.wx = wx
    m.wz = wz

    group.position.set(wx, lift, wz)

    const restHeading = (((p.rotation ?? el.position.rotation) ?? 0) * Math.PI) / 180
    if (isPlayer && live) {
      // Mirar hacia donde corre; quieto conserva el último rumbo.
      if (step > 1e-4) m.heading = dampAngle(m.heading, Math.atan2(dx, dz), TURN_RATE, dt)
    } else if (!isPlayer || m.speed < 0.1) {
      // Esperar a que se apague el indicador antes de volver al rumbo guardado.
      m.heading = restHeading
    }
    body.rotation.y = m.heading

    if (headingMatRef.current) {
      headingMatRef.current.opacity = 0.85 * Math.min(1, m.speed / FULL_SPEED_MS)
    }

    const shadow = shadowRef.current
    if (shadow) {
      // La sombra queda en el césped aunque el balón suba; se aleja y se difumina.
      const local = lift / TOKEN_SCALE
      const shift = lift * SHADOW_SHIFT_PER_M / TOKEN_SCALE
      shadow.position.set(SHADOW_OFFSET.x + shift, 0.02 - local, SHADOW_OFFSET.z + shift)
      const k = 1 / (1 + lift * 0.25)
      shadow.scale.setScalar(k)
      ;(shadow.material as MeshBasicMaterial).opacity = SHADOW_OPACITY * k
    }
  })

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    onSelect?.(el.id)
  }

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    onSelect?.(el.id)
    onPointerDownElement?.(el.id, e)
  }

  return (
    <group
      ref={groupRef}
      position={[x, 0, z]}
      scale={TOKEN_SCALE}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      userData={{ id: el.id }}
    >
      {/* Hit target más grande para touch / click (opacity 0, sigue raycast) */}
      <mesh position={[0, 0.4, 0]}>
        <sphereGeometry args={[1.1, 12, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {shadowRadius ? (
        <mesh
          ref={shadowRef}
          position={[SHADOW_OFFSET.x, 0.02, SHADOW_OFFSET.z]}
          rotation={[-Math.PI / 2, 0, 0]}
          raycast={() => null}
          userData={{ [EXPORT_HIDDEN]: true }}
        >
          <planeGeometry args={[shadowRadius * 2, shadowRadius * 2]} />
          <meshBasicMaterial
            map={getShadowTexture()}
            transparent
            opacity={SHADOW_OPACITY}
            depthWrite={false}
          />
        </mesh>
      ) : null}

      <group ref={bodyRef} rotation={[0, rotY, 0]}>
        {el.type === 'cone' ? (
          <mesh position={[0, 0.35, 0]}>
            <coneGeometry args={[0.45, 0.7, 10]} />
            <meshStandardMaterial
              color={color}
              emissive={selected ? '#fff' : '#000'}
              emissiveIntensity={selected ? 0.35 : 0}
            />
          </mesh>
        ) : null}

        {el.type === 'ball' ? (
          <mesh position={[0, 0.35, 0]}>
            <sphereGeometry args={[0.32, 16, 16]} />
            <meshStandardMaterial
              color={color}
              emissive={selected ? '#fff' : '#000'}
              emissiveIntensity={selected ? 0.25 : 0}
            />
          </mesh>
        ) : null}

        {el.type === 'goal' ? (
          <>
            <mesh position={[-1.8, 1, 0]}>
              <boxGeometry args={[0.12, 2, 0.12]} />
              <meshStandardMaterial color={color} />
            </mesh>
            <mesh position={[1.8, 1, 0]}>
              <boxGeometry args={[0.12, 2, 0.12]} />
              <meshStandardMaterial color={color} />
            </mesh>
            <mesh position={[0, 2, 0]}>
              <boxGeometry args={[3.72, 0.12, 0.12]} />
              <meshStandardMaterial color={color} />
            </mesh>
          </>
        ) : null}

        {el.type === 'marker' ? (
          <mesh position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.55, 20]} />
            <meshBasicMaterial color={color} transparent opacity={selected ? 1 : 0.85} />
          </mesh>
        ) : null}

        {isPlayer ? (
          <>
            <mesh position={[0, 0.55, 0]}>
              <capsuleGeometry args={[0.4, 0.6, 6, 12]} />
              <meshStandardMaterial
                color={color}
                emissive={selected ? '#fff' : '#000'}
                emissiveIntensity={selected ? 0.3 : 0}
              />
            </mesh>
            {/* Indicador de rumbo (+z local); aparece al correr. */}
            <mesh
              position={[0, 0.05, 0.78]}
              rotation={[-Math.PI / 2, 0, -Math.PI / 2]}
              raycast={() => null}
            >
              <circleGeometry args={[0.28, 3]} />
              <meshBasicMaterial
                ref={headingMatRef}
                color="#ffffff"
                transparent
                opacity={0}
                depthWrite={false}
              />
            </mesh>
          </>
        ) : null}
      </group>

      {isPlayer && el.number != null ? (
        <Html
          position={[0, 1.55, 0]}
          center
          distanceFactor={28}
          style={{ pointerEvents: 'none' }}
        >
          <span
            className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-bold shadow ${
              selected ? 'bg-white text-[#07140c]' : 'bg-black/70 text-white'
            }`}
          >
            {el.number}
          </span>
        </Html>
      ) : null}

      {selected ? (
        <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.85, 1.05, 28]} />
          <meshBasicMaterial color="#6ee7b7" transparent opacity={0.9} />
        </mesh>
      ) : null}
    </group>
  )
}

export function PitchElements({
  scene,
  selectedId,
  onSelect,
  onPointerDownElement,
  livePositions,
  livePositionsRef,
}: {
  scene: DiagramScene
  selectedId?: string | null
  onSelect?: (id: string) => void
  onPointerDownElement?: (id: string, e: ThreeEvent<PointerEvent>) => void
  livePositions?: Record<string, { x: number; z: number; rotation?: number }>
  livePositionsRef?: LivePositionsRef
}) {
  const elements = useMemo(() => {
    if (!livePositions) return scene.elements
    return scene.elements.map((el) => {
      const live = livePositions[el.id]
      if (!live) return el
      return {
        ...el,
        position: {
          x: live.x,
          z: live.z,
          rotation: live.rotation ?? el.position.rotation,
        },
      }
    })
  }, [scene.elements, livePositions])

  return (
    <>
      {elements.map((el) => (
        <ElementMesh
          key={el.id}
          el={el}
          pitchType={scene.pitch.type}
          selected={selectedId === el.id}
          onSelect={onSelect}
          onPointerDownElement={onPointerDownElement}
          livePositionsRef={livePositionsRef}
        />
      ))}
    </>
  )
}
