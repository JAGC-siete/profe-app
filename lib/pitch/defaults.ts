import type { DiagramScene } from './types'

export const EMPTY_DIAGRAM_SCENE: DiagramScene = {
  version: 1,
  pitch: { type: 'full_field', dimensions: [105, 68] },
  elements: [],
  strokes: [],
}

export function cloneScene(scene?: DiagramScene | null): DiagramScene {
  if (!scene || scene.version !== 1) {
    return structuredClone(EMPTY_DIAGRAM_SCENE)
  }
  return structuredClone(scene)
}
