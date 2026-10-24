<?php

namespace App\Http\Controllers;

use App\Services\Inventario\VehicleCatalog;
use App\Services\Inventario\VehiculoXlsxTemplate;
use Symfony\Component\HttpFoundation\Response;

final class InventoryXlsxTemplateController extends Controller
{
    public function __invoke(VehicleCatalog $catalog, VehiculoXlsxTemplate $template): Response
    {
        $current = $catalog->current();
        if ($current['snapshot_id'] === null || $current['entries'] === []) {
            return response()->json(['message' => 'El catálogo no está disponible. Intentá de nuevo más tarde.'], 503);
        }

        return response($template->contents($current['entries']), 200, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => 'attachment; filename="plantilla-inventario.xlsx"',
            'Cache-Control' => 'private, no-store',
            'X-Catalog-Snapshot' => $current['snapshot_id'],
            'X-Catalog-Source-Date' => $current['source_date'] ?? '',
            'X-Catalog-Warning' => $current['warning'] ?? '',
        ]);
    }
}
