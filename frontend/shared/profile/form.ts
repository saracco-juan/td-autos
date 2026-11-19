type Identity = { name: string; apellido: string | null }
export type ProfileValues = { name: string; apellido: string }
export type ProfileFieldName = keyof ProfileValues
export type ProfileFieldErrors = Partial<Record<ProfileFieldName, string[]>>

export function fullName(user: Identity | null | undefined): string {
  return [user?.name, user?.apellido].filter(Boolean).join(' ').trim()
}

export function profilePayload(name: string, user: Identity | null | undefined): ProfileValues {
  // Preserve legacy fields on unchanged saves, including names exceeding one field's limit.
  return name.trim() === fullName(user)
    ? { name: user?.name ?? '', apellido: user?.apellido ?? '' }
    : { name: name.trim(), apellido: '' }
}

export function validateProfileForm(values: ProfileValues): ProfileFieldErrors {
  const errors: ProfileFieldErrors = {}
  if (!values.name.trim()) errors.name = ['El nombre es obligatorio.']
  else if (values.name.trim().length > 255) errors.name = ['El nombre no puede superar los 255 caracteres.']
  if (values.apellido.trim().length > 100) errors.apellido = ['El apellido no puede superar los 100 caracteres.']
  return errors
}
