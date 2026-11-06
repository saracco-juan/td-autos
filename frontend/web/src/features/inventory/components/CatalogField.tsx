import SelectField from '../../auth/shared/components/SelectField'

type Props = {
  id: string
  name: string
  label: string
  value: string
  options: string[]
  errors?: string[]
  onChange: (value: string) => void
}

// A catalog identity can only be chosen from the currently filtered native options.
export default function CatalogField({ id, name, label, value, options, errors, onChange }: Props) {
  return <SelectField id={id} name={name} label={label} value={value}
    options={options.map((option) => ({ value: option, label: option }))} errors={errors} onChange={onChange} />
}
