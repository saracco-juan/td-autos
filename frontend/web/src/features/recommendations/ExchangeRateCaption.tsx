import { formatPrice } from '@shared/recommendations/format'
import styles from './RecommendationsPage.module.css'

export default function ExchangeRateCaption({ quote }: {
  quote?: { sell: number; updated_at: string; source: string } | null
}) {
  if (!quote) return null
  return <p className={styles.exchangeRate} title={`Dólar oficial venta · ${quote.source}`}>
    Cotización USD: {formatPrice(quote.sell)} · Actualizada: {' '}
    <time dateTime={quote.updated_at}>{new Date(quote.updated_at).toLocaleDateString('es-AR')}</time>
  </p>
}
