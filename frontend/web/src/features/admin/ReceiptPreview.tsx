import { useEffect, useState } from 'react'
import { fetchReceiptFile } from './api'
import styles from './ReceiptReviewPage.module.css'

type Props = {
  receiptId: number
  fileName: string
}

type FileState = 'loading' | 'failed' | { url: string; type: string }

const TITLE = 'Comprobante de pago'

// Types the browser shows without running code. SVG is an image but can carry scripts, so it is left out.
const SAFE_TYPES = new Set(['image/png', 'image/jpeg', 'application/pdf'])

// Any other file is rebuilt with an inert type: an object URL lives in the SPA origin, so opening an
// HTML or SVG blob there would run its scripts with the admin session. Those files are only downloaded.
function displayable(blob: Blob): Blob {
  return SAFE_TYPES.has(blob.type) ? blob : new Blob([blob], { type: 'application/octet-stream' })
}

// Figma 38:1129 centre card. The file needs the session cookie, so it is fetched as a Blob and shown
// through an object URL: an image inline and a PDF in a frame, with an open link; anything else is a download.
export default function ReceiptPreview({ receiptId, fileName }: Props) {
  const [file, setFile] = useState<FileState>('loading')

  useEffect(() => {
    let cancelled = false
    let url: string | null = null
    fetchReceiptFile(receiptId)
      .then((blob) => {
        if (cancelled) return
        const safe = displayable(blob)
        url = URL.createObjectURL(safe)
        setFile({ url, type: safe.type })
      })
      .catch(() => {
        if (!cancelled) setFile('failed')
      })
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [receiptId])

  return (
    <section className={`${styles.card} ${styles.preview}`} aria-labelledby="receipt-preview-title">
      <p className={styles.previewEyebrow}>COMPROBANTE DE TRANSFERENCIA</p>
      <h2 id="receipt-preview-title" className={styles.previewTitle}>
        {TITLE}
      </h2>
      {file === 'loading' ? (
        <p className={styles.muted} aria-busy="true">
          Cargando comprobante…
        </p>
      ) : null}
      {file === 'failed' ? <p className={styles.muted}>No pudimos cargar el archivo del comprobante.</p> : null}
      {typeof file === 'object' ? (
        <>
          {file.type.startsWith('image/') ? <img className={styles.previewImage} src={file.url} alt={TITLE} /> : null}
          {file.type === 'application/pdf' ? <iframe className={styles.previewFrame} src={file.url} title={TITLE} /> : null}
          {SAFE_TYPES.has(file.type) ? (
            <a className={styles.link} href={file.url} target="_blank" rel="noopener noreferrer">
              Abrir {fileName}
            </a>
          ) : (
            <a className={styles.link} href={file.url} download={fileName}>
              Descargar {fileName}
            </a>
          )}
        </>
      ) : null}
    </section>
  )
}
