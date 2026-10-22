import { describe, expect, it } from 'vitest'
import { HttpError, NetworkError } from '../../lib/http'
import { RECEIPT_ACCEPT, sendErrorMessage, validateReceipt } from './receipt'

const MB = 1024 * 1024
const file = (name: string, type: string, size = 10) => new File([new Uint8Array(size)], name, { type })

describe('validateReceipt', () => {
  it('TC-81: asks for the receipt when none is selected', () => {
    expect(validateReceipt(null)).toBe('Adjuntá el comprobante.')
  })

  it.each([
    ['comprobante.pdf', 'application/pdf'],
    ['foto.jpg', 'image/jpeg'],
    ['foto.JPEG', 'image/jpeg'],
    ['captura.png', 'image/png'],
    ['sin-tipo.pdf', ''],
  ])('accepts %s', (name, type) => {
    expect(validateReceipt(file(name, type))).toBeUndefined()
  })

  it.each([
    ['TC-48: an executable', 'virus.exe', 'application/x-msdownload'],
    ['a pdf name with an image type', 'x.pdf', 'image/gif'],
    ['a gif', 'x.gif', 'image/gif'],
    ['a name without extension', 'comprobante', 'application/pdf'],
  ])('rejects %s', (_label, name, type) => {
    expect(validateReceipt(file(name, type))).toBe('El comprobante tiene que ser PDF, JPG o PNG.')
  })

  it('rejects a file over 5 MB and accepts exactly 5 MB', () => {
    expect(validateReceipt(file('a.pdf', 'application/pdf', 5 * MB + 1))).toBe('El comprobante no puede superar los 5 MB.')
    expect(validateReceipt(file('a.pdf', 'application/pdf', 5 * MB))).toBeUndefined()
  })

  it('exposes the accept list for the file input', () => {
    expect(RECEIPT_ACCEPT).toBe('.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png')
  })
})

describe('sendErrorMessage', () => {
  const generic = 'No pudimos enviar el comprobante. Probá de nuevo.'

  it('uses the first comprobante error of a 422', () => {
    const error = new HttpError(422, { message: 'x', errors: { comprobante: ['El comprobante tiene que ser PDF, JPG o PNG.'] } })
    expect(sendErrorMessage(error)).toBe('El comprobante tiene que ser PDF, JPG o PNG.')
  })

  it.each([409, 503])('uses the message of a %s', (status) => {
    expect(sendErrorMessage(new HttpError(status, { message: 'Mensaje del servidor.' }))).toBe('Mensaje del servidor.')
  })

  it.each([
    ['a 422 without field errors', new HttpError(422, {})],
    ['a 409 without a message', new HttpError(409, undefined)],
    ['a 500', new HttpError(500, { message: 'boom' })],
    ['a network failure', new NetworkError(new TypeError('Failed to fetch'))],
    ['anything else', new Error('x')],
  ])('falls back to the generic message for %s', (_label, error) => {
    expect(sendErrorMessage(error)).toBe(generic)
  })
})
