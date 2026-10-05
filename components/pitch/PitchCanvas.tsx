'use client'

import type { DiagramScene } from '../../lib/pitch'
import { PitchCanvasShell, PitchSceneInner } from './PitchSceneCore'

export function PitchCanvas({
  scene,
  className = 'h-64 w-full',
}: {
  scene: DiagramScene
  className?: string
}) {
  return (
    <PitchCanvasShell className={className}>
      <PitchSceneInner scene={scene} />
    </PitchCanvasShell>
  )
}
