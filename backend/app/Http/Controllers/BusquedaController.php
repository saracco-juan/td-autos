<?php

namespace App\Http\Controllers;

use App\Services\Busqueda\CatalogSearch;
use App\Services\Marketplaces\MarketplaceRefresher;
use App\Services\Marketplaces\MarketplaceSearch;
use App\Services\Marketplaces\MarketplaceSearchResult;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Centralized search: dealer vehicles plus the external marketplaces (RF05, CU-05).
 */
class BusquedaController extends Controller
{
    public const DEFAULT_PER_PAGE = 24;

    public const MAX_PER_PAGE = 60;

    /**
     * One page of the unified list plus the status of each external source; answers 200 even when
     * every source fails, so the page decides what to show. Marketplaces are called at most once
     * per cache window, never because of a search text or a page change.
     */
    public function index(Request $request, MarketplaceRefresher $refresher, CatalogSearch $catalog): JsonResponse
    {
        $data = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:'.self::MAX_PER_PAGE],
        ]);

        $sources = $refresher->refresh(app(MarketplaceSearch::class));
        $healthy = array_column(array_filter($sources, fn (array $s): bool => $s['estado'] === MarketplaceSearchResult::OK), 'clave');

        $page = $catalog->search(
            $data['q'] ?? null,
            $healthy,
            array_column($sources, 'nombre', 'clave'),
            (int) ($data['page'] ?? 1),
            (int) ($data['per_page'] ?? self::DEFAULT_PER_PAGE),
        );

        return response()->json([
            'publicaciones' => $page->items(),
            'fuentes' => $sources,
            'meta' => [
                'page' => $page->currentPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
                'last_page' => $page->lastPage(),
            ],
        ]);
    }
}
