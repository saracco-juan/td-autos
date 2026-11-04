<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\Favorites\BuyerFavorites;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

final class FavoritoController extends Controller
{
    public function __construct(private readonly BuyerFavorites $favorites) {}

    public function index(Request $request): JsonResponse
    {
        $this->authorizeBuyer($request);
        $input = $request->validate([
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:60'],
            'ids' => ['sometimes', 'array', 'min:1', 'max:60'],
            'ids.*' => ['integer', 'min:1'],
        ]);

        return response()->json($this->favorites->forUser((int) $request->user()->id, $input))
            ->header('Cache-Control', 'private, no-store');
    }

    public function store(Request $request, int $id): Response
    {
        $this->authorizeBuyer($request);
        abort_unless($this->favorites->save((int) $request->user()->id, $id), 404, 'Esta publicación ya no está disponible.');

        return response()->noContent();
    }

    public function destroy(Request $request, int $id): Response
    {
        $this->authorizeBuyer($request);
        $this->favorites->remove((int) $request->user()->id, $id);

        return response()->noContent();
    }

    private function authorizeBuyer(Request $request): void
    {
        abort_unless($request->user()->rol === User::ROL_COMPRADOR, 403);
    }
}
