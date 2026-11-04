import { describe, expect, it } from 'vitest'
import { HttpError, NetworkError } from '../../lib/http'
import { importFailureFrom } from './importErrors'

describe('importFailureFrom', () => {
  it('reads the row errors of a 422, one line per message', () => {
    const body = {
      message: 'El archivo tiene errores. No se aplicó ningún cambio.',
      errores: [
        { fila: 2, patente: 'AB123CD', mensajes: ['El año no es válido.', 'Faltan fotos.'] },
        { fila: 5, patente: null, mensajes: ['La patente es obligatoria.'] },
      ],
    }

    expect(importFailureFrom(new HttpError(422, body))).toEqual({
      message: 'El archivo tiene errores. No se aplicó ningún cambio.',
      rows: ['Fila 2 · AB123CD: El año no es válido.', 'Fila 2 · AB123CD: Faltan fotos.', 'Fila 5: La patente es obligatoria.'],
    })
  })

  it('reads a file-level 422 as its message with no rows', () => {
    const body = { message: 'x', errors: { archivo: ['El archivo tiene que ser un XLSX.'] } }

    expect(importFailureFrom(new HttpError(422, body))).toEqual({ message: 'El archivo tiene que ser un XLSX.', rows: [] })
  })

  it('answers the network copy for a network failure and the generic copy for anything else', () => {
    expect(importFailureFrom(new NetworkError(new Error('down')))).toEqual({
      message: 'No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.',
      rows: [],
    })
    expect(importFailureFrom(new HttpError(500, undefined))).toEqual({
      message: 'No pudimos procesar el archivo. Probá de nuevo.',
      rows: [],
    })
    expect(importFailureFrom(new HttpError(422, { message: 'x' }))).toEqual({
      message: 'No pudimos procesar el archivo. Probá de nuevo.',
      rows: [],
    })
  })
})
