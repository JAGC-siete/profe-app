'use client'

import type { DiagramScene } from '../../lib/pitch'
import { PitchCanvasShell, PitchSceneInner } from './PitchSceneCore'
import { DrawingOverlay } from './DrawingOverlay'

export function PitchCanvas({
  scene,
  className = 'h-64 w-full',
}: {
  scene: DiagramScene
  className?: string
}) {
  return (
    <div className={`relative ${className}`}>
      <PitchCanvasShell className="h-full w-full">
        <PitchSceneInner scene={scene} />
      </PitchCanvasShell>
      <DrawingOverlay
        strokes={scene.strokes ?? []}
        tool="none"
        color="#F2D98A"
        interactive={false}
      />
    </div>
  )
}
