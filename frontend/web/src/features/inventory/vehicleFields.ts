import type { Combustible, Transmision, Vehiculo } from './types'
import { EQUIPMENT_FIELDS, MATCHING_FIELDS, matchingValues, type MatchingField } from './matchingFields'

export const PHOTOS_MIN = 7
export const PHOTOS_MAX = 20

export type VehicleValues = {
  patente: string
  marca: string
  modelo: string
  version: string
  acara_version_id: string
  anio: string
  kilometraje: string
  precio: string
  transmision: Transmision | ''
  combustible: Combustible | ''
  carroceria_id: string
  ubicacion: string
  descripcion: string
} & Record<MatchingField, string>

export type VehicleFieldName = keyof VehicleValues
export type VehicleErrorKey = VehicleFieldName | 'fotos'
export type VehicleErrors = Partial<Record<VehicleErrorKey, string[]>>

// Order of the fields on screen: the first invalid one takes the focus.
export const FIELD_ORDER: VehicleErrorKey[] = [
  'patente',
  'marca',
  'modelo',
  'version',
  'anio',
  'kilometraje',
  'precio',
  'transmision',
  'combustible',
  'carroceria_id',
  'ubicacion',
  'descripcion',
  ...MATCHING_FIELDS,
  'fotos',
]

export const TRANSMISION_OPTIONS: { value: Transmision; label: string }[] = [
  { value: 'manual', label: 'Manual' },
  { value: 'automatica', label: 'Automática' },
]

export const COMBUSTIBLE_OPTIONS: { value: Combustible; label: string }[] = [
  { value: 'nafta', label: 'Nafta' },
  { value: 'diesel', label: 'Diésel' },
  { value: 'gnc', label: 'GNC' },
  { value: 'hibrido', label: 'Híbrido' },
  { value: 'electrico', label: 'Eléctrico' },
]

export function emptyValues(): VehicleValues {
  return {
    ...matchingValues(),
    potencia_unidad: 'CV',
    patente: '',
    marca: '',
    modelo: '',
    version: '',
    acara_version_id: '',
    anio: '',
    kilometraje: '',
    precio: '',
    transmision: '',
    combustible: '',
    carroceria_id: '',
    ubicacion: '',
    descripcion: '',
  }
}

export function valuesFromVehicle(vehicle: Vehiculo): VehicleValues {
  // NIST SP 811: mechanical HP = 745.6999 W; metric CV = 735.4988 W.
  // Keep the API's integer precision, without guessing a missing source unit.
  const wattsPerUnit = { CV: 735.4988, HP: 745.6999, kW: 1000 }
  const power = vehicle.potencia != null && vehicle.potencia_unidad
    && Object.hasOwn(wattsPerUnit, vehicle.potencia_unidad)
    ? String(Math.round(vehicle.potencia * (wattsPerUnit[vehicle.potencia_unidad] / wattsPerUnit.CV)))
    : ''
  return {
    ...matchingValues(vehicle),
    potencia: power,
    potencia_unidad: 'CV',
    patente: vehicle.patente,
    marca: vehicle.marca,
    modelo: vehicle.modelo,
    version: vehicle.version ?? '',
    acara_version_id: vehicle.acara_version_id ?? '',
    anio: String(vehicle.anio),
    kilometraje: String(vehicle.kilometraje),
    precio: String(vehicle.precio),
    transmision: vehicle.transmision,
    combustible: vehicle.combustible,
    carroceria_id: vehicle.carroceria ? String(vehicle.carroceria.id) : '',
    ubicacion: vehicle.ubicacion,
    descripcion: vehicle.descripcion ?? '',
  }
}

// Same normalization as the server: uppercase, without spaces, dashes or dots.
export function normalizePlate(plate: string): string {
  return plate.replace(/[\s.-]+/g, '').toUpperCase()
}

const PLATE_FORMAT = /^(?:[A-Z]{3}\d{3}|[A-Z]{2}\d{3}[A-Z]{2})$/
const PRICE_MAX = 9999999999.99

// Noun phrase of each text field and its maximum length, as in the server messages.
const TEXT_FIELDS: { name: 'marca' | 'modelo' | 'version' | 'ubicacion' | 'descripcion'; noun: string; max: number; optional?: true }[] = [
  { name: 'marca', noun: 'la marca', max: 100 },
  { name: 'modelo', noun: 'el modelo', max: 100 },
  { name: 'version', noun: 'la versión', max: 100, optional: true },
  { name: 'ubicacion', noun: 'la ubicación', max: 150 },
  { name: 'descripcion', noun: 'la descripción', max: 2000, optional: true },
]

const WHOLE = /^\d+$/

function numberError(value: string, noun: string, whole: boolean, min: number, max: number): string | undefined {
  if (value.trim() === '') return `Indicá ${noun}.`
  const text = value.trim()
  if (whole ? !WHOLE.test(text) : !/^\d+(?:[.,]\d{1,2})?$/.test(text)) {
    return `Revisá ${noun}: tiene que ser un número${whole ? ' entero' : ''}.`
  }
  const number = Number(text.replace(',', '.'))
  return number < min || number > max ? `Revisá ${noun}: está fuera del rango permitido.` : undefined
}

// Mirrors StoreVehiculoRequest / UpdateVehiculoRequest with the same wording; the server stays the authority.
// `photoCount` is the final number of photos: the kept ones plus the new ones.
export function validateVehicleForm(values: VehicleValues, photoCount: number, currentYear = new Date().getFullYear()): VehicleErrors {
  const errors: VehicleErrors = {}
  const fail = (key: VehicleErrorKey, message: string | undefined) => {
    if (message) errors[key] = [message]
  }

  const plate = normalizePlate(values.patente)
  if (plate === '') fail('patente', 'Indicá la patente.')
  else if (!PLATE_FORMAT.test(plate)) fail('patente', 'Ingresá una patente válida, por ejemplo AB123CD o ABC123.')

  for (const { name, noun, max, optional } of TEXT_FIELDS) {
    const value = values[name]
    if (value.trim() === '') {
      if (!optional) fail(name, `Indicá ${noun}.`)
    } else if (value.length > max) {
      fail(name, `Revisá ${noun}: no puede superar los ${max} caracteres.`)
    }
  }

  fail('anio', numberError(values.anio, 'el año', true, 1950, currentYear + 1))
  fail('kilometraje', numberError(values.kilometraje, 'el kilometraje', true, 0, 2000000))
  fail('precio', numberError(values.precio, 'el precio', false, 1, PRICE_MAX))

  if (values.transmision === '') fail('transmision', 'Elegí la transmisión.')
  if (values.combustible === '') fail('combustible', 'Elegí el combustible.')
  if (values.carroceria_id === '') fail('carroceria_id', 'Elegí la carrocería.')

  if (!['ARS', 'USD'].includes(values.moneda)) fail('moneda', 'Elegí pesos o dólares.')
  fail('plazas', numberError(values.plazas, 'las plazas', true, 1, 32767))
  if (!values.motor.trim() || values.motor.length > 100) fail('motor', 'Indicá el motor (hasta 100 caracteres).')
  fail('potencia', numberError(values.potencia, 'la potencia', true, 1, 2147483647))
  if (!['CV', 'HP', 'kW'].includes(values.potencia_unidad)) fail('potencia_unidad', 'Elegí la unidad de potencia.')
  for (const key of ['consumo_urbano', 'consumo_ruta'] as const) {
    if (values[key].trim() || ['nafta', 'diesel'].includes(values.combustible)) {
      fail(key, numberError(values[key], key === 'consumo_urbano' ? 'el consumo urbano' : 'el consumo en ruta', false, 0.01, 9999.99))
    }
  }
  for (const [key, label] of [['turbo', 'Turbo'], ...EQUIPMENT_FIELDS] as const) {
    if (!['0', '1'].includes(values[key])) fail(key, `Indicá sí o no en ${label}.`)
  }

  if (photoCount < PHOTOS_MIN) fail('fotos', 'Cargá al menos siete fotos.')
  else if (photoCount > PHOTOS_MAX) fail('fotos', `Podés cargar hasta ${PHOTOS_MAX} fotos.`)

  return errors
}

function isErrorKey(key: string): key is VehicleFieldName {
  return (FIELD_ORDER as string[]).includes(key) && key !== 'fotos'
}

// Maps the 422 body of Laravel: field names as they are; `fotos`, `fotos.N` and `fotos_eliminar.N` all land on the photo panel.
export function errorsFromServer(body: unknown): VehicleErrors {
  const errors: VehicleErrors = {}
  const raw = typeof body === 'object' && body !== null ? (body as { errors?: unknown }).errors : undefined
  if (typeof raw !== 'object' || raw === null) return errors

  for (const [key, messages] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(messages) || messages.length === 0) continue
    const target: VehicleErrorKey | undefined = key === 'acara_version_id' ? 'version' : key === 'potencia_unidad' ? 'potencia'
      : /^fotos(?:_eliminar)?(?:\.\d+)?$/.test(key) ? 'fotos' : isErrorKey(key) ? key : undefined
    if (!target) continue
    const merged = new Set([...(errors[target] ?? []), ...messages.filter((message): message is string => typeof message === 'string')])
    if (merged.size > 0) errors[target] = [...merged]
  }
  return errors
}

export function firstInvalidField(errors: VehicleErrors): VehicleErrorKey | undefined {
  return FIELD_ORDER.find((key) => errors[key] !== undefined)
}
