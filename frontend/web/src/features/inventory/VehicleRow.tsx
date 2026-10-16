import { useEffect, useId, useRef } from 'react'
import { Link } from 'react-router'
import alertStyles from '../../components/alert.module.css'
import groupStyles from '../../components/buttonGroup.module.css'
import tableStyles from '../../components/dataTable.module.css'
import { formatKilometers, formatPrice, vehicleTitle } from './format'
import styles from './VehicleRow.module.css'
import type { Vehiculo } from './types'

const CONFIRM_TEXT = '¿Eliminar este vehículo? Se borran sus fotos y no se puede deshacer.'
const DELETE_ERROR = 'No pudimos eliminar el vehículo. Probá de nuevo.'

// Cells after the row header: the confirmation spans all of them.
const DATA_COLUMNS = 6

type Props = {
  vehicle: Vehiculo
  confirming: boolean
  deleting: boolean
  failed: boolean
  // Another row is being deleted: this one cannot ask for its own delete meanwhile.
  locked: boolean
  onAskDelete: () => void
  onCancel: () => void
  onConfirm: () => void
}

function photoCount(count: number): string {
  return `${count} ${count === 1 ? 'imagen' : 'imágenes'}`
}

// One vehicle as a table row (Figma 38:884 "Row" content, admin table look). ELIMINAR turns the rest of the row into an
// inline confirmation (D4: Figma has none). The hideable cells carry their column class, so narrow screens drop them.
export default function VehicleRow({ vehicle, confirming, deleting, failed, locked, onAskDelete, onCancel, onConfirm }: Props) {
  const titleId = useId()
  const title = vehicleTitle(vehicle)
  const askRef = useRef<HTMLButtonElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const wasConfirming = useRef(false)
  const wasDeleting = useRef(false)

  // Focus follows the flow: into the confirmation when it opens (and again after a failed delete, since the
  // busy button was disabled), back to the row's ELIMINAR when it is cancelled.
  useEffect(() => {
    if (confirming && (!wasConfirming.current || (wasDeleting.current && !deleting))) confirmRef.current?.focus()
    else if (!confirming && wasConfirming.current) askRef.current?.focus()
    wasConfirming.current = confirming
    wasDeleting.current = deleting
  }, [confirming, deleting])

  return (
    <tr aria-labelledby={titleId}>
      <th id={titleId} scope="row" className={`${tableStyles.strong} ${tableStyles.truncate}`} title={title}>
        {title}
      </th>
      {confirming ? (
        <td colSpan={DATA_COLUMNS} className={styles.confirmCell}>
          <div className={styles.confirm}>
            <p className={alertStyles.warning}>{CONFIRM_TEXT}</p>
            {failed ? (
              <p role="alert" className={alertStyles.alert}>
                {DELETE_ERROR}
              </p>
            ) : null}
            <div className={tableStyles.actions}>
              <span className={groupStyles.group}>
                <button
                  ref={confirmRef}
                  type="button"
                  disabled={deleting}
                  aria-busy={deleting}
                  className={`${groupStyles.item} ${groupStyles.danger}`}
                  onClick={onConfirm}
                >
                  ELIMINAR
                </button>
              </span>
              <span className={groupStyles.group}>
                <button type="button" disabled={deleting} className={groupStyles.item} onClick={onCancel}>
                  CANCELAR
                </button>
              </span>
            </div>
          </div>
        </td>
      ) : (
        <>
          <td className={`${tableStyles.muted} ${styles.colPlate}`}>{vehicle.patente}</td>
          <td className={`${tableStyles.muted} ${styles.colPhotos}`}>{photoCount(vehicle.fotos.length)}</td>
          <td className={tableStyles.muted}>{formatKilometers(vehicle.kilometraje)}</td>
          <td>{formatPrice(vehicle.precio)}</td>
          <td className={`${tableStyles.muted} ${tableStyles.truncate} ${styles.colPlace}`} title={vehicle.ubicacion}>
            {vehicle.ubicacion}
          </td>
          <td>
            <div className={tableStyles.actions}>
              <span className={groupStyles.group}>
                <Link
                  to={`/concesionaria/inventario/${vehicle.id}/editar`}
                  aria-label={`Editar ${title}`}
                  className={groupStyles.item}
                >
                  EDITAR
                </Link>
              </span>
              <span className={groupStyles.group}>
                <button
                  ref={askRef}
                  type="button"
                  aria-label={`Eliminar ${title}`}
                  disabled={locked}
                  className={`${groupStyles.item} ${groupStyles.danger}`}
                  onClick={onAskDelete}
                >
                  ELIMINAR
                </button>
              </span>
            </div>
          </td>
        </>
      )}
    </tr>
  )
}
