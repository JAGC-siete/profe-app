'use client'

import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import { Plane, Raycaster, Vector2, Vector3 } from 'three'
import { worldToNorm, type PitchType } from '../../lib/pitch'
import { usePitchStore } from '../../lib/pitch/store'

/**
 * Pointer drag on the Y=0 plane (Xpendia-style).
 * Mount inside Canvas; assign beginDragRef for token pointerdown.
 */
export function TokenDragBridge({
  pitchType,
  onDraggingChange,
  beginDragRef,
}: {
  pitchType: PitchType
  onDraggingChange?: (dragging: boolean) => void
  beginDragRef: MutableRefObject<
    ((id: string, e: ThreeEvent<PointerEvent>) => void) | null
  >
}) {
  const moveSelected = usePitchStore((s) => s.moveSelected)
  const selectedId = usePitchStore((s) => s.selectedId)
  const dragging = useRef(false)
  const { camera, gl } = useThree()
  const plane = useMemo(() => new Plane(new Vector3(0, 1, 0), 0), [])
  const hit = useMemo(() => new Vector3(), [])
  const raycaster = useMemo(() => new Raycaster(), [])
  const ndc = useMemo(() => new Vector2(), [])

  useEffect(() => {
    const dom = gl.domElement
    const project = (clientX: number, clientY: number) => {
      const rect = dom.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return null
      ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1
      ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(ndc, camera)
      if (!raycaster.ray.intersectPlane(plane, hit)) return null
      return worldToNorm(hit.x, hit.z, pitchType)
    }

    const setDragging = (value: boolean) => {
      if (dragging.current === value) return
      dragging.current = value
      onDraggingChange?.(value)
    }

    const onMove = (e: PointerEvent) => {
      if (!dragging.current) return
      e.preventDefault()
      const pos = project(e.clientX, e.clientY)
      if (pos) moveSelected(pos.x, pos.z)
    }
    const onUp = () => setDragging(false)

    beginDragRef.current = (_id, e) => {
      setDragging(true)
      try {
        dom.setPointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
    }

    dom.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      beginDragRef.current = null
      dom.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [
    beginDragRef,
    camera,
    gl,
    moveSelected,
    ndc,
    onDraggingChange,
    pitchType,
    plane,
    hit,
    raycaster,
    selectedId,
  ])

  return null
}
