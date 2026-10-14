import type { ComprobantePendiente, DatosTransferencia, Suscripcion } from './types'

export const TRANSFERENCIA: DatosTransferencia = {
  titular: 'TD Autos S.A.',
  cuit: '30-12345678-9',
  banco: 'Banco Nación',
  cbu: '0110012340012345678901',
  alias: 'tdautos.pagos',
  monto_mensual: '25000',
}

export function comprobantePendiente(overrides: Partial<ComprobantePendiente> = {}): ComprobantePendiente {
  return {
    id: 3,
    nombre_archivo: 'comprobante-transferencia.pdf',
    enviado_en: '2026-10-14T15:30:00+00:00',
    tipo: 'alta',
    periodo_desde: '2026-10-14',
    periodo_hasta: '2026-11-14',
    ...overrides,
  }
}

export function suscripcion(overrides: Partial<Suscripcion> = {}): Suscripcion {
  return {
    estado_alta: 'pendiente',
    tipo_pago: 'alta',
    transferencia: TRANSFERENCIA,
    comprobante_pendiente: null,
    ...overrides,
  }
}
