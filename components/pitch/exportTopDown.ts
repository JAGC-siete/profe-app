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
