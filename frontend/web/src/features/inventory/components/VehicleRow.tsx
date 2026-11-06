import { useEffect, useId, useRef } from 'react'
import Button from '../../../components/Buttons/Button'
import ButtonLink from '../../../components/Buttons/ButtonLink'
import alertStyles from '../../../styles/alert.module.css'
import tableStyles from '../../../styles/dataTable.module.css'
import { formatKilometers, formatPrice, vehicleTitle } from '../model/format'
import HoldToDeleteButton from './HoldToDeleteButton'
import styles from './VehicleRow.module.css'
import type { Vehiculo } from '../model/types'

type Props = {
  vehicle: Vehiculo
  deleting: boolean
  failed: boolean
  locked: boolean
  onDelete: () => Promise<void>
}

export default function VehicleRow({ vehicle, deleting, failed, locked, onDelete }: Props) {
  const titleId = useId()
  const title = vehicleTitle(vehicle)
  const deleteRef = useRef<HTMLButtonElement>(null)
  const wasDeleting = useRef(false)
  const deleteLabel = `Eliminar ${title}`

  useEffect(() => {
    if (failed || (wasDeleting.current && !deleting)) deleteRef.current?.focus()
    wasDeleting.current = deleting
  }, [deleting, failed])

  return (
    <tr aria-labelledby={titleId}>
      <th id={titleId} scope="row" className={`${tableStyles.strong} ${tableStyles.truncate}`} title={title}>
        {title}
      </th>
      <td className={`${tableStyles.muted} ${styles.colPlate}`}>{vehicle.patente}</td>
      <td className={`${tableStyles.muted} ${styles.colPhotos}`}>
        {vehicle.fotos.length} {vehicle.fotos.length === 1 ? 'imagen' : 'imágenes'}
      </td>
      <td className={tableStyles.muted}>{formatKilometers(vehicle.kilometraje)}</td>
      <td>{formatPrice(vehicle.precio, vehicle.moneda)}</td>
      <td className={`${tableStyles.muted} ${tableStyles.truncate} ${styles.colPlace}`} title={vehicle.ubicacion}>
        {vehicle.ubicacion}
      </td>
      <td>
        <div className={`${tableStyles.actions} ${styles.rowActions}`}>
          <ButtonLink to={`/concesionaria/inventario/${vehicle.id}/editar`} aria-label={`Editar ${title}`} variant="secondary">
            EDITAR
          </ButtonLink>
          {locked ? <Button ref={deleteRef} type="button" variant="danger" className={styles.deleteAction}
            aria-label={deleteLabel} disabled aria-busy={deleting}>
            {deleting ? 'ELIMINANDO…' : 'ELIMINAR'}
          </Button> : <HoldToDeleteButton buttonRef={deleteRef} ariaLabel={deleteLabel} onConfirm={onDelete} />}
        </div>
        {failed ? <p role="alert" className={`${alertStyles.alert} ${styles.deleteError}`}>
          No pudimos eliminar el vehículo. Probá de nuevo.
        </p> : null}
      </td>
    </tr>
  )
}
