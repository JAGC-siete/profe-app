'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  newElementId,
  paintStrokes,
  type DrawTool,
  type PitchStroke,
  type StrokeColor,
} from '../../lib/pitch'

type Props = {
  strokes: PitchStroke[]
  tool: DrawTool
  color: StrokeColor
  interactive?: boolean
  onAddStroke?: (stroke: PitchStroke) => void
  onEraseAt?: (x: number, y: number) => void
  className?: string
}

function normFromEvent(
  e: PointerEvent | React.PointerEvent,
  el: HTMLCanvasElement
) {
  const rect = el.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null
  return {
    x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
    y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
  }
}

/** Canvas 2D encima del WebGL. tool=none no captura puntero. */
export function DrawingOverlay({
  strokes,
  tool,
  color,
  interactive = true,
  onAddStroke,
  onEraseAt,
  className = '',
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [draft, setDraft] = useState<PitchStroke | null>(null)
  const drawing = useRef(false)

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const parent = canvas.parentElement
    if (!parent) return
    const w = parent.clientWidth
    const h = parent.clientHeight
    if (w <= 0 || h <= 0) return
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    paintStrokes(ctx, strokes, w, h, draft)
  }, [strokes, draft])

  useEffect(() => {
    redraw()
    const parent = canvasRef.current?.parentElement
    if (!parent || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => redraw())
    ro.observe(parent)
    return () => ro.disconnect()
  }, [redraw])

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!interactive || tool === 'none' || !onAddStroke) return
    const canvas = canvasRef.current
    if (!canvas) return
    const p = normFromEvent(e, canvas)
    if (!p) return
    e.preventDefault()
    canvas.setPointerCapture(e.pointerId)
    drawing.current = true

    if (tool === 'eraser') {
      onEraseAt?.(p.x, p.y)
      return
    }

    setDraft({
      id: newElementId('s'),
      kind: 'arrow',
      color,
      width: 0.006,
      points: [p, p],
      curvature: 'convex',
    })
  }

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !interactive) return
    const canvas = canvasRef.current
    if (!canvas) return
    const p = normFromEvent(e, canvas)
    if (!p) return

    if (tool === 'eraser') {
      onEraseAt?.(p.x, p.y)
      return
    }

    setDraft((d) => {
      if (!d) return d
      return {
        ...d,
        points: [d.points[0], p],
      }
    })
  }

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return
    drawing.current = false
    if (tool === 'eraser') return
    const canvas = canvasRef.current
    if (!canvas || !onAddStroke) {
      setDraft(null)
      return
    }
    const p = normFromEvent(e, canvas)
    setDraft((d) => {
      if (!d) return null
      const end = p ?? d.points[d.points.length - 1]
      const start = d.points[0]
      const dist = Math.hypot(end.x - start.x, end.y - start.y)
      if (dist < 0.02) return null
      onAddStroke({
        ...d,
        points: [start, end],
      })
      return null
    })
  }

  const pointerActive = interactive && tool !== 'none'

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 h-full w-full ${className}`}
      style={{
        pointerEvents: pointerActive ? 'auto' : 'none',
        touchAction: 'none',
        zIndex: 2,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        drawing.current = false
        setDraft(null)
      }}
    />
  )
}
