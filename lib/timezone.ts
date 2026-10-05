/**
 * Timezone helpers for America/Tegucigalpa (UTC-6, sin DST).
 * Solo utilidades usadas por Profe — sin lógica de asistencia RRHH.
 */

export const HONDURAS_TIMEZONE = 'America/Tegucigalpa'
export const HN_TZ = HONDURAS_TIMEZONE
export const TEGUCIGALPA_TZ = HONDURAS_TIMEZONE

/** YYYY-MM-DD del calendario en Honduras. */
export function getTodayInHonduras(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: HONDURAS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export function todayInHonduras(): string {
  return getTodayInHonduras()
}

/** Timestamp ISO con offset fijo -06:00 (Honduras). */
export function getHondurasTimestamp(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: HONDURAS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date())

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '00'

  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}-06:00`
}

/** Interpreta YYYY-MM-DD como mediodía Honduras (evita shift UTC). */
export function parseDateOnlyAsHonduras(dateStr: string): Date {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return new Date(NaN)
  }
  return new Date(`${dateStr}T12:00:00-06:00`)
}

/** Formatea YYYY-MM-DD para UI (es-HN). */
export function formatDateOnlyForHonduras(dateStr: string): string {
  const d = parseDateOnlyAsHonduras(dateStr)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('es-HN', {
    timeZone: HONDURAS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}
