'use client'

import { useMemo } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import type { DiagramScene, PitchElement, PitchTeam } from '../../lib/pitch'
import { normToWorld } from '../../lib/pitch'

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

function ElementMesh({
  el,
  pitchType,
  selected,
  onSelect,
  onPointerDownElement,
}: {
  el: PitchElement
  pitchType: DiagramScene['pitch']['type']
  selected?: boolean
  onSelect?: (id: string) => void
  onPointerDownElement?: (id: string, e: ThreeEvent<PointerEvent>) => void
}) {
  const [x, , z] = normToWorld(el.position.x, el.position.z, pitchType)
  const rotY = ((el.position.rotation ?? 0) * Math.PI) / 180
  const color = elementColor(el)

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
      position={[x, 0, z]}
      rotation={[0, rotY, 0]}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      userData={{ id: el.id }}
    >
      {el.type === 'cone' ? (
        <mesh position={[0, 0.35, 0]}>
          <coneGeometry args={[0.45, 0.7, 10]} />
          <meshStandardMaterial
            color={color}
            emissive={selected ? '#fff' : '#000'}
            emissiveIntensity={selected ? 0.25 : 0}
          />
        </mesh>
      ) : null}

      {el.type === 'ball' ? (
        <mesh position={[0, 0.22, 0]}>
          <sphereGeometry args={[0.22, 16, 16]} />
          <meshStandardMaterial
            color={color}
            emissive={selected ? '#fff' : '#000'}
            emissiveIntensity={selected ? 0.2 : 0}
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

      {el.type === 'player' ? (
        <>
          <mesh position={[0, 0.55, 0]}>
            <capsuleGeometry args={[0.35, 0.55, 6, 12]} />
            <meshStandardMaterial
              color={color}
              emissive={selected ? '#fff' : '#000'}
              emissiveIntensity={selected ? 0.2 : 0}
            />
          </mesh>
          {el.number != null ? (
            <mesh position={[0, 1.35, 0]}>
              <sphereGeometry args={[0.12, 8, 8]} />
              <meshBasicMaterial color="#fff" />
            </mesh>
          ) : null}
        </>
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
}: {
  scene: DiagramScene
  selectedId?: string | null
  onSelect?: (id: string) => void
  onPointerDownElement?: (id: string, e: ThreeEvent<PointerEvent>) => void
  livePositions?: Record<string, { x: number; z: number; rotation?: number }>
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
        />
      ))}
    </>
  )
}
