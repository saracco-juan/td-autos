import * as SecureStore from 'expo-secure-store'

import { clearToken, readToken, saveToken } from '../../lib/tokenStorage'

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}))

describe('tokenStorage', () => {
  beforeEach(() => jest.clearAllMocks())

  it('saves the token under a fixed key', async () => {
    await saveToken('abc')

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('td-autos.token', 'abc')
  })

  it('reads the stored token', async () => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue('abc')

    await expect(readToken()).resolves.toBe('abc')
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith('td-autos.token')
  })

  it('reads null when nothing is stored', async () => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue(null)

    await expect(readToken()).resolves.toBeNull()
  })

  it('treats an unreadable store as no token', async () => {
    jest.mocked(SecureStore.getItemAsync).mockRejectedValue(new Error('keystore'))

    await expect(readToken()).resolves.toBeNull()
  })

  it('clears the token', async () => {
    await clearToken()

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('td-autos.token')
  })
})
