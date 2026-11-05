import { useEffect, useRef, useState } from 'react'
import Button from '../../../components/Buttons/Button'
import { HttpError } from '../../../lib/http'
import { fetchReceiptFile } from '../api/client'
import type { ReceiptHistoryEntry } from '../model/types'
import styles from './ReceiptHistory.module.css'

export default function ReceiptDownload({ receipt }: { receipt: ReceiptHistoryEntry }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const requestRef = useRef<{ cancelled: boolean; url?: string } | null>(null)
  useEffect(() => () => {
    const request = requestRef.current
    if (request) request.cancelled = true
    if (request?.url) URL.revokeObjectURL(request.url)
  }, [])

  const download = async () => {
    if (busy) return
    if (requestRef.current?.url) URL.revokeObjectURL(requestRef.current.url)
    const request = { cancelled: false, url: undefined as string | undefined }
    requestRef.current = request
    setBusy(true)
    setError('')
    try {
      const blob = await fetchReceiptFile(receipt.id)
      if (request.cancelled) return
      request.url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = request.url
      link.download = receipt.nombre_archivo
      link.click()
    } catch (failure) {
      if (!request.cancelled) setError(failure instanceof HttpError && failure.status === 404
        ? 'El archivo no está disponible. Contactá a la administración.'
        : 'No pudimos descargar el comprobante. Volvé a intentarlo.')
    } finally {
      if (!request.cancelled) setBusy(false)
    }
  }

  return <div className={styles.download}>
    <Button type="button" onClick={() => void download()} disabled={busy} aria-busy={busy}
      aria-label={`DESCARGAR ${receipt.nombre_archivo}`} className={styles.downloadButton}>DESCARGAR</Button>
    {error ? <p role="alert" className={styles.error}>{error}</p> : null}
  </div>
}

