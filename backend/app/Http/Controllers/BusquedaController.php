<?php

namespace App\Http\Controllers;

use App\Services\Marketplaces\ExternalListingStore;
use App\Services\Marketplaces\ListingQuery;
use App\Services\Marketplaces\MarketplaceSearch;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Centralized search of the external marketplaces (RF05, CU-05).
 */
class BusquedaController extends Controller
{
    /**
     * Unified list plus the status of each source; answers 200 even when every source fails, so
     * the page decides what to show.
     */
    public function index(Request $request, ExternalListingStore $store): JsonResponse
    {
        $data = $request->validate(['q' => ['nullable', 'string', 'max:100']]);

        $result = app(MarketplaceSearch::class)->search(new ListingQuery($data['q'] ?? null));
        $ids = $store->sync($result->listings);
        $names = array_column($result->sources, 'nombre', 'clave');

        $publicaciones = [];
        foreach ($result->listings as $index => $listing) {
            $publicaciones[] = [
                'id' => $ids[$index],
                'titulo' => $listing->title,
                'marca' => $listing->marca,
                'modelo' => $listing->modelo,
                'version' => $listing->version,
                'anio' => $listing->anio,
                'kilometraje' => $listing->kilometraje,
                'precio' => $listing->precio,
                'moneda' => $listing->moneda,
                'ubicacion' => $listing->ubicacion,
                'imagen_url' => $listing->imagenUrl,
                'url_original' => $listing->urlOriginal,
                'fuente' => ['clave' => $listing->marketplace, 'nombre' => $names[$listing->marketplace] ?? $listing->marketplace],
            ];
        }

        return response()->json(['publicaciones' => $publicaciones, 'fuentes' => $result->sources]);
    }
}
