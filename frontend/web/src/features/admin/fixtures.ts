import type { AdminDealerRow, AdminReceipt, DealerDirectory } from './types'

export function dealerRow(overrides: Partial<AdminDealerRow> = {}): AdminDealerRow {
  return {
    id: 5,
    nombre: 'Concesionaria Sur',
    localidad: 'CABA',
    provincia: 'CABA',
    estado_alta: 'pendiente',
    contacto: { email: 'sur@example.com', telefono: '11 4000-0000' },
    comprobante_pendiente_id: 31,
    ultimo_comprobante_id: 31,
    ...overrides,
  }
}

export function directory(overrides: Partial<DealerDirectory> = {}): DealerDirectory {
  return {
    conteos: { activas: 1, pendientes: 1, inactivas: 0 },
    concesionarias: [
      dealerRow(),
      dealerRow({
        id: 6,
        nombre: 'Automotores Centro',
        localidad: 'Rosario',
        provincia: 'Santa Fe',
        estado_alta: 'activa',
        contacto: { email: 'centro@example.com', telefono: '341 400-0000' },
        comprobante_pendiente_id: null,
        ultimo_comprobante_id: 27,
      }),
      dealerRow({
        id: 7,
        nombre: 'Autos Norte',
        localidad: 'Córdoba',
        provincia: 'Córdoba',
        estado_alta: 'activa',
        contacto: { email: 'norte@example.com', telefono: null },
        comprobante_pendiente_id: null,
        ultimo_comprobante_id: null,
      }),
    ],
    ...overrides,
  }
}

export function receipt(overrides: Partial<AdminReceipt> = {}): AdminReceipt {
  return {
    id: 31,
    estado: 'pendiente de revisión',
    tipo: 'alta',
    periodo_desde: '2026-10-14',
    periodo_hasta: '2026-11-13',
    enviado_en: '2026-10-14T13:00:00+00:00',
    nombre_archivo: 'pago-octubre.pdf',
    archivo_url: 'http://localhost:8000/api/admin/comprobantes/31/archivo',
    motivo_rechazo: null,
    fecha_revision: null,
    concesionaria: {
      id: 5,
      nombre: 'Concesionaria Sur',
      localidad: 'CABA',
      provincia: 'CABA',
      estado_alta: 'pendiente',
      contacto: { email: 'sur@example.com', telefono: '11 4000-0000' },
    },
    ...overrides,
  }
}
