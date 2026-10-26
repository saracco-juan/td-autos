<?php

namespace App\Http\Controllers;

use App\Services\Inventario\VehicleCatalog;
use Illuminate\Http\JsonResponse;

final class VehicleCatalogController extends Controller
{
    public function __invoke(VehicleCatalog $catalog): JsonResponse
    {
        $current = $catalog->current();

        return response()->json($current, $current['snapshot_id'] === null ? 503 : 200);
    }
}
