export interface ProfeCategory {
  id: string
  name: string
  sort_order: number
  is_active: boolean
}

export async function fetchActiveCategories(): Promise<ProfeCategory[]> {
  const res = await fetch('/api/categories')
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'No se pudieron cargar categorías')
  return (data.categories ?? []) as ProfeCategory[]
}

/** Ordena claves de categoría usando sort_order conocido; el resto alfabético. */
export function sortCategoryKeys(
  keys: string[],
  catalog: ProfeCategory[]
): string[] {
  const order = new Map(catalog.map((c) => [c.name, c.sort_order]))
  return [...keys].sort((a, b) => {
    const ao = order.get(a)
    const bo = order.get(b)
    if (ao != null && bo != null) return ao - bo
    if (ao != null) return -1
    if (bo != null) return 1
    return a.localeCompare(b)
  })
}
