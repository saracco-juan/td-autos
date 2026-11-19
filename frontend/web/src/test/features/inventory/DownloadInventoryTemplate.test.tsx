import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchInventoryTemplate } from '../../../features/inventory/api/client'
import DownloadInventoryTemplate from '../../../features/inventory/components/DownloadInventoryTemplate'

vi.mock('../../../features/inventory/api/client', () => ({ fetchInventoryTemplate: vi.fn() }))

describe('DownloadInventoryTemplate', () => {
  beforeEach(() => {
    vi.mocked(fetchInventoryTemplate).mockReset()
    vi.stubGlobal('URL', class extends URL {
      static createObjectURL = vi.fn(() => 'blob:inventory-template')
      static revokeObjectURL = vi.fn()
    })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('downloads the authenticated XLSX once and revokes its object URL on unmount', async () => {
    const blob = new Blob(['PK'])
    let resolve!: (blob: Blob) => void
    vi.mocked(fetchInventoryTemplate).mockReturnValue(new Promise(done => { resolve = done }))
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe('plantilla-inventario.xlsx')
      expect(this.href).toBe('blob:inventory-template')
    })
    const page = render(<DownloadInventoryTemplate />)

    await userEvent.setup().click(screen.getByRole('button', { name: 'DESCARGAR PLANTILLA' }))
    expect(screen.getByRole('button', { name: 'DESCARGANDO…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'DESCARGANDO…' })).toHaveAttribute('data-download-state', 'loading')
    expect(screen.getByRole('button', { name: 'DESCARGANDO…' })).not.toHaveTextContent('%')
    resolve(blob)

    await waitFor(() => expect(click).toHaveBeenCalledOnce())
    expect(await screen.findByRole('status')).toHaveTextContent('Plantilla descargada exitosamente.')
    expect(screen.getByRole('button', { name: 'DESCARGAR PLANTILLA' })).toHaveAttribute('data-download-state', 'success')
    expect(fetchInventoryTemplate).toHaveBeenCalledOnce()
    expect(URL.createObjectURL).toHaveBeenCalledWith(blob)
    page.unmount()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:inventory-template')
  })

  it('does not create a URL when the page unmounts before the response', async () => {
    let resolve!: (blob: Blob) => void
    vi.mocked(fetchInventoryTemplate).mockReturnValue(new Promise(done => { resolve = done }))
    const page = render(<DownloadInventoryTemplate />)

    await userEvent.setup().click(screen.getByRole('button', { name: 'DESCARGAR PLANTILLA' }))
    page.unmount()
    await act(async () => resolve(new Blob(['PK'])))

    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('reports failures and allows retry', async () => {
    const error = new Error('offline')
    vi.mocked(fetchInventoryTemplate).mockRejectedValueOnce(error).mockResolvedValueOnce(new Blob(['PK']))
    const onFailure = vi.fn()
    render(<DownloadInventoryTemplate onFailure={onFailure} />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'DESCARGAR PLANTILLA' }))
    await waitFor(() => expect(onFailure).toHaveBeenCalledWith(error))
    expect(screen.getByRole('button', { name: 'DESCARGAR PLANTILLA' })).toBeEnabled()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'DESCARGAR PLANTILLA' })).toHaveAttribute('data-download-state', 'idle')
    await user.click(screen.getByRole('button', { name: 'DESCARGAR PLANTILLA' }))
    await waitFor(() => expect(fetchInventoryTemplate).toHaveBeenCalledTimes(2))
  })

  it('does not start a download while disabled', async () => {
    render(<DownloadInventoryTemplate disabled />)

    expect(screen.getByRole('button', { name: 'DESCARGAR PLANTILLA' })).toBeDisabled()
    await userEvent.setup().click(screen.getByRole('button', { name: 'DESCARGAR PLANTILLA' }))
    expect(fetchInventoryTemplate).not.toHaveBeenCalled()
  })
})
