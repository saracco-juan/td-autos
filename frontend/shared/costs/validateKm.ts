// Mirrors VehiculoCostosRequest: an integer from 0 to 20.000 km per month, with the same messages.
export const KM_MIN_MESSAGE = 'Revisá los kilómetros: tienen que ser un número entero mayor o igual a 0.'
export const KM_MAX_MESSAGE = 'Revisá los kilómetros: el máximo es 20.000 por mes.'
const KM_MAX = 20000

export function validateKm(value: string): { km: number } | { error: string } {
  const text = value.trim()
  if (!/^\d+$/.test(text)) return { error: KM_MIN_MESSAGE }
  const km = Number(text)
  return km > KM_MAX ? { error: KM_MAX_MESSAGE } : { km }
}
