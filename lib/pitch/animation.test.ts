/**
 * Lightweight assertions for normalizeAnimation (run via `npx tsx lib/pitch/animation.test.ts`
 * or rely on typecheck). Kept as executable smoke without Vitest.
 */
import {
  advancePlayback,
  elementSegmentT,
  hermiteEase,
  hasNormalizedAnimation,
  interpolateFrames,
  legacyStepsToFrames,
  liftBalls,
  linearEase,
  normalizeAnimation,
  passArcHeight,
  passPeakHeight,
  sampleNormalizedAnimation,
} from './animation'
import { arrowControlPoint, strokeHitsPoint } from './overlayGeometry'
import type { DiagramScene } from './types'

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg)
}

const baseScene: DiagramScene = {
  version: 1,
  pitch: { type: 'full_field', dimensions: [105, 68] },
  elements: [
    {
      id: 'p1',
      type: 'player',
      team: 'home',
      position: { x: 10, z: 10 },
    },
  ],
}

// keyframes
{
  const scene: DiagramScene = {
    ...baseScene,
    animation: {
      mode: 'keyframes',
      duration_per_frame: 2,
      frames: [
        { id: 'f0', positions: { p1: { x: 10, z: 10 } } },
        { id: 'f1', positions: { p1: { x: 80, z: 80 } } },
      ],
    },
  }
  const n = normalizeAnimation(scene)
  assert(n.frames.length === 2, 'keyframes length')
  assert(hasNormalizedAnimation(n), 'has anim')
}

// legacy steps → frames
{
  const scene: DiagramScene = {
    ...baseScene,
    animation: {
      duration_per_step: 2.5,
      steps: [
        {
          step: 1,
          actions: [
            {
              element_id: 'p1',
              action_type: 'run',
              path_type: 'linear',
              target_position: { x: 50, z: 50 },
            },
          ],
        },
      ],
    },
  }
  const anim = scene.animation
  if (!anim || !('steps' in anim)) throw new Error('expected legacy anim')
  const frames = legacyStepsToFrames(scene.elements, anim)
  assert(frames.length === 2, 'legacy → 2 frames')
  assert(frames[1].positions.p1.x === 50, 'legacy target')
  const n = normalizeAnimation(scene)
  assert(hasNormalizedAnimation(n), 'legacy normalized playable')
}

// interpolate
{
  const mid = interpolateFrames(
    { p1: { x: 0, z: 0 } },
    { p1: { x: 100, z: 100 } },
    0.5
  )
  assert(mid.p1.x === 50 && mid.p1.z === 50, 'midpoint')
}

// easing
{
  assert(hermiteEase(0, 0, 0) === 0 && hermiteEase(1, 0, 0) === 1, 'ease endpoints')
  assert(hermiteEase(0.5, 0, 0) === 0.5, 'ease symmetric midpoint')
  assert(hermiteEase(0.1, 0, 0) < 0.1 && hermiteEase(0.9, 0, 0) > 0.9, 'ease in-out')
  assert(Math.abs(hermiteEase(0.3, 1, 1) - 0.3) < 1e-12, 'v=1 is linear')
  for (const [v0, v1] of [[0, 1], [1, 0]]) {
    let prev = 0
    for (let k = 1; k <= 20; k++) {
      const y = hermiteEase(k / 20, v0, v1)
      assert(y >= prev - 1e-12, `monotonic ${v0}${v1}`)
      prev = y
    }
  }

  const two = {
    durationPerFrame: 2,
    frames: [
      { id: 'f0', positions: { p1: { x: 0, z: 0 } } },
      { id: 'f1', positions: { p1: { x: 100, z: 100 } } },
    ],
  }
  assert(sampleNormalizedAnimation(two, 0, 0.25).p1.x < 25, 'eased from/to rest')
  assert(sampleNormalizedAnimation(two, 0, 0.25, linearEase).p1.x === 25, 'linear sample')
  assert(sampleNormalizedAnimation(two, 0, 1).p1.x === 100, 'sample end')

  // Carrera continua 0 → 50 → 100: no se detiene en el keyframe intermedio.
  const run = {
    durationPerFrame: 2,
    frames: [
      { id: 'f0', positions: { p1: { x: 0, z: 0 }, c: { x: 5, z: 5 } } },
      { id: 'f1', positions: { p1: { x: 50, z: 0 }, c: { x: 5, z: 5 } } },
      { id: 'f2', positions: { p1: { x: 100, z: 0 }, c: { x: 5, z: 5 } } },
    ],
  }
  assert(elementSegmentT(run, 0, 'p1', 0.1) < 0.1, 'accelerates from rest')
  assert(elementSegmentT(run, 1, 'p1', 0.9) > 0.9, 'brakes into rest')
  assert(sampleNormalizedAnimation(run, 1, 0.1).p1.x > 53, 'keeps speed through keyframe')
  assert(sampleNormalizedAnimation(run, 0, 0.9).p1.x > 43, 'arrives at keyframe moving')
  assert(sampleNormalizedAnimation(run, 1, 0.5).c.x === 5, 'static element stays')
}

// playback cursor
{
  let c = advancePlayback({ frame: 0, t: 0 }, 1, 2, 3)
  assert(c.frame === 0 && c.t === 0.5 && !c.done, 'advance within frame')
  c = advancePlayback(c, 1.5, 2, 3)
  assert(c.frame === 1 && Math.abs(c.t - 0.25) < 1e-9 && !c.done, 'advance across frame')
  c = advancePlayback(c, 10, 2, 3)
  assert(c.done && c.frame === 1 && c.t === 1, 'advance to end')
  const atEnd = advancePlayback({ frame: 2, t: 0 }, 0.01, 2, 3)
  assert(atEnd.done, 'already at last frame')
}

// pass arc
{
  assert(passPeakHeight(8) === 0, 'short pass stays low')
  assert(passPeakHeight(40) > 0 && passPeakHeight(200) === 6, 'long pass lofts, capped')
  assert(passArcHeight(40, 0) === 0 && passArcHeight(40, 1) === 0, 'arc lands')
  assert(passArcHeight(40, 0.5) === passPeakHeight(40), 'arc peak at midpoint')
  const norm = {
    durationPerFrame: 2,
    frames: [
      { id: 'f0', positions: { b: { x: 50, z: 10 }, p1: { x: 0, z: 0 } } },
      { id: 'f1', positions: { b: { x: 50, z: 90 }, p1: { x: 0, z: 90 } } },
    ],
  }
  const pose = sampleNormalizedAnimation(norm, 0, 0.5)
  const lifted = liftBalls(pose, norm, 0, 0.5, new Set(['b']), 'full_field')
  assert((lifted.b.y ?? 0) > 0, 'ball lifted mid-pass')
  assert(lifted.p1.y === undefined, 'players stay on ground')
}

// overlay geometry
{
  const c = arrowControlPoint({ x: 0, y: 0 }, { x: 1, y: 0 }, 'convex')
  assert(typeof c.x === 'number' && typeof c.y === 'number', 'control point')
  const hit = strokeHitsPoint(
    {
      id: 's1',
      kind: 'arrow',
      color: '#F2D98A',
      width: 0.01,
      points: [
        { x: 0.1, y: 0.1 },
        { x: 0.9, y: 0.1 },
      ],
      curvature: 'flat',
    },
    0.5,
    0.1
  )
  assert(hit, 'arrow hit-test')
}

console.log('pitch animation tests OK')
