// The neutral shape the checklist kit renders. Each feature maps its API item flag (`critico` in the
// inspection, `obligatorio` in the transfer) to `flagged` at its own boundary.
export type ChecklistItem = {
  codigo: string
  texto: string
  // The item carries the badge and is the one the warning before finishing is about.
  flagged: boolean
}

export type ChecklistStep = {
  numero: number
  titulo: string
  ayuda: string | null
  items: ChecklistItem[]
}
