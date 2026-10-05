'use client'

import { useMemo } from 'react'
import * as THREE from 'three'
import { pitchAspect } from '../../lib/pitch'
import type { PitchType } from '../../lib/pitch'

function drawPitchTexture(type: PitchType): THREE.CanvasTexture {
  const { width, length } = pitchAspect(type)
  const scale = 8
  const w = Math.round(width * scale)
  const h = Math.round(length * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return new THREE.CanvasTexture(canvas)
  }

  ctx.fillStyle = '#1f7a3a'
  ctx.fillRect(0, 0, w, h)
  // stripes
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#1f7a3a' : '#238a42'
    ctx.fillRect(0, (h / 12) * i, w, h / 12)
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.92)'
  ctx.lineWidth = Math.max(2, scale * 0.35)
  const pad = ctx.lineWidth * 2
  ctx.strokeRect(pad, pad, w - pad * 2, h - pad * 2)

  // halfway
  if (type === 'full_field') {
    ctx.beginPath()
    ctx.moveTo(pad, h / 2)
    ctx.lineTo(w - pad, h / 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(w / 2, h / 2, 9.15 * scale, 0, Math.PI * 2)
    ctx.stroke()
  }

  // penalty boxes (simplified, both ends)
  const boxW = 40.32 * scale
  const boxD = 16.5 * scale
  const boxX = (w - boxW) / 2
  if (type !== 'penalty_box') {
    ctx.strokeRect(boxX, pad, boxW, boxD)
    ctx.strokeRect(boxX, h - pad - boxD, boxW, boxD)
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

export function FieldPlane({ type }: { type: PitchType }) {
  const { width, length } = pitchAspect(type)
  const texture = useMemo(() => drawPitchTexture(type), [type])

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow={false}>
      <planeGeometry args={[width, length]} />
      <meshBasicMaterial map={texture} />
    </mesh>
  )
}
