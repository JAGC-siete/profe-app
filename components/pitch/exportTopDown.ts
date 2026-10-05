import { paintStrokes, type PitchStroke } from '../../lib/pitch'
import type { GlApi } from './PitchSceneCore'

/** Captura PNG/WebP desde el canvas WebGL (vista actual). */
export function capturePitchDataUrl(
  api: GlApi,
  mime: 'image/png' | 'image/webp' = 'image/webp',
  quality = 0.86
): string {
  const { gl, scene, camera } = api
  gl.render(scene, camera)
  return gl.domElement.toDataURL(mime, quality)
}

/** Compone WebGL + strokes 2D para el preview exportado. */
export async function capturePitchWithStrokes(
  api: GlApi,
  strokes: PitchStroke[],
  mime: 'image/png' | 'image/webp' = 'image/webp',
  quality = 0.86
): Promise<string> {
  const base = capturePitchDataUrl(api, 'image/png')
  if (!strokes.length) {
    if (mime === 'image/png') return base
    return encodeDataUrl(base, mime, quality)
  }

  const img = await loadImage(base)
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth || img.width
  canvas.height = img.naturalHeight || img.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return base
  ctx.drawImage(img, 0, 0)
  paintStrokes(ctx, strokes, canvas.width, canvas.height)
  return canvas.toDataURL(mime, quality)
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('No se pudo cargar captura'))
    img.src = src
  })
}

async function encodeDataUrl(
  pngDataUrl: string,
  mime: 'image/png' | 'image/webp',
  quality: number
): Promise<string> {
  if (mime === 'image/png') return pngDataUrl
  const img = await loadImage(pngDataUrl)
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth || img.width
  canvas.height = img.naturalHeight || img.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return pngDataUrl
  ctx.drawImage(img, 0, 0)
  return canvas.toDataURL(mime, quality)
}

export async function uploadPitchCapture(
  dataUrl: string,
  fileName = 'pitch-diagram.webp'
): Promise<string> {
  const contentType = dataUrl.startsWith('data:image/png')
    ? 'image/png'
    : 'image/webp'
  const res = await fetch('/api/entrenamientos/upload-diagram', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileBase64: dataUrl,
      fileName,
      contentType,
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Error al subir diagrama')
  return data.url as string
}
