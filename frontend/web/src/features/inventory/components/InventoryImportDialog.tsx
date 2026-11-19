import { useState } from 'react'
import Dialog from '../../../components/Dialog/Dialog'
import InventoryImportForm from './InventoryImportForm'
import styles from './InventoryImportForm.module.css'

type Props = {
  open: boolean
  onClose: () => void
  onImported: (notice: string) => void
}

export default function InventoryImportDialog({ open, onClose, onImported }: Props) {
  const [busy, setBusy] = useState(false)

  return (
    <Dialog open={open} title="Importar XLSX" busy={busy} onClose={onClose} className={styles.dialog}>
      {open ? (
        <InventoryImportForm
          presentation="dialog"
          onClose={onClose}
          onBusyChange={setBusy}
          onComplete={(notice) => {
            onClose()
            onImported(notice)
          }}
        />
      ) : null}
    </Dialog>
  )
}
