/**
 * Lightweight assertions for normalizeAnimation (run via `npx tsx lib/pitch/animation.test.ts`
 * or rely on typecheck). Kept as executable smoke without Vitest.
 */
import {
  hasNormalizedAnimation,
  interpolateFrames,
  legacyStepsToFrames,
  normalizeAnimation,
} from './animation'
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

console.log('pitch animation tests OK')
