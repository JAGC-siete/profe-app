/** Posición inicial para no apilar todos los tokens en el centro. */
export function nextSpawnPosition(existingCount: number): {
  x: number
  z: number
  rotation: number
} {
  const col = existingCount % 5
  const row = Math.floor(existingCount / 5) % 5
  return {
    x: 30 + col * 10,
    z: 35 + row * 8,
    rotation: 0,
  }
}
