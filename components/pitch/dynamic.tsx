import dynamic from 'next/dynamic'
import type { ComponentType } from 'react'
import type { DiagramScene } from '../../lib/pitch'
import { isPitchV2Enabled } from '../../lib/pitch/flag'

type EditorProps = {
  initialScene?: DiagramScene | null
  onCancel: () => void
  onSave: (scene: DiagramScene, imageUrl: string) => void
}

type PlayerProps = { scene: DiagramScene }
type CanvasProps = { scene: DiagramScene; className?: string }

const DynamicPitchEditorV1 = dynamic(
  () => import('./PitchEditor').then((m) => m.PitchEditor),
  { ssr: false, loading: () => <PitchLoading label="Cargando editor 3D…" /> }
) as ComponentType<EditorProps>

const DynamicPitchEditorV2 = dynamic(
  () => import('./PitchEditorV2').then((m) => m.PitchEditorV2),
  { ssr: false, loading: () => <PitchLoading label="Cargando editor V2…" /> }
) as ComponentType<EditorProps>

/** Resuelve V1/V2 según NEXT_PUBLIC_PITCH_V2. */
export const DynamicPitchEditor = (
  isPitchV2Enabled() ? DynamicPitchEditorV2 : DynamicPitchEditorV1
) as ComponentType<EditorProps>

export const DynamicPitchPlayer = dynamic(
  () => import('./PitchPlayer').then((m) => m.PitchPlayer),
  { ssr: false, loading: () => <PitchLoading label="Cargando animación…" /> }
) as ComponentType<PlayerProps>

export const DynamicPitchCanvas = dynamic(
  () => import('./PitchCanvas').then((m) => m.PitchCanvas),
  { ssr: false, loading: () => <PitchLoading label="Cargando cancha…" /> }
) as ComponentType<CanvasProps>

function PitchLoading({ label }: { label: string }) {
  return (
    <div className="flex h-48 items-center justify-center rounded-lg border border-white/10 bg-black/40 text-sm text-white/60">
      {label}
    </div>
  )
}
