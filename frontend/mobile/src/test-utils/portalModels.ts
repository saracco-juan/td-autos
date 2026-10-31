import type { PortalModel, PortalModelsResponse } from '@shared/portals/models'

export const portalModel: PortalModel = {
  id: 1, marca: 'CHEVROLET', modelo: 'Onix', carroceria: 'Hatchback',
  anios: { desde: 2017, hasta: 2025 },
  precio: { desde_ars: 27521100, hasta_ars: 33217300, anio_referencia: 2025 },
  motivos: ['Ideal para la ciudad'], filtros: ['Transmisión automática', '2017–2025'],
  imagen_url: 'https://example.com/onix.jpg',
  links: [
    { portal: 'mercadolibre', nombre: 'Mercado Libre', url: 'https://autos.mercadolibre.com.ar/chevrolet/onix/automatica/2017-2025/_PriceRange_0-34000000' },
    { portal: 'kavak', nombre: 'Kavak', url: 'https://www.kavak.com/ar/usados/chevrolet/onix/automatico' },
  ],
}

export function portalModels(modelos: PortalModel[] = [portalModel]): PortalModelsResponse {
  return { status: 'ready', modelos, fuente_precios: { nombre: 'Guía de precios ACARA', fecha: '2026-10-19' } }
}
