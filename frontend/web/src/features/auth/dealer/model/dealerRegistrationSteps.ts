import type { DealerRegisterErrors, DealerRegisterField } from './validateDealerRegisterForm'

type RegistrationStep = { title: string; heading: string; fields: readonly DealerRegisterField[] }

export const DEALER_REGISTRATION_STEPS: readonly RegistrationStep[] = [
  { title: 'Concesionaria', heading: 'Datos de la concesionaria', fields: ['dealerName', 'publicPhone'] },
  { title: 'Ubicación', heading: '¿Dónde está tu concesionaria?', fields: ['address', 'city', 'province'] },
  { title: 'Responsable', heading: 'Datos de la persona responsable', fields: ['name', 'lastName', 'dni', 'contactPhone'] },
  { title: 'Cuenta', heading: 'Creá tu acceso', fields: ['email', 'password', 'passwordConfirmation'] },
]

export function firstInvalidDealerStep(errors: DealerRegisterErrors) {
  return DEALER_REGISTRATION_STEPS.findIndex((step) => step.fields.some((field) => errors[field]?.length))
}
