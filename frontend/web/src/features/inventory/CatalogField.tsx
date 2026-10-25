import Field from '../auth/shared/Field'

type Props = {
  id: string
  name: string
  label: string
  value: string
  options: string[]
  errors?: string[]
  onChange: (value: string) => void
}

// Native searchable suggestions; selecting an identity is still enforced by client and server.
export default function CatalogField({ id, name, label, value, options, errors, onChange }: Props) {
  return (
    <Field id={id} label={label} errors={errors}>
      {(control) => <>
        <input {...control} name={name} autoComplete="off" list={`${id}-options`} value={value}
          onChange={(event) => onChange(event.target.value)} />
        <datalist id={`${id}-options`}>
          {options.map((option) => <option key={option} value={option} />)}
        </datalist>
      </>}
    </Field>
  )
}
