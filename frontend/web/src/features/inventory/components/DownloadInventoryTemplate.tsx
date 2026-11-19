import { useEffect, useRef, useState } from 'react'
import Button from '../../../components/Buttons/Button'
import alertStyles from '../../../styles/alert.module.css'
import { fetchInventoryTemplate } from '../api/client'
import styles from './DownloadInventoryTemplate.module.css'

type Request = { cancelled: boolean }

type Props = {
  disabled?: boolean
  className?: string
  onStart?: () => void
  onFailure?: (error: unknown) => void
}

export default function DownloadInventoryTemplate({
  disabled = false,
  className,
  onStart,
  onFailure,
}: Props) {
  const [downloading, setDownloading] = useState(false)
  const [downloaded, setDownloaded] = useState(false)
  const requestRef = useRef<Request | null>(null)
  const objectUrl = useRef<string | null>(null)

  useEffect(() => () => {
    const request = requestRef.current
    if (request) request.cancelled = true
    if (objectUrl.current) {
      URL.revokeObjectURL(objectUrl.current)
      objectUrl.current = null
    }
  }, [])

  const download = async () => {
    if (disabled || requestRef.current) return
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current)
    const request: Request = { cancelled: false }
    requestRef.current = request
    setDownloading(true)
    setDownloaded(false)
    onStart?.()
    try {
      const blob = await fetchInventoryTemplate()
      if (request.cancelled) return
      const url = URL.createObjectURL(blob)
      objectUrl.current = url
      const link = document.createElement('a')
      link.href = url
      link.download = 'plantilla-inventario.xlsx'
      link.click()
      setDownloaded(true)
    } catch (error) {
      if (!request.cancelled) onFailure?.(error)
    } finally {
      if (!request.cancelled) {
        requestRef.current = null
        setDownloading(false)
      }
    }
  }

  const state = downloading ? 'loading' : downloaded ? 'success' : 'idle'
  return <>
    <Button
      type="button"
      disabled={disabled || downloading}
      aria-busy={downloading}
      data-download-state={state}
      onClick={() => void download()}
      variant={downloaded ? 'success' : 'secondary'}
      className={`${styles.button} ${className ?? ''}`}
    >
      <span className={styles.progress} aria-hidden="true" />
      <span className={styles.label}>{downloading ? 'DESCARGANDO…' : 'DESCARGAR PLANTILLA'}</span>
    </Button>
    {downloaded ? <p role="status" className={`${alertStyles.notice} ${styles.success}`}>Plantilla descargada exitosamente.</p> : null}
  </>
}
