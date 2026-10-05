import type { ArrowCurvature, PitchStroke } from './types'

/** Curvatura perpendicular del cuerpo (fracción de longitud). */
export const ARROW_BOW = 0.18

export function arrowControlPoint(
  start: { x: number; y: number },
  end: { x: number; y: number },
  curvature: ArrowCurvature = 'convex'
) {
  const factor =
    curvature === 'convex' ? ARROW_BOW : curvature === 'concave' ? -ARROW_BOW : 0
  const dx = end.x - start.x
  const dy = end.y - start.y
  const mx = (start.x + end.x) / 2
  const my = (start.y + end.y) / 2
  return { x: mx - dy * factor, y: my + dx * factor }
}

export function smoothPush(
  points: PitchStroke['points'],
  next: { x: number; y: number },
  factor = 0.45
): PitchStroke['points'] {
  const last = points[points.length - 1]
  if (!last) return [...points, next]
  return [
    ...points,
    {
      x: last.x + (next.x - last.x) * factor,
      y: last.y + (next.y - last.y) * factor,
    },
  ]
}

export function distPointToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
) {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return Math.hypot(px - ax, py - ay)
  let t = ((px - ax) * dx + (py - ay) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

/** Hit-test eraser en coords normalizadas [0..1]. */
export function strokeHitsPoint(
  stroke: PitchStroke,
  px: number,
  py: number,
  threshold = 0.03
): boolean {
  const pts = stroke.points
  if (pts.length < 2) {
    const p = pts[0]
    return p ? Math.hypot(px - p.x, py - p.y) <= threshold : false
  }
  if (stroke.kind === 'arrow') {
    const a = pts[0]
    const b = pts[pts.length - 1]
    const c = arrowControlPoint(a, b, stroke.curvature ?? 'convex')
    // Sample quadratic bezier
    for (let i = 0; i < 16; i++) {
      const t0 = i / 16
      const t1 = (i + 1) / 16
      const p0 = quad(a, c, b, t0)
      const p1 = quad(a, c, b, t1)
      if (distPointToSegment(px, py, p0.x, p0.y, p1.x, p1.y) <= threshold) {
        return true
      }
    }
    return false
  }
  for (let i = 0; i < pts.length - 1; i++) {
    if (
      distPointToSegment(
        px,
        py,
        pts[i].x,
        pts[i].y,
        pts[i + 1].x,
        pts[i + 1].y
      ) <= threshold
    ) {
      return true
    }
  }
  return false
}

function quad(
  a: { x: number; y: number },
  c: { x: number; y: number },
  b: { x: number; y: number },
  t: number
) {
  const u = 1 - t
  return {
    x: u * u * a.x + 2 * u * t * c.x + t * t * b.x,
    y: u * u * a.y + 2 * u * t * c.y + t * t * b.y,
  }
}

/** Dibuja strokes en un canvas 2D (coords normalizadas → px). */
export function paintStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: PitchStroke[],
  width: number,
  height: number,
  draft?: PitchStroke | null
) {
  const all = draft ? [...strokes, draft] : strokes
  for (const stroke of all) {
    ctx.strokeStyle = stroke.color
    ctx.fillStyle = stroke.color
    ctx.lineWidth = Math.max(2, stroke.width * Math.min(width, height))
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    if (stroke.kind === 'arrow' && stroke.points.length >= 2) {
      const a = stroke.points[0]
      const b = stroke.points[stroke.points.length - 1]
      const c = arrowControlPoint(a, b, stroke.curvature ?? 'convex')
      const ax = a.x * width
      const ay = a.y * height
      const bx = b.x * width
      const by = b.y * height
      const cx = c.x * width
      const cy = c.y * height
      ctx.beginPath()
      ctx.moveTo(ax, ay)
      ctx.quadraticCurveTo(cx, cy, bx, by)
      ctx.stroke()
      // arrow head
      const angle = Math.atan2(by - cy, bx - cx)
      const head = Math.max(8, ctx.lineWidth * 3)
      ctx.beginPath()
      ctx.moveTo(bx, by)
      ctx.lineTo(
        bx - head * Math.cos(angle - 0.4),
        by - head * Math.sin(angle - 0.4)
      )
      ctx.lineTo(
        bx - head * Math.cos(angle + 0.4),
        by - head * Math.sin(angle + 0.4)
      )
      ctx.closePath()
      ctx.fill()
    } else if (stroke.points.length >= 2) {
      ctx.beginPath()
      ctx.moveTo(stroke.points[0].x * width, stroke.points[0].y * height)
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x * width, stroke.points[i].y * height)
      }
      ctx.stroke()
    }
  }
}
