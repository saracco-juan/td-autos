export type ProfileValues = {
  name: string
  apellido: string
}

export type ProfileFieldName = keyof ProfileValues

export type ProfileFieldErrors = Partial<Record<ProfileFieldName, string[]>>
