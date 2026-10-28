import { fireEvent, screen, waitFor } from 'expo-router/testing-library'
import { StyleSheet } from 'react-native'

import * as api from '../../features/auth/api'
import * as diagnosisApi from '../../features/diagnosis/api'
import * as transferApi from '../../features/transfer/api'
import { transferResponse } from '@shared/checklist/transfer/fixtures'
import * as tokenStorage from '../../lib/tokenStorage'
import { renderApp } from '../../test-utils/renderApp'

jest.mock('../../features/auth/api')
jest.mock('../../features/diagnosis/api')
jest.mock('../../features/transfer/api')
jest.mock('../../lib/tokenStorage')

const apiMock = jest.mocked(api)
const storage = jest.mocked(tokenStorage)
const diagnosis = jest.mocked(diagnosisApi)
const transfer = jest.mocked(transferApi)

const USER = { id: 1, name: 'Ana', apellido: null, email: 'ana@example.com', rol: 'comprador' }

type HostNode = NonNullable<typeof screen.root>

function findHost(node: HostNode | string | null, match: (node: HostNode) => boolean): HostNode | undefined {
  if (node === null || typeof node === 'string') return undefined
  if (match(node)) return node
  for (const child of node.children) {
    const found = findHost(child, match)
    if (found) return found
  }
  return undefined
}

describe('route guards', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    storage.readToken.mockResolvedValue(null)
    diagnosis.fetchDiagnosis.mockResolvedValue({ diagnostico: null, carrocerias: [] })
  })

  it('sends a guest to the login screen', async () => {
    const view = await renderApp('/')

    expect(await screen.findByText('Ingresá a tu cuenta')).toBeOnTheScreen()
    expect(view.getPathname()).toBe('/login')
  })

  it('TC-84: a guest cannot open a protected tab', async () => {
    const view = await renderApp('/perfil')

    expect(await screen.findByText('Ingresá a tu cuenta')).toBeOnTheScreen()
    expect(view.getPathname()).toBe('/login')
    expect(screen.queryByText('CERRAR SESIÓN')).not.toBeOnTheScreen()
  })

  it('lands a signed-in user on the diagnosis tab with the five tabs in the bar', async () => {
    storage.readToken.mockResolvedValue('tok')
    apiMock.fetchCurrentUser.mockResolvedValue(USER)

    const view = await renderApp('/')

    expect(await screen.findByText('DIAGNÓSTICO DE NECESIDADES')).toBeOnTheScreen()
    expect(view.getPathname()).toBe('/')
    for (const label of ['Diagnóstico', 'Recomendados', 'Favoritos', 'Transferencia', 'Perfil']) {
      expect(screen.getByRole('button', { name: new RegExp(`^${label},`) })).toBeOnTheScreen()
    }
  })

  it('lays out only the five tabs, so the hidden inspection route takes no slot in the bar', async () => {
    storage.readToken.mockResolvedValue('tok')
    apiMock.fetchCurrentUser.mockResolvedValue(USER)

    await renderApp('/')

    await screen.findByText('DIAGNÓSTICO DE NECESIDADES')
    // Every host child of the tab list is one tab item; a hidden one must not take flex space.
    const tablist = findHost(screen.root, (node) => node.props.role === 'tablist')
    const items = (tablist?.children ?? []).filter(
      (item) => typeof item !== 'string' && StyleSheet.flatten(item.props.style)?.display !== 'none',
    )
    expect(items).toHaveLength(5)
  })

  it('opens the transfer checklist in the Transferencia tab', async () => {
    storage.readToken.mockResolvedValue('tok')
    apiMock.fetchCurrentUser.mockResolvedValue(USER)
    transfer.fetchTransfer.mockResolvedValue(transferResponse())

    const view = await renderApp('/transferencia')

    expect(await screen.findByText('Checklist de transferencia')).toBeOnTheScreen()
    expect(view.getPathname()).toBe('/transferencia')
  })

  it('does not 404 when the OS opens the app on the google return route', async () => {
    const guest = await renderApp('/auth/google?code=abc')

    expect(await screen.findByText('Ingresá a tu cuenta')).toBeOnTheScreen()
    expect(guest.getPathname()).toBe('/login')
  })

  it('sends a signed-in user from the google return route to the tabs', async () => {
    storage.readToken.mockResolvedValue('tok')
    apiMock.fetchCurrentUser.mockResolvedValue(USER)

    const view = await renderApp('/auth/google')

    expect(await screen.findByText('DIAGNÓSTICO DE NECESIDADES')).toBeOnTheScreen()
    expect(view.getPathname()).toBe('/')
  })

  it('TC-83 + TC-84: logging out from Perfil returns to the login and closes the tabs', async () => {
    storage.readToken.mockResolvedValue('tok')
    apiMock.fetchCurrentUser.mockResolvedValue(USER)
    apiMock.logoutRequest.mockResolvedValue(undefined)

    const view = await renderApp('/perfil')
    await fireEvent.press(await screen.findByText('CERRAR SESIÓN'))

    expect(await screen.findByText('Ingresá a tu cuenta')).toBeOnTheScreen()
    await waitFor(() => expect(view.getPathname()).toBe('/login'))
    expect(screen.queryByText('CERRAR SESIÓN')).not.toBeOnTheScreen()
    expect(storage.clearToken).toHaveBeenCalled()
  })
})
