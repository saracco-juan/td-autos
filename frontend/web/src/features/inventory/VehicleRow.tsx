import { useEffect, useId, useRef } from 'react'
import { Link } from 'react-router'
import alertStyles from '../../components/alert.module.css'
import buttonStyles from '../../components/button.module.css'
import { vehicleMeta, vehicleTitle } from './format'
import styles from './VehicleRow.module.css'
import type { Vehiculo } from './types'

const CONFIRM_TEXT = '¿Eliminar este vehículo? Se borran sus fotos y no se puede deshacer.'
const DELETE_ERROR = 'No pudimos eliminar el vehículo. Probá de nuevo.'

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

// One vehicle (Figma 38:884 "Row"). ELIMINAR turns it into an inline confirmation (D4: Figma has none).
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
    <li className={styles.row} aria-labelledby={titleId}>
      <div className={styles.main}>
        <div className={styles.info}>
          <p id={titleId} className={styles.title}>
            {title}
          </p>
          <p className={styles.meta}>{vehicleMeta(vehicle)}</p>
        </div>
        {confirming ? null : (
          <div className={styles.actions}>
            <Link
              to={`/concesionaria/inventario/${vehicle.id}/editar`}
              aria-label={`Editar ${title}`}
              className={`${buttonStyles.button} ${buttonStyles.secondary} ${styles.edit}`}
            >
              EDITAR
            </Link>
            <button
              ref={askRef}
              type="button"
              aria-label={`Eliminar ${title}`}
              disabled={locked}
              className={`${buttonStyles.button} ${buttonStyles.danger} ${styles.delete}`}
              onClick={onAskDelete}
            >
              ELIMINAR
            </button>
          </div>
        )}
      </div>
      {confirming ? (
        <div className={styles.confirm}>
          <p className={alertStyles.warning}>{CONFIRM_TEXT}</p>
          {failed ? (
            <p role="alert" className={alertStyles.alert}>
              {DELETE_ERROR}
            </p>
          ) : null}
          <div className={styles.actions}>
            <button
              ref={confirmRef}
              type="button"
              disabled={deleting}
              aria-busy={deleting}
              className={`${buttonStyles.button} ${buttonStyles.danger} ${styles.delete}`}
              onClick={onConfirm}
            >
              ELIMINAR
            </button>
            <button
              type="button"
              disabled={deleting}
              className={`${buttonStyles.button} ${buttonStyles.secondary} ${styles.edit}`}
              onClick={onCancel}
            >
              CANCELAR
            </button>
          </div>
        </div>
      ) : null}
    </li>
  )
}
