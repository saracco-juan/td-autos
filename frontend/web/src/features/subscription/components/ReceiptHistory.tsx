import { useEffect, useState } from 'react'
import Button from '../../../components/Buttons/Button'
import ResultsPagination from '../../../components/Pagination/ResultsPagination'
import ScrollArea from '../../../components/ScrollArea/ScrollArea'
import usePagedItems from '../../../hooks/usePagedItems'
import { formatDay, receiptState, receiptTone } from '../../admin/model/format'
import { fetchReceipts } from '../api/client'
import { formatSentDate } from '../model/format'
import type { ReceiptHistoryEntry } from '../model/types'
import ReceiptActions from './ReceiptActions'
import styles from './ReceiptHistory.module.css'

export default function ReceiptHistory({ revision }: { revision: number | null }) {
  const [items, setItems] = useState<ReceiptHistoryEntry[]>([])
  const [load, setLoad] = useState<'loading' | 'ready' | 'error'>('loading')
  const [retry, setRetry] = useState(0)
  const [size, setSize] = useState(10)
  const { page, lastPage, setPage, pageItems } = usePagedItems(items, size)

  useEffect(() => {
    let cancelled = false
    fetchReceipts().then((receipts) => {
      if (!cancelled) {
        setItems(receipts)
        setPage(1)
        setLoad('ready')
      }
    }).catch(() => { if (!cancelled) setLoad('error') })
    return () => { cancelled = true }
  }, [revision, retry, setPage])

  return <section aria-labelledby="receipt-history-title" className={styles.history}>
    <div className={styles.heading}>
      <h2 id="receipt-history-title">Historial de comprobantes</h2>
      {load === 'ready' ? <span>{items.length} {items.length === 1 ? 'comprobante' : 'comprobantes'}</span> : null}
    </div>
    {load === 'loading' ? <p role="status">Cargando comprobantes…</p> : null}
    {load === 'error' ? <div className={styles.failure}>
      <p role="alert">No pudimos cargar el historial. Podés seguir gestionando tu suscripción.</p>
      <Button type="button" onClick={() => { setLoad('loading'); setRetry(retry + 1) }}>REINTENTAR HISTORIAL</Button>
    </div> : null}
    {load === 'ready' && items.length === 0 ? <div className={styles.empty}>
      <p>Todavía no enviaste comprobantes.</p>
      <p>Cuando envíes el primero, aparecerá acá junto con su estado de revisión.</p>
    </div> : null}
    {load === 'ready' && items.length > 0 ? <>
      <ScrollArea label="Comprobantes enviados" fill className={styles.listFrame}>
        <ul className={styles.list}>
          {pageItems.map((receipt) => <li key={receipt.id} className={styles.row}>
            <svg className={styles.fileIcon} width="22" height="26" viewBox="0 0 24 28" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M5 2h9l5 5v18H5zM14 2v6h5M8 13h8M8 17h8M8 21h5" />
            </svg>
            <div className={styles.info}>
              <span className={styles.name}>{receipt.nombre_archivo}</span>
              <span>Período: {formatDay(receipt.periodo_desde)} al {formatDay(receipt.periodo_hasta)}</span>
              {receipt.estado === 'rechazado' && receipt.motivo_rechazo
                ? <span className={styles.reason}>Motivo: {receipt.motivo_rechazo}</span> : null}
            </div>
            <div className={styles.review}>
              <span className={styles.state} data-tone={receiptTone(receipt.estado)}>{receiptState(receipt.estado)}</span>
              {receipt.enviado_en ? <span>Enviado el {formatSentDate(receipt.enviado_en)}</span> : null}
              {receipt.fecha_revision ? <span>Revisado el {formatSentDate(receipt.fecha_revision)}</span> : null}
            </div>
            <ReceiptActions receipt={receipt} />
          </li>)}
        </ul>
      </ScrollArea>
      <ResultsPagination page={page} lastPage={lastPage} onChange={setPage} pageSize={size}
        onPageSizeChange={(next) => { setSize(next); setPage(1) }} />
    </> : null}
  </section>
}
