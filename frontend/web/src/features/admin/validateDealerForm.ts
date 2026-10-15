import { validateEmail } from '../auth/shared/validateEmail'
import type { DealerFormField, DealerFormValues } from './types'

export type DealerFormErrors = Partial<Record<DealerFormField, string[]>>

const MAX_EMAIL = 255

// Subject, ending of "obligatori_" and max length of each text field: the same as the backend
// (App\Support\DealerFields and UpdateDealerRequest), so a field reads the same whoever rejects it.
const TEXT_FIELDS: Record<Exclude<DealerFormField, 'email'>, [subject: string, ending: 'o' | 'a', max: number]> = {
  nombre: ['El nombre de la concesionaria', 'o', 150],
  responsable_nombre: ['El nombre del responsable', 'o', 255],
  responsable_apellido: ['El apellido', 'o', 100],
  responsable_dni: ['El DNI', 'o', 20],
  telefono_responsable: ['El teléfono del responsable', 'o', 30],
  telefono_publico: ['El teléfono de la concesionaria', 'o', 30],
  direccion: ['La dirección', 'a', 255],
  localidad: ['La localidad', 'a', 100],
  provincia: ['La provincia', 'a', 100],
}

// RF32 / TC-69: every field is required and limited; the email also needs a valid format.
export function validateDealerForm(values: DealerFormValues): DealerFormErrors {
  const errors: DealerFormErrors = {}

  for (const [field, [subject, ending, max]] of Object.entries(TEXT_FIELDS) as [keyof typeof TEXT_FIELDS, (typeof TEXT_FIELDS)[keyof typeof TEXT_FIELDS]][]) {
    const length = values[field].trim().length
    if (length === 0) errors[field] = [`${subject} es obligatori${ending}.`]
    else if (length > max) errors[field] = [`${subject} no puede superar los ${max} caracteres.`]
  }

  const emailErrors = validateEmail(values.email)
  if (emailErrors) errors.email = emailErrors
  else if (values.email.trim().length > MAX_EMAIL) errors.email = [`El email no puede superar los ${MAX_EMAIL} caracteres.`]

  return errors
}
