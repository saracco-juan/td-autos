<?php

namespace App\Http\Controllers;

use App\Services\Busqueda\CatalogSearch;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Centralized search of eligible dealer vehicles (RF05, CU-05).
 */
class BusquedaController extends Controller
{
    public const DEFAULT_PER_PAGE = 24;

    public const MAX_PER_PAGE = 60;

    /**
     * Returns a paginated page of eligible dealer vehicles.
     */
    public function index(Request $request, CatalogSearch $catalog): JsonResponse
    {
        $data = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:'.self::MAX_PER_PAGE],
        ]);

        $page = $catalog->search(
            $data['q'] ?? null,
            [],
            [],
            (int) ($data['page'] ?? 1),
            (int) ($data['per_page'] ?? self::DEFAULT_PER_PAGE),
        );

        return response()->json([
            'publicaciones' => $page->items(),
            'fuentes' => [],
            'meta' => [
                'page' => $page->currentPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
                'last_page' => $page->lastPage(),
            ],
        ]);
    }
}
