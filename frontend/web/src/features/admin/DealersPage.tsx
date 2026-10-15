import { Link } from 'react-router'
import buttonStyles from '../../components/button.module.css'
import ErrorState from '../../components/ErrorState'
import screenStyles from '../../components/screen.module.css'
import SessionLoading from '../auth/session/SessionLoading'
import styles from './admin.module.css'
import { accountState, dealerLocation, hasRejectedReceipt, receiptTarget } from './format'
import StateTag from './StateTag'
import type { AdminDealerRow } from './types'
import { useDealerDirectory } from './useDealerDirectory'

function registeredCount(count: number): string {
  return count === 1 ? '1 concesionaria registrada' : `${count} concesionarias registradas`
}

function DealerRow({ dealer }: { dealer: AdminDealerRow }) {
  const state = accountState(dealer.estado_alta, dealer.suscripcion_estado)
  const receiptId = receiptTarget(dealer)

  return (
    <tr>
      <th scope="row" className={styles.dealerName}>
        {dealer.nombre}
      </th>
      <td className={styles.muted}>{dealerLocation(dealer)}</td>
      <td className={styles.muted}>{dealer.contacto.email}</td>
      <td>
        <div className={styles.stateCell}>
          <span className={styles.state} data-tone={state.tone}>
            {state.label}
          </span>
          {state.tag ? <StateTag tag={state.tag} /> : null}
          {hasRejectedReceipt(dealer) ? <StateTag tag={{ label: 'Comprobante rechazado', tone: 'rejected' }} /> : null}
        </div>
      </td>
      <td>
        <div className={styles.actions}>
          <Link
            to={`/admin/concesionarias/${dealer.id}`}
            aria-label={`Editar ${dealer.nombre}`}
            className={`${buttonStyles.button} ${buttonStyles.secondary} ${styles.rowAction}`}
          >
            EDITAR
          </Link>
          {receiptId === null ? (
            <span className={styles.muted}>Sin comprobante</span>
          ) : (
            <Link
              to={`/admin/comprobantes/${receiptId}`}
              aria-label={`Ver comprobante de ${dealer.nombre}`}
              className={`${buttonStyles.button} ${buttonStyles.secondary} ${styles.rowAction}`}
            >
              VER COMPROBANTE
            </Link>
          )}
        </div>
      </td>
    </tr>
  )
}

// Dealer list (Figma 38:1037, UH19): dealers waiting for a review first, as the API orders them.
// EDITAR opens the dealer page (UH27).
export default function DealersPage() {
  const { state, retry } = useDealerDirectory()

  if (state === 'loading') return <SessionLoading />
  if ('error' in state) return <ErrorState kind={state.error} onRetry={retry} />

  const dealers = state.data.concesionarias

  return (
    <div className={screenStyles.page}>
      <div className={styles.header}>
        <p className={screenStyles.eyebrow}>ADMINISTRACIÓN</p>
        <h1 id="admin-dealers-title" className={screenStyles.title}>
          Concesionarias
        </h1>
        <p className={styles.subtitle}>{registeredCount(dealers.length)}</p>
      </div>
      {dealers.length === 0 ? (
        <p className={styles.empty}>Todavía no hay concesionarias registradas.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table} aria-labelledby="admin-dealers-title">
            <thead>
              <tr>
                <th scope="col">Concesionaria</th>
                <th scope="col">Localidad</th>
                <th scope="col">Contacto</th>
                <th scope="col">Estado</th>
                <th scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {dealers.map((dealer) => (
                <DealerRow key={dealer.id} dealer={dealer} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
