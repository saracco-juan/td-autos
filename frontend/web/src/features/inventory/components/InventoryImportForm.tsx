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

const FORMAT_HELP =
  'Completá la hoja Inventario de la plantilla XLSX. Elegí marca, modelo y versión del catálogo. ' +
  'En fotos, poné de 7 a 20 URLs http o https separadas por |. Hasta 500 filas y 2 MB.'

const MATCHING_HELP = [
  'Conservá también todas las columnas nuevas de la plantilla: moneda (ARS o USD), plazas (entero positivo, incluye conductor), motor, turbo, potencia (entero positivo), potencia_unidad (CV, HP o kW), consumo_urbano, consumo_ruta y equipamiento.',
  'Turbo y cada dato de seguridad y confort requieren sí o no. Vacío no significa no. Android Auto o Apple CarPlay es una sola respuesta: sí si tiene al menos uno.',
  'Consumos en L/100 km, mayores que cero, con punto decimal y hasta dos decimales. Son obligatorios para nafta y diesel; opcionales para gnc, hibrido y electrico. Transmisión: manual o automatica. Carrocería: el nombre de la lista del alta manual.',
  'El servidor valida todas las filas, aunque borres los desplegables. Una selección de catálogo inválida o incompleta rechaza todo el archivo sin aplicar cambios. Las versiones sin precios de referencia también se pueden cargar; no se inventa una estimación.',
]

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
    <div className={barStyles.actions}>
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
        <span className={styles.dropTitle}>{file?.name ?? 'Arrastrá el archivo XLSX acá'}</span>
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
      {preview === 'loading' ? (
        <section className={`${styles.card} ${styles.loadingCard}`}><SessionLoading /></section>
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
      <section className={styles.card} aria-labelledby="import-format-title">
        <h2 id="import-format-title" className={styles.cardTitle}>Formato del archivo</h2>
        <p className={styles.cardBody}>
          Cada fila necesita patente, marca, modelo, año y al menos 7 URLs de imágenes públicas. La patente identifica al vehículo: si ya existe se actualiza, si no existe se crea.
        </p>
        <p className={styles.cardBody}>{FORMAT_HELP}</p>
        {MATCHING_HELP.map((help) => <p key={help} className={styles.cardBody}>{help}</p>)}
        <DownloadInventoryTemplate disabled={confirming} onStart={() => { setFailure(null); setBlocked(null) }} onFailure={showFailure} className={styles.template} />
      </section>
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
