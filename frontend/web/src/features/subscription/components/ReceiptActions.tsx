import { useEffect, useRef, useState } from 'react'
import Button from '../../../components/Buttons/Button'
import Dialog from '../../../components/Dialog/Dialog'
import { HttpError } from '../../../lib/http'
import { fetchReceiptFile } from '../api/client'
import type { ReceiptHistoryEntry } from '../model/types'
import styles from './ReceiptHistory.module.css'

export default function ReceiptActions({ receipt }: { receipt: ReceiptHistoryEntry }) {
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<{ url: string; type: string } | null>(null)
  const [error, setError] = useState('')
  const previewButton = useRef<HTMLButtonElement>(null)
  const requestRef = useRef<{ cancelled: boolean; url?: string } | null>(null)
  useEffect(() => () => {
    const request = requestRef.current
    if (request) request.cancelled = true
    if (request?.url) URL.revokeObjectURL(request.url)
  }, [])

  const openFile = async (action: 'download' | 'preview') => {
    if (busy) return
    if (requestRef.current?.url) URL.revokeObjectURL(requestRef.current.url)
    const request = { cancelled: false, url: undefined as string | undefined }
    requestRef.current = request
    setBusy(true)
    setError('')
    try {
      const blob = await fetchReceiptFile(receipt.id)
      if (request.cancelled) return
      if (action === 'preview' && !['image/jpeg', 'image/png', 'application/pdf'].includes(blob.type)) {
        setError('Este archivo no se puede previsualizar. Podés descargarlo para abrirlo.')
        return
      }
      request.url = URL.createObjectURL(blob)
      if (action === 'preview') {
        setPreview({ url: request.url, type: blob.type })
        return
      }
      const link = document.createElement('a')
      link.href = request.url
      link.download = receipt.nombre_archivo
      link.click()
    } catch (failure) {
      if (!request.cancelled) setError(failure instanceof HttpError && failure.status === 404
        ? 'El archivo no está disponible. Contactá a la administración.'
        : `No pudimos ${action === 'preview' ? 'previsualizar' : 'descargar'} el comprobante. Volvé a intentarlo.`)
    } finally {
      if (!request.cancelled) setBusy(false)
    }
  }

  const closePreview = () => {
    if (requestRef.current?.url) {
      URL.revokeObjectURL(requestRef.current.url)
      requestRef.current.url = undefined
    }
    setPreview(null)
    requestAnimationFrame(() => previewButton.current?.focus())
  }

  return <div className={styles.download}>
    <Button ref={previewButton} type="button" onClick={() => void openFile('preview')} disabled={busy} aria-busy={busy}
      aria-label={`VER ${receipt.nombre_archivo}`} className={styles.downloadButton}>VER</Button>
    <Button type="button" onClick={() => void openFile('download')} disabled={busy} aria-busy={busy}
      aria-label={`DESCARGAR ${receipt.nombre_archivo}`} className={styles.downloadButton}>DESCARGAR</Button>
    {error ? <p role="alert" className={styles.error}>{error}</p> : null}
    {preview ? <Dialog open title={receipt.nombre_archivo} onClose={closePreview} animate={false}>
      {preview.type === 'application/pdf'
        ? <iframe title={receipt.nombre_archivo} src={preview.url} className={styles.previewPdf} />
        : <img alt={receipt.nombre_archivo} src={preview.url} className={styles.previewImage} />}
    </Dialog> : null}
  </div>
}

