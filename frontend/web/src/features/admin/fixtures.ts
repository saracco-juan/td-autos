import type { AdminDealerRow, AdminReceipt, DealerDetail, DealerDirectory } from './types'

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
    ultimo_comprobante_estado: 'pendiente de revisión',
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
        ultimo_comprobante_estado: 'aprobado',
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
        ultimo_comprobante_estado: null,
      }),
    ],
    ...overrides,
  }
}

export function dealerDetail(overrides: Partial<DealerDetail> = {}): DealerDetail {
  return {
    id: 5,
    nombre: 'Concesionaria Sur',
    responsable_nombre: 'Marta',
    responsable_apellido: 'Gómez',
    responsable_dni: '30111222',
    telefono_responsable: '11 4444-5555',
    telefono_publico: '11 4000-0000',
    email: 'sur@example.com',
    direccion: 'Av. Ejemplo 1234',
    localidad: 'CABA',
    provincia: 'CABA',
    estado_alta: 'activa',
    suscripcion: { estado: 'activa', vigente_desde: '2026-09-14', vigente_hasta: '2026-10-13' },
    comprobantes: [
      {
        id: 31,
        tipo: 'renovacion',
        estado: 'pendiente de revisión',
        periodo_desde: '2026-10-14',
        periodo_hasta: '2026-11-13',
        enviado_en: '2026-10-14T13:00:00+00:00',
        motivo_rechazo: null,
        fecha_revision: null,
      },
      {
        id: 27,
        tipo: 'alta',
        estado: 'aprobado',
        periodo_desde: '2026-09-14',
        periodo_hasta: '2026-10-13',
        enviado_en: '2026-09-14T13:00:00+00:00',
        motivo_rechazo: null,
        fecha_revision: '2026-09-15T13:00:00+00:00',
      },
      {
        id: 20,
        tipo: 'alta',
        estado: 'rechazado',
        periodo_desde: '2026-08-14',
        periodo_hasta: '2026-09-13',
        enviado_en: '2026-08-14T13:00:00+00:00',
        motivo_rechazo: 'El monto no coincide con la cuota.',
        fecha_revision: '2026-08-15T13:00:00+00:00',
      },
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
