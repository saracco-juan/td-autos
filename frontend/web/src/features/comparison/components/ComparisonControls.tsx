import Button from '../../../components/Buttons/Button'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { canCompare } from '@shared/comparison/selection'
import alertStyles from '../../../styles/alert.module.css'
import type { useComparisonSelection } from '../hooks/useComparisonSelection'
import styles from './ComparisonControls.module.css'

type SelectionVehicle = Readonly<{ id: number; title: string; label?: string; image?: string | null }>

type Props = Readonly<{
  selection: ReturnType<typeof useComparisonSelection>; source?: 'favorites'; vehicles?: readonly SelectionVehicle[]; className?: string
}>

export default function ComparisonControls({ selection, source, vehicles = [], className = '' }: Props) {
  const navigate = useNavigate()
  const { ids, search, toggle, notice, setNotice } = selection
  const [known, setKnown] = useState<SelectionVehicle[]>([])
  const selected = ids.map((id) => vehicles.find((vehicle) => vehicle.id === id) ?? known.find((vehicle) => vehicle.id === id))
  // Keep the selected identity when its card leaves the current page or filters.
  if (selected.some((vehicle) => vehicle && !known.some((previous) =>
    previous.id === vehicle.id && previous.title === vehicle.title && previous.label === vehicle.label && previous.image === vehicle.image))) {
    setKnown(selected.filter((vehicle): vehicle is SelectionVehicle => Boolean(vehicle)))
  }
  const slot = (index: number) => {
    const id = ids[index]
    const vehicle = selected[index] ?? known[index]
    const title = vehicle?.title ?? `${index === 0 ? 'Primer' : 'Segundo'} vehículo seleccionado`
    return <div className={styles.slot} data-open={id !== undefined} aria-hidden={id === undefined} inert={id === undefined}>
      <div className={styles.vehicle}>
        {vehicle?.image ? <img key={vehicle.image} className={styles.photo} src={vehicle.image} alt=""
          onError={(event) => { event.currentTarget.hidden = true }} /> : null}
        <span className={styles.name} title={title}>{vehicle?.label ?? title}</span>
        <button type="button" className={styles.remove} aria-label={`Quitar ${title} de la comparación`}
          onClick={() => { if (id !== undefined) toggle(id) }}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17" /></svg>
        </button>
      </div>
    </div>
  }
  return <section className={`${styles.selection} ${className}`} aria-label="Selección para comparar">
    <div className={styles.controls}>
      {slot(0)}
      <Button type="button" aria-label="COMPARAR" className={`${styles.compare}`} onClick={() => {
        if (canCompare(ids)) {
          const params = new URLSearchParams(search)
          if (source) params.set('source', source)
          navigate(`/comparar?${params}`)
        }
        else setNotice('Seleccioná exactamente dos vehículos para comparar.')
      }}>Comparar</Button>
      {slot(1)}
    </div>
    {notice ? <p role="alert" className={`${alertStyles.warning} ${styles.notice}`}>{notice}</p> : null}
  </section>
}
