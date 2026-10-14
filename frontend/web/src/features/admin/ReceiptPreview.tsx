import { useEffect, useState } from 'react'
import { fetchReceiptFile } from './api'
import styles from './ReceiptReviewPage.module.css'

type Props = {
  receiptId: number
  fileName: string
}

type FileState = 'loading' | 'failed' | { url: string; type: string }

const TITLE = 'Comprobante de pago'

// Figma 38:1129 centre card. The file needs the session cookie, so it is fetched as a Blob and shown
// through an object URL: an image inline, a PDF in a frame, anything else only through the open link.
export default function ReceiptPreview({ receiptId, fileName }: Props) {
  const [file, setFile] = useState<FileState>('loading')

  useEffect(() => {
    let cancelled = false
    let url: string | null = null
    fetchReceiptFile(receiptId)
      .then((blob) => {
        if (cancelled) return
        url = URL.createObjectURL(blob)
        setFile({ url, type: blob.type })
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
          <a className={styles.link} href={file.url} target="_blank" rel="noopener noreferrer">
            Abrir {fileName}
          </a>
        </>
      ) : null}
    </section>
  )
}
