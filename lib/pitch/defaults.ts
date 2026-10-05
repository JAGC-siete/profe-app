import type { DiagramScene } from './types'

export const EMPTY_DIAGRAM_SCENE: DiagramScene = {
  version: 1,
  // Media cancha: mejor escala visual para drills U7–juveniles
  pitch: { type: 'half_field', dimensions: [52.5, 68] },
  elements: [],
  strokes: [],
}

export function cloneScene(scene?: DiagramScene | null): DiagramScene {
  if (!scene || scene.version !== 1) {
    return structuredClone(EMPTY_DIAGRAM_SCENE)
  }
  return structuredClone(scene)
}
