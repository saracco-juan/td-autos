import { useEffect, useRef, useState } from 'react'
import ButtonLink from '../../../components/Buttons/ButtonLink'
import Button from '../../../components/Buttons/Button'
import alertStyles from '../../../styles/alert.module.css'
import barStyles from '../../../components/checklist/pinnedBar.module.css'
import ScrollArea from '../../../components/ScrollArea/ScrollArea'
import { HttpError } from '../../../lib/http'
import SessionLoading from '../../auth/session/components/SessionLoading'
import { confirmImport, previewImport } from '../api/client'
import {
  inactiveSubscription,
  type InactiveSubscription,
} from '../model/inactiveSubscription'
import { importFailureFrom, type ImportFailure } from '../model/importErrors'
import { appliedNotice, previewSummary } from '../model/importMessages'
import { goToInventory, INVENTORY_PATH } from '../model/inventoryRoutes'
import SubscriptionBlockedNotice from './SubscriptionBlockedNotice'
import DownloadInventoryTemplate from './DownloadInventoryTemplate'
import type { ImportCounts } from '../model/types'
import { useNavigate } from 'react-router'
import VehicleFormPage from '../pages/VehicleFormPage'
import styles from './InventoryImportForm.module.css'

type Preview = 'none' | 'loading' | ImportCounts
type Presentation = 'page' | 'dialog'

type Props = {
  presentation?: Presentation
  onClose?: () => void
  onComplete?: (notice: string) => void
  onBusyChange?: (busy: boolean) => void
}

const isXlsx = (file: File) =>
  file.name.toLowerCase().endsWith('.xlsx') ||
  file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export default function InventoryImportForm({
  presentation = 'page',
  onClose,
  onComplete,
  onBusyChange,
}: Props) {
  const navigate = useNavigate()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<Preview>('none')
  const [failure, setFailure] = useState<ImportFailure | null>(null)
  const [blocked, setBlocked] = useState<InactiveSubscription | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [dragging, setDragging] = useState(false)
  const failureRef = useRef<HTMLDivElement>(null)
  const currentFile = useRef<File | null>(null)

  useEffect(() => () => { currentFile.current = null }, [])

  useEffect(() => {
    if (failure) failureRef.current?.focus()
  }, [failure])

  const showFailure = (error: unknown) => {
    const inactive = inactiveSubscription(error)
    if (inactive) setBlocked(inactive)
    else setFailure(importFailureFrom(error))
  }

  const pickFile = async (picked: File) => {
    if (confirming) return
    if (!isXlsx(picked)) {
      currentFile.current = null
      setFile(null)
      setPreview('none')
      setFailure({ message: 'Seleccioná un archivo XLSX.', rows: [] })
      return
    }
    currentFile.current = picked
    setFile(picked)
    setFailure(null)
    setBlocked(null)
    setPreview('loading')
    try {
      const counts = await previewImport(picked)
      if (currentFile.current === picked) setPreview(counts)
    } catch (error) {
      if (currentFile.current !== picked) return
      setPreview('none')
      showFailure(error)
    }
  }

  const confirm = async () => {
    if (!file || confirming) return
    setFailure(null)
    setBlocked(null)
    setConfirming(true)
    onBusyChange?.(true)
    try {
      const counts = await confirmImport(file)
      if (currentFile.current !== file) return
      const notice = appliedNotice(counts)
      setConfirming(false)
      onBusyChange?.(false)
      if (onComplete) onComplete(notice)
      else goToInventory(navigate, notice)
    } catch (error) {
      if (currentFile.current !== file) return
      if (error instanceof HttpError && error.status === 422)
        setPreview('none')
      showFailure(error)
      setConfirming(false)
      onBusyChange?.(false)
    }
  }

  const ready = typeof preview === 'object'
  const actions = (
    <div className={`${barStyles.actions} ${styles.actions}`}>
      {presentation === 'page' ? (
        <ButtonLink to={INVENTORY_PATH} variant="secondary" className={barStyles.action}>
          VOLVER AL INVENTARIO
        </ButtonLink>
      ) : (
        <Button type="button" disabled={confirming} variant="secondary" className={barStyles.action} onClick={onClose}>
          CANCELAR
        </Button>
      )}
      <Button
        type="button"
        disabled={!ready || confirming}
        aria-busy={confirming}
        variant="primary"
        className={barStyles.actionWide}
        onClick={() => void confirm()}
      >
        {confirming ? 'IMPORTANDO…' : 'CONFIRMAR IMPORTACIÓN'}
      </Button>
    </div>
  )

  const content = (
    <>
      <section className={styles.card} aria-labelledby="import-format-title">
        <h2 id="import-format-title" className={styles.cardTitle}>Prepará tu archivo</h2>
        <p className={styles.cardBody}>
          Completá la plantilla XLSX sin cambiar sus columnas. Hasta 500 vehículos y 2 MB.
          Cada vehículo necesita entre 7 y 20 URLs públicas de fotos, separadas por |.
        </p>
        <p className={styles.cardBody}>
          Las patentes existentes se actualizan; las nuevas se agregan. Revisá la vista previa antes de confirmar.
          Si hay errores, corregí el archivo: no se aplicará ningún cambio.
        </p>
        <DownloadInventoryTemplate disabled={confirming} onStart={() => { setFailure(null); setBlocked(null) }} onFailure={showFailure} className={styles.template} />
      </section>
      <label
        className={styles.dropZone}
        data-dragging={dragging || undefined}
        onDragOver={(event) => { event.preventDefault(); if (!confirming) setDragging(true) }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false)
        }}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          const dropped = event.dataTransfer.files[0]
          if (dropped) void pickFile(dropped)
        }}
      >
        <svg className={styles.folder} viewBox="0 0 56 48" aria-hidden="true">
          <path d="M5 12a4 4 0 0 1 4-4h13l5 5h20a4 4 0 0 1 4 4v23H5Z" fill="currentColor" opacity=".3" />
          <rect className={styles.folderPaper} x="14" y="6" width="28" height="30" rx="3" fill="var(--surface-default)" stroke="currentColor" strokeWidth="1.5" />
          <path className={styles.folderFront} d="M5 21h46l-4 19H9Z" fill="currentColor" />
        </svg>
        <span className={styles.dropTitle}>{dragging ? 'Soltá el archivo para validarlo' : 'Arrastrá el archivo XLSX acá'}</span>
        <span className={styles.dropHint}>o seleccioná un archivo de tu dispositivo</span>
        <input
          type="file"
          aria-label="Archivo XLSX"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className={styles.fileInput}
          disabled={confirming}
          onChange={(event) => {
            const picked = event.target.files?.[0]
            event.target.value = ''
            if (picked) void pickFile(picked)
          }}
        />
      </label>
      {file ? (
        <div className={styles.selectedFile}>
          <span className={styles.fileType} aria-hidden="true">XLSX</span>
          <div className={styles.fileDetails}>
            <span className={styles.fileName}>{file.name}</span>
            <span className={styles.dropHint}>{Math.max(1, Math.ceil(file.size / 1024))} KB</span>
          </div>
          {preview === 'loading' ? <SessionLoading /> : (
            <span className={styles.fileState} data-ready={(ready && !failure && !blocked && !confirming) || undefined}>
              {confirming ? 'Importando…' : ready && !failure && !blocked ? 'Listo para importar' : 'Revisá el archivo'}
            </span>
          )}
        </div>
      ) : null}
      {ready ? (
        <section className={styles.card} aria-labelledby="import-preview-title">
          <h2 id="import-preview-title" className={styles.cardTitle}>Vista previa</h2>
          <p className={styles.cardBody}>{previewSummary(preview)}</p>
        </section>
      ) : null}
      {blocked ? <SubscriptionBlockedNotice info={blocked} compact /> : null}
      {failure ? (
        <div ref={failureRef} tabIndex={-1} role="alert" className={`${alertStyles.alert} ${styles.failure}`}>
          <p className={styles.failureMessage}>{failure.message}</p>
          {failure.rows.length > 0 ? (
            <ScrollArea label="Filas con error" offset={640}>
              <ul className={styles.failureRows}>{failure.rows.map((row, index) => <li key={index}>{row}</li>)}</ul>
            </ScrollArea>
          ) : null}
        </div>
      ) : null}
      {presentation === 'dialog' ? actions : null}

    </>
  )

  if (presentation === 'page') {
    return (
      <VehicleFormPage
        title="Importar XLSX"
        subtitle="Subí un archivo para cargar o actualizar varios vehículos a la vez."
        actions={actions}
      >
        {content}
      </VehicleFormPage>
    )
  }

  return <div className={styles.dialogContent}>{content}</div>
}
