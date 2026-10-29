import {
  PORTAL_CREDITS_SOURCE, PORTAL_CREDITS_SUMMARY, PORTAL_EMPTY_COPY, PORTAL_MODELS_NOTICE, portalPhotoCredit,
  portalSourceLabel,
} from '@shared/portals/format'
import { emptyStateCopy, exchangeRateNotice } from '@shared/recommendations/format'
import alertStyles from '../../components/alert.module.css'
import ErrorState from '../../components/ErrorState'
import ScrollArea from '../../components/ScrollArea'
import SessionLoading from '../auth/session/SessionLoading'
import PortalModelCard from './PortalModelCard'
import type { PortalModelsView } from './portalModels'
import pageStyles from './RecommendationsPage.module.css'
import styles from './PortalModels.module.css'

// The "Otros portales" tab: the loader and the errors live inside this panel, the page header stays in place.
export default function PortalModelsPanel({ view, onRetry }: { view: PortalModelsView; onRetry: () => void }) {
  if (view.status === 'loading') return <div className={styles.panel}><SessionLoading /></div>
  if (view.status === 'error') return <div className={styles.panel}><ErrorState kind={view.kind} onRetry={onRetry} /></div>

  const { response } = view
  const empty = response.status === 'ready' ? PORTAL_EMPTY_COPY : emptyStateCopy(response.status, false)
  if (response.modelos.length === 0) {
    return (
      <div className={styles.panel}>
        <div className={pageStyles.empty}>
          <p className={pageStyles.emptyTitle} role="status">{empty.title}</p>
          <p className={pageStyles.emptyHint}>{empty.hint}</p>
        </div>
      </div>
    )
  }

  // Present only when a returned model used a converted USD price; absent means nothing to explain.
  const notice = response.exchange_rate ? exchangeRateNotice(response.exchange_rate) : { summary: null, warning: null }
  const credited = response.modelos.flatMap((model) => (model.imagen ? [{ model, photo: model.imagen }] : []))
  return (
    <div className={styles.panel}>
      <p className={`${alertStyles.notice} ${styles.message}`}>{PORTAL_MODELS_NOTICE}</p>
      <ScrollArea fill label="Modelos recomendados" className={styles.frame} viewportClassName={pageStyles.gridArea}>
        <ul className={`${pageStyles.grid} ${styles.grid}`} aria-label="Modelos en otros portales">
          {response.modelos.map((model) => <PortalModelCard key={model.id} model={model} />)}
        </ul>
      </ScrollArea>
      <div className={pageStyles.notice}>
        {response.fuente_precios ? <p>{portalSourceLabel(response.fuente_precios)}</p> : null}
        {notice.summary ? <p>{notice.summary}</p> : null}
        {notice.warning ? <p role="status" className={alertStyles.warning}>{notice.warning}</p> : null}
        {credited.length > 0 ? (
          <details className={styles.credits}>
            <summary>{PORTAL_CREDITS_SUMMARY}</summary>
            <p>{PORTAL_CREDITS_SOURCE}</p>
            <ul>
              {credited.map(({ model, photo }) => (
                <li key={model.id}>
                  <a href={photo.pagina} target="_blank" rel="noopener noreferrer">{portalPhotoCredit(model, photo)}</a>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </div>
  )
}
