import { validateEmail } from '../shared/validateEmail'
import { validateNewPassword } from '../shared/validateNewPassword'

export type DealerRegisterFormValues = {
  dealerName: string
  email: string
  name: string
  lastName: string
  dni: string
  contactPhone: string
  publicPhone: string
  address: string
  city: string
  province: string
  password: string
  passwordConfirmation: string
}

export type DealerRegisterField = keyof DealerRegisterFormValues

export type DealerRegisterErrors = Partial<Record<DealerRegisterField, string[]>>

// Same messages as the backend RegisterDealerRequest, so a field reads the same whoever rejects it.
const REQUIRED_MESSAGES = {
  dealerName: 'El nombre de la concesionaria es obligatorio.',
  name: 'El nombre es obligatorio.',
  lastName: 'El apellido es obligatorio.',
  dni: 'El DNI es obligatorio.',
  contactPhone: 'El teléfono del responsable es obligatorio.',
  publicPhone: 'El teléfono de la concesionaria es obligatorio.',
  address: 'La dirección es obligatoria.',
  city: 'La localidad es obligatoria.',
  province: 'La provincia es obligatoria.',
} satisfies Partial<Record<DealerRegisterField, string>>

// RF15 / TC-80: every field is required; the email and the password follow the buyer rules.
export function validateDealerRegisterForm(values: DealerRegisterFormValues): DealerRegisterErrors {
  const errors: DealerRegisterErrors = {}

  for (const [field, message] of Object.entries(REQUIRED_MESSAGES) as [keyof typeof REQUIRED_MESSAGES, string][]) {
    if (values[field].trim() === '') errors[field] = [message]
  }

  const emailErrors = validateEmail(values.email)
  if (emailErrors) errors.email = emailErrors

  return { ...errors, ...validateNewPassword(values.password, values.passwordConfirmation) }
}
