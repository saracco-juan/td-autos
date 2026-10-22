import type { TransferResponse, TransferStage } from './types'

// The shape of the real catalog: 4 stages, 15 items, 8 mandatory.
export const STAGES: TransferStage[] = [
  {
    numero: 1,
    titulo: 'Antes de señar',
    ayuda: 'Chequeá estos puntos antes de dejar plata de seña.',
    items: [
      { codigo: 'antes_informe_dominio', texto: 'Pedí el informe de dominio del auto', obligatorio: false },
      { codigo: 'antes_titular', texto: 'El vendedor es el titular del auto', obligatorio: false },
      { codigo: 'antes_deudas', texto: 'El auto no tiene deudas de patentes ni infracciones', obligatorio: false },
    ],
  },
  {
    numero: 2,
    titulo: 'Documentación',
    ayuda: 'Juntá estos papeles antes de ir al registro.',
    items: [
      { codigo: 'documentacion_dni', texto: 'DNI del comprador y del vendedor', obligatorio: true },
      {
        codigo: 'documentacion_titulo',
        texto: 'Título del automotor o constancia de asignación de título',
        obligatorio: true,
      },
      { codigo: 'documentacion_cedula', texto: 'Cédula del vehículo', obligatorio: true },
      { codigo: 'documentacion_cuit_cuil', texto: 'CUIT o CUIL del comprador', obligatorio: true },
      {
        codigo: 'documentacion_conyuge',
        texto: 'Si el vendedor está casado, documento y firma del cónyuge',
        obligatorio: true,
      },
    ],
  },
  {
    numero: 3,
    titulo: 'Trámite en el registro',
    ayuda: null,
    items: [
      {
        codigo: 'tramite_verificacion_fisica',
        texto: 'Verificación física del auto (inscriptos desde 2001)',
        obligatorio: true,
      },
      { codigo: 'tramite_formulario_08', texto: 'Precarga del formulario 08 digital', obligatorio: true },
      { codigo: 'tramite_turno', texto: 'Turno en el registro', obligatorio: false },
      { codigo: 'tramite_firma_aranceles', texto: 'Firma de ambas partes y pago de aranceles', obligatorio: true },
    ],
  },
  {
    numero: 4,
    titulo: 'Después de transferir',
    ayuda: null,
    items: [
      { codigo: 'despues_titulo_cedula', texto: 'Retirá el título y la cédula a tu nombre', obligatorio: false },
      { codigo: 'despues_seguro', texto: 'Poné el seguro a tu nombre', obligatorio: false },
      { codigo: 'despues_patentes', texto: 'Hacé el alta en patentes', obligatorio: false },
    ],
  },
]

export const MANDATORY_CODES = [
  'documentacion_dni',
  'documentacion_titulo',
  'documentacion_cedula',
  'documentacion_cuit_cuil',
  'documentacion_conyuge',
  'tramite_verificacion_fisica',
  'tramite_formulario_08',
  'tramite_firma_aranceles',
]

export const ALL_CODES = STAGES.flatMap((stage) => stage.items.map((item) => item.codigo))

export function transferResponse(overrides: Partial<TransferResponse> = {}): TransferResponse {
  return {
    etapas: STAGES,
    estado: null,
    items_completados: [],
    asesor_whatsapp: null,
    ...overrides,
  }
}
