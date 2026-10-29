<?php

namespace App\Http\Controllers;

use App\Services\Portales\PortalModelRecommendations;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class RecomendacionesModelosController extends Controller
{
    public function index(Request $request, PortalModelRecommendations $recommendations): JsonResponse
    {
        return response()->json($recommendations->forUser((int) $request->user()->id))
            ->header('Cache-Control', 'private, no-store');
    }
}
