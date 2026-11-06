import { describe, expect, it } from 'vitest'
import { errorsForVehicleStep, vehicleStepForError, VEHICLE_FORM_STEPS } from '../../../features/inventory/model/vehicleFormSteps'

describe('vehicle form steps', () => {
  it('groups every existing validation key into one creation step', () => {
    const fields = VEHICLE_FORM_STEPS.flatMap(({ fields: stepFields }) => stepFields)
    expect(fields).toContain('patente')
    expect(fields).toContain('acara_version_id')
    expect(fields).toContain('fotos')
    expect(new Set(fields).size).toBe(fields.length)
  })

  it('returns only current-step errors and routes server fields to their step', () => {
    const errors = { patente: ['Placa inválida.'], motor: ['Indicá el motor.'], fotos: ['Cargá al menos siete fotos.'] }
    expect(errorsForVehicleStep(errors, 2)).toEqual({ motor: ['Indicá el motor.'] })
    expect(vehicleStepForError('patente')).toBe(0)
    expect(vehicleStepForError('motor')).toBe(2)
    expect(vehicleStepForError('fotos')).toBe(4)
  })
})
