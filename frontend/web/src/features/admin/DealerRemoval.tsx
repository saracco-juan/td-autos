import { useEffect, useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import alertStyles from '../../components/alert.module.css'
import buttonStyles from '../../components/button.module.css'
import { HttpError } from '../../lib/http'
import adminStyles from './admin.module.css'
import { deleteDealer } from './api'
import styles from './DealerEditPage.module.css'
import type { DealerDetail } from './types'

const REMOVABLE_TEXT = 'Se borran la concesionaria, su cuenta y todos sus datos.'
const BLOCKED_REASON = 'No podés eliminarla mientras tenga la suscripción vigente.'
const CONFIRM_TEXT =
  '¿Eliminar esta concesionaria? Se borran sus vehículos, leads, suscripción y comprobantes, y su cuenta. No se puede deshacer.'
const CONFLICT = 'No podés eliminar una concesionaria con la suscripción vigente.'
const DELETE_ERROR = 'No pudimos eliminar la concesionaria. Probá de nuevo.'

// What the dealer list shows once it is back (DealersPage reads it from the navigation state).
export const REMOVED_NOTICE = 'Eliminaste la concesionaria.'

// A 409 says why the API refused (the subscription became current after the page loaded).
function conflictMessage(body: unknown): string {
  const message = (body as { message?: unknown } | undefined)?.message
  return typeof message === 'string' && message !== '' ? message : CONFLICT
}

// Delete section of the dealer page (UH28, RF34, RF35; Figma 2373:9206 has no delete action, see the feature document).
// ELIMINAR turns the section into an inline confirmation, as inventory rows do; it is disabled with the reason while
// the subscription is current.
export default function DealerRemoval({ dealer }: { dealer: DealerDetail }) {
  const titleId = useId()
  const reasonId = useId()
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const askRef = useRef<HTMLButtonElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const wasConfirming = useRef(false)
  const wasDeleting = useRef(false)

  // Focus follows the flow: into the confirmation when it opens (and again after a failed delete, since the busy
  // button was disabled), back to ELIMINAR when it is cancelled.
  useEffect(() => {
    if (confirming && (!wasConfirming.current || (wasDeleting.current && !deleting))) confirmRef.current?.focus()
    else if (!confirming && wasConfirming.current) askRef.current?.focus()
    wasConfirming.current = confirming
    wasDeleting.current = deleting
  }, [confirming, deleting])

  const backToList = () => void navigate('/admin/concesionarias', { state: { notice: REMOVED_NOTICE } })

  const confirmDelete = async () => {
    setFailure(null)
    setDeleting(true)
    try {
      await deleteDealer(dealer.id)
      backToList()
    } catch (error) {
      // A 404 means the dealer is already gone: the page was stale, not the delete.
      if (error instanceof HttpError && error.status === 404) {
        backToList()
        return
      }
      setFailure(error instanceof HttpError && error.status === 409 ? conflictMessage(error.body) : DELETE_ERROR)
      setDeleting(false)
    }
  }

  return (
    <section className={adminStyles.card} aria-labelledby={titleId}>
      <h2 id={titleId} className={adminStyles.cardTitle}>
        Eliminar concesionaria
      </h2>
      {confirming ? (
        <>
          <p className={alertStyles.warning}>{CONFIRM_TEXT}</p>
          {failure ? (
            <p role="alert" className={alertStyles.alert}>
              {failure}
            </p>
          ) : null}
          <div className={styles.removalActions}>
            <button
              ref={confirmRef}
              type="button"
              disabled={deleting}
              aria-busy={deleting}
              className={`${buttonStyles.button} ${buttonStyles.danger} ${styles.removalAction}`}
              onClick={() => void confirmDelete()}
            >
              {deleting ? 'ELIMINANDO…' : 'ELIMINAR'}
            </button>
            <button
              type="button"
              disabled={deleting}
              className={`${buttonStyles.button} ${styles.removalAction}`}
              onClick={() => {
                setFailure(null)
                setConfirming(false)
              }}
            >
              CANCELAR
            </button>
          </div>
        </>
      ) : (
        <>
          <p id={reasonId} className={adminStyles.cardBody}>
            {dealer.puede_eliminarse ? REMOVABLE_TEXT : BLOCKED_REASON}
          </p>
          <button
            ref={askRef}
            type="button"
            disabled={!dealer.puede_eliminarse}
            aria-describedby={reasonId}
            className={`${buttonStyles.button} ${buttonStyles.danger} ${styles.removalAction}`}
            onClick={() => setConfirming(true)}
          >
            ELIMINAR
          </button>
        </>
      )}
    </section>
  )
}
