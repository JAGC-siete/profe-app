export type MaterialItem = { item: string; qty: number }

/** Parsea líneas tipo "* 12 tortugas" o "3 balones" → materiales. */
export function parseMaterialsText(text: string): MaterialItem[] {
  if (!text?.trim()) return []
  const out: MaterialItem[] = []
  for (const raw of text.split(/\n|;|,/)) {
    const line = raw.replace(/^[\s*•\-]+/, '').trim()
    if (!line) continue
    const m = line.match(/^(\d+)\s+(.+)$/)
    if (m) {
      out.push({ qty: Number(m[1]), item: m[2].trim().toLowerCase() })
    } else {
      out.push({ qty: 1, item: line.toLowerCase() })
    }
  }
  return out
}

export function aggregateMaterials(
  phases: Array<{ materials_json?: MaterialItem[] | null; variants_materials?: string }>
): MaterialItem[] {
  const map = new Map<string, number>()
  for (const phase of phases) {
    const items =
      Array.isArray(phase.materials_json) && phase.materials_json.length > 0
        ? phase.materials_json
        : parseMaterialsText(phase.variants_materials ?? '')
    for (const { item, qty } of items) {
      const key = item.trim().toLowerCase()
      if (!key) continue
      map.set(key, (map.get(key) ?? 0) + (Number(qty) || 0))
    }
  }
  return Array.from(map.entries())
    .map(([item, qty]) => ({ item, qty }))
    .sort((a, b) => a.item.localeCompare(b.item, 'es'))
}

export function totalDurationMinutes(
  phases: Array<{ duration_minutes?: number | null }>
): number {
  return phases.reduce((sum, p) => sum + (Number(p.duration_minutes) || 0), 0)
}
