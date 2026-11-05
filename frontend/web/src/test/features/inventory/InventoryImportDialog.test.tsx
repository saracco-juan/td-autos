import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { confirmImport, fetchInventoryTemplate, previewImport } from '../../../features/inventory/api/client'
import InventoryImportDialog from '../../../features/inventory/components/InventoryImportDialog'
import { appliedNotice } from '../../../features/inventory/model/importMessages'
import { HttpError } from '../../../lib/http'

vi.mock('../../../features/inventory/api/client', () => ({
  previewImport: vi.fn(),
  confirmImport: vi.fn(),
  fetchInventoryTemplate: vi.fn(),
}))

const XLSX = new File(['workbook'], 'stock.xlsx', {
  type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
})

function Host() {
  const [open, setOpen] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)
  return (
    <MemoryRouter>
    <>
      {notice ? <p role="status">{notice}</p> : null}
      <InventoryImportDialog
        open={open}
        onClose={() => setOpen(false)}
        onImported={setNotice}
      />
    </>
    </MemoryRouter>
  )
}

describe('InventoryImportDialog', () => {
  beforeEach(() => {
    vi.mocked(previewImport).mockReset()
    vi.mocked(confirmImport).mockReset()
    vi.mocked(fetchInventoryTemplate).mockReset()
    Object.defineProperties(HTMLDialogElement.prototype, {
      showModal: { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute('open', '') } },
      close: { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute('open') } },
    })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('keeps the import open when the native file picker is cancelled', () => {
    render(<Host />)
    fireEvent(screen.getByLabelText('Archivo XLSX'), new Event('cancel', { bubbles: true }))
    expect(screen.getByRole('dialog', { name: 'Importar XLSX' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'CONFIRMAR IMPORTACIÓN' })).toBeDisabled()
    expect(previewImport).not.toHaveBeenCalled()
    expect(confirmImport).not.toHaveBeenCalled()
  })

  it('still closes when the dialog itself is cancelled', () => {
    render(<Host />)
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { bubbles: false, cancelable: true }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens a dialog and previews a dropped XLSX inside it', async () => {
    vi.mocked(previewImport).mockResolvedValue({ nuevos: 2, actualizaciones: 1 })
    render(<Host />)
    const dialog = screen.getByRole('dialog', { name: 'Importar XLSX' })
    const dropZone = within(dialog).getByText(/Arrastrá el archivo XLSX acá/)

    fireEvent.dragOver(dropZone, { dataTransfer: { files: [XLSX] } })
    fireEvent.drop(dropZone, { dataTransfer: { files: [XLSX] } })

    expect(previewImport).toHaveBeenCalledWith(XLSX)
    expect(await within(dialog).findByText(/2 vehículos nuevos · 1 actualización/)).toBeInTheDocument()
    expect(within(dialog).getByText('Listo para importar')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'CONFIRMAR IMPORTACIÓN' })).toBeEnabled()
    expect(screen.queryByRole('heading', { level: 1, name: 'Importar XLSX' })).not.toBeInTheDocument()
  })

  it('keeps preview errors in the dialog and leaves confirmation disabled', async () => {
    vi.mocked(previewImport).mockRejectedValue(new HttpError(422, {
      message: 'El archivo tiene errores.',
      errores: [{ fila: 2, patente: 'AB123CD', mensajes: ['El año no es válido.'] }],
    }))
    render(<Host />)
    const dialog = screen.getByRole('dialog', { name: 'Importar XLSX' })
    const input = within(dialog).getByLabelText('Archivo XLSX')

    await userEvent.setup().upload(input, XLSX)

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('El archivo tiene errores.')
    expect(within(dialog).getByText('Revisá el archivo')).toBeInTheDocument()
    expect(within(dialog).getByText('Fila 2 · AB123CD: El año no es válido.')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'CONFIRMAR IMPORTACIÓN' })).toBeDisabled()
  })

  it('explains unsupported drops without validating or importing them', async () => {
    render(<Host />)
    const dialog = screen.getByRole('dialog', { name: 'Importar XLSX' })
    const invalid = new File(['image'], 'foto.png', { type: 'image/png' })
    fireEvent.drop(within(dialog).getByText(/Arrastrá el archivo XLSX acá/), { dataTransfer: { files: [invalid] } })
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Seleccioná un archivo XLSX.')
    expect(previewImport).not.toHaveBeenCalled()
    expect(confirmImport).not.toHaveBeenCalled()
    expect(within(dialog).getByRole('button', { name: 'CONFIRMAR IMPORTACIÓN' })).toBeDisabled()
  })

  it('locks closing and duplicate confirmation while the import is pending', async () => {
    vi.mocked(previewImport).mockResolvedValue({ nuevos: 1, actualizaciones: 0 })
    let finish!: (counts: { nuevos: number; actualizaciones: number }) => void
    vi.mocked(confirmImport).mockReturnValue(new Promise((resolve) => { finish = resolve }))
    render(<Host />)
    const dialog = screen.getByRole('dialog', { name: 'Importar XLSX' })
    const user = userEvent.setup()
    await user.upload(within(dialog).getByLabelText('Archivo XLSX'), XLSX)
    await within(dialog).findByText(/1 vehículo nuevo/)
    await user.dblClick(within(dialog).getByRole('button', { name: 'CONFIRMAR IMPORTACIÓN' }))
    expect(confirmImport).toHaveBeenCalledTimes(1)
    expect(within(dialog).getByRole('button', { name: 'CERRAR' })).toBeDisabled()
    expect(within(dialog).getByText('Importando…')).toBeInTheDocument()
    fireEvent(dialog, new Event('cancel', { cancelable: true }))
    expect(dialog).toBeVisible()
    expect(within(dialog).getByRole('button', { name: 'CANCELAR' })).toBeDisabled()
    finish({ nuevos: 1, actualizaciones: 0 })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('closes after successful import and reports the applied counts', async () => {
    vi.mocked(previewImport).mockResolvedValue({ nuevos: 3, actualizaciones: 1 })
    vi.mocked(confirmImport).mockResolvedValue({ nuevos: 3, actualizaciones: 1 })
    render(<Host />)
    const dialog = screen.getByRole('dialog', { name: 'Importar XLSX' })
    await userEvent.setup().upload(within(dialog).getByLabelText('Archivo XLSX'), XLSX)
    await within(dialog).findByText(/3 vehículos nuevos · 1 actualización/)

    await userEvent.setup().click(within(dialog).getByRole('button', { name: 'CONFIRMAR IMPORTACIÓN' }))

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Importar XLSX' })).not.toBeInTheDocument())
    expect(confirmImport).toHaveBeenCalledWith(XLSX)
    expect(screen.getByRole('status')).toHaveTextContent(appliedNotice({ nuevos: 3, actualizaciones: 1 }))
  })
})
