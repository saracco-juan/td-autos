export const profileSections = [
  { title: 'Contacto y ubicación', fields: [
    { name: 'telefono_publico', label: 'Teléfono público / WhatsApp', type: 'tel', autoComplete: 'section-dealer tel', hint: 'Incluí el código de país. Si lo dejás vacío, los compradores no podrán contactarte por WhatsApp.' },
    { name: 'direccion', label: 'Dirección', type: 'text', autoComplete: 'section-dealer street-address' },
    { name: 'localidad', label: 'Localidad', type: 'text', autoComplete: 'section-dealer address-level2' },
    { name: 'provincia', label: 'Provincia', type: 'text', autoComplete: 'section-dealer address-level1' },
  ] },
  { title: 'Persona responsable', fields: [
    { name: 'responsable_nombre', label: 'Nombre del responsable', type: 'text', autoComplete: 'section-responsible given-name' },
    { name: 'responsable_apellido', label: 'Apellido del responsable', type: 'text', autoComplete: 'section-responsible family-name' },
    { name: 'responsable_dni', label: 'DNI del responsable', type: 'text', inputMode: 'numeric', autoComplete: 'off' },
    { name: 'telefono_responsable', label: 'Teléfono del responsable', type: 'tel', autoComplete: 'section-responsible tel' },
  ] },
] as const

export type DealerProfileField = (typeof profileSections)[number]['fields'][number]['name']
export type DealerProfileValues = Record<DealerProfileField, string>
export type DealerProfile = { nombre: string; email: string } & Record<DealerProfileField, string | null>
export type DealerProfileErrors = Partial<Record<DealerProfileField, string[]>>
export const editableFields = profileSections.flatMap((section) => section.fields.map((field) => field.name))

export function profileValues(profile: DealerProfile): DealerProfileValues {
  return Object.fromEntries(editableFields.map((field) => [field, profile[field] ?? ''])) as DealerProfileValues
}
