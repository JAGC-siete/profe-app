import { create } from 'zustand'
import {
  applyPositionsToElements,
  buildKeyframeAnimation,
  mergeElementPosition,
  normalizeAnimation,
  positionsFromElements,
} from './animation'
import { cloneScene, EMPTY_DIAGRAM_SCENE } from './defaults'
import { newElementId, pitchDimensions } from './coords'
import { nextSpawnPosition } from './spawn'
import { strokeHitsPoint } from './overlayGeometry'
import type {
  DiagramScene,
  DrawTool,
  KeyframePositions,
  PitchElement,
  PitchElementType,
  PitchKeyframe,
  PitchStroke,
  PitchTeam,
  PitchType,
  StrokeColor,
} from './types'
import {
  MAX_PITCH_ELEMENTS,
  MAX_PITCH_FRAMES,
  MAX_PITCH_STROKES,
} from './types'

type PitchStore = {
  pitchType: PitchType
  elements: PitchElement[]
  frames: PitchKeyframe[]
  frameIndex: number
  selectedId: string | null
  durationPerFrame: number
  playing: boolean
  strokes: PitchStroke[]
  drawTool: DrawTool
  strokeColor: StrokeColor
  initFromScene: (scene?: DiagramScene | null) => void
  setSelectedId: (id: string | null) => void
  setPlaying: (playing: boolean) => void
  setFrameIndex: (index: number) => void
  setDurationPerFrame: (n: number) => void
  setDrawTool: (tool: DrawTool) => void
  setStrokeColor: (color: StrokeColor) => void
  addStroke: (stroke: PitchStroke) => void
  eraseAt: (x: number, y: number) => void
  clearStrokes: () => void
  addElement: (type: PitchElementType, team?: PitchTeam) => void
  removeSelected: () => void
  moveSelected: (x: number, z: number) => void
  addFrame: () => void
  duplicateFrame: () => void
  deleteFrame: () => void
  toScene: () => DiagramScene
  currentPositions: () => KeyframePositions
}

function ensureFrames(elements: PitchElement[], frames: PitchKeyframe[]): PitchKeyframe[] {
  if (frames.length > 0) return frames
  return [{ id: 'f0', positions: positionsFromElements(elements) }]
}

export const usePitchStore = create<PitchStore>((set, get) => ({
  pitchType: 'half_field',
  elements: [],
  frames: [{ id: 'f0', positions: {} }],
  frameIndex: 0,
  selectedId: null,
  durationPerFrame: 2.5,
  playing: false,
  strokes: [],
  drawTool: 'none',
  strokeColor: '#F2D98A',

  initFromScene: (scene) => {
    const s = cloneScene(scene)
    const norm = normalizeAnimation(s)
    let frames = norm.frames
    if (frames.length === 0) {
      frames = [{ id: 'f0', positions: positionsFromElements(s.elements) }]
    } else {
      const base = positionsFromElements(s.elements)
      frames = frames.map((f) => ({
        ...f,
        positions: { ...base, ...f.positions },
      }))
    }
    set({
      pitchType: s.pitch.type,
      elements: s.elements,
      frames,
      frameIndex: 0,
      selectedId: null,
      durationPerFrame: norm.durationPerFrame || 2.5,
      playing: false,
      strokes: s.strokes ? structuredClone(s.strokes) : [],
      drawTool: 'none',
    })
  },

  setSelectedId: (id) => set({ selectedId: id }),
  setPlaying: (playing) => set({ playing }),
  setFrameIndex: (index) => {
    const { frames } = get()
    const i = Math.min(Math.max(0, index), Math.max(0, frames.length - 1))
    set({ frameIndex: i, playing: false })
  },
  setDurationPerFrame: (n) =>
    set({ durationPerFrame: Math.min(12, Math.max(0.3, n)) }),

  setDrawTool: (tool) =>
    set({
      drawTool: tool,
      selectedId: tool === 'none' ? get().selectedId : null,
    }),
  setStrokeColor: (color) => set({ strokeColor: color }),

  addStroke: (stroke) => {
    const { strokes } = get()
    if (strokes.length >= MAX_PITCH_STROKES) return
    set({ strokes: [...strokes, stroke] })
  },

  eraseAt: (x, y) => {
    const { strokes } = get()
    set({
      strokes: strokes.filter((s) => !strokeHitsPoint(s, x, y)),
    })
  },

  clearStrokes: () => set({ strokes: [] }),

  addElement: (type, team = 'home') => {
    const { elements, frames } = get()
    if (elements.length >= MAX_PITCH_ELEMENTS) return
    const position = nextSpawnPosition(elements.length)
    const el: PitchElement = {
      id: newElementId(type === 'player' ? 'p' : type[0]),
      type,
      team: type === 'player' ? team : 'neutral',
      number:
        type === 'player'
          ? elements.filter((e) => e.type === 'player').length + 1
          : undefined,
      color: type === 'cone' ? '#f97316' : undefined,
      position,
    }
    const nextElements = [...elements, el]
    const nextFrames = ensureFrames(nextElements, frames).map((f) => ({
      ...f,
      positions: {
        ...f.positions,
        [el.id]: { ...position },
      },
    }))
    set({
      elements: nextElements,
      frames: nextFrames,
      selectedId: el.id,
      drawTool: 'none',
    })
  },

  removeSelected: () => {
    const { selectedId, elements, frames } = get()
    if (!selectedId) return
    set({
      elements: elements.filter((e) => e.id !== selectedId),
      frames: frames.map((f) => {
        const { [selectedId]: _drop, ...rest } = f.positions
        return { ...f, positions: rest }
      }),
      selectedId: null,
    })
  },

  moveSelected: (x, z) => {
    const { selectedId, frameIndex, frames, elements, drawTool } = get()
    if (!selectedId || drawTool !== 'none') return
    const framesEnsured = ensureFrames(elements, frames)
    const nextFrames = framesEnsured.map((f, i) => {
      if (i !== frameIndex) return f
      return {
        ...f,
        positions: mergeElementPosition(f.positions, selectedId, { x, z }),
      }
    })
    let nextElements = elements
    if (frameIndex === 0) {
      nextElements = applyPositionsToElements(elements, nextFrames[0].positions)
    }
    set({ frames: nextFrames, elements: nextElements })
  },

  addFrame: () => {
    const { frames, frameIndex, elements } = get()
    if (frames.length >= MAX_PITCH_FRAMES) return
    const ensured = ensureFrames(elements, frames)
    const src = ensured[frameIndex] ?? ensured[ensured.length - 1]
    const copy: PitchKeyframe = {
      id: newElementId('f'),
      positions: { ...src.positions },
    }
    const next = [...ensured]
    next.splice(frameIndex + 1, 0, copy)
    set({ frames: next, frameIndex: frameIndex + 1, playing: false })
  },

  duplicateFrame: () => {
    get().addFrame()
  },

  deleteFrame: () => {
    const { frames, frameIndex } = get()
    if (frames.length <= 1) return
    const next = frames.filter((_, i) => i !== frameIndex)
    set({
      frames: next,
      frameIndex: Math.min(frameIndex, next.length - 1),
      playing: false,
    })
  },

  currentPositions: () => {
    const { frames, frameIndex, elements } = get()
    const ensured = ensureFrames(elements, frames)
    return ensured[frameIndex]?.positions ?? positionsFromElements(elements)
  },

  toScene: () => {
    const { pitchType, elements, frames, durationPerFrame, strokes } = get()
    const ensured = ensureFrames(elements, frames)
    const synced = applyPositionsToElements(elements, ensured[0].positions)
    const animation = buildKeyframeAnimation(ensured, durationPerFrame)
    const scene: DiagramScene = {
      ...EMPTY_DIAGRAM_SCENE,
      pitch: { type: pitchType, dimensions: pitchDimensions(pitchType) },
      elements: synced,
      animation,
      strokes: strokes.length > 0 ? strokes : undefined,
    }
    return scene
  },
}))
