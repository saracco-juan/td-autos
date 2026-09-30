export type PasswordRuleId = 'min_length' | 'uppercase' | 'lowercase' | 'number'

type PasswordRule = {
  id: PasswordRuleId
  label: string
  message: string
  test(value: string): boolean
}

const MIN_LENGTH = 8

// Mirrors the backend App\Rules\StrongPassword: same ids, checks and messages.
// `label` is the short checklist text shown while typing.
export const PASSWORD_RULES: ReadonlyArray<PasswordRule> = [
  {
    id: 'min_length',
    label: 'Al menos 8 caracteres',
    message: 'La contraseña debe tener al menos 8 caracteres.',
    test: (value) => [...value].length >= MIN_LENGTH,
  },
  {
    id: 'uppercase',
    label: 'Una letra mayúscula',
    message: 'La contraseña debe incluir al menos una letra mayúscula.',
    test: (value) => /\p{Lu}/u.test(value),
  },
  {
    id: 'lowercase',
    label: 'Una letra minúscula',
    message: 'La contraseña debe incluir al menos una letra minúscula.',
    test: (value) => /\p{Ll}/u.test(value),
  },
  {
    id: 'number',
    label: 'Un número',
    message: 'La contraseña debe incluir al menos un número.',
    test: (value) => /[0-9]/.test(value),
  },
]

export function unmetPasswordRules(value: string): PasswordRuleId[] {
  return PASSWORD_RULES.filter((rule) => !rule.test(value)).map((rule) => rule.id)
}
