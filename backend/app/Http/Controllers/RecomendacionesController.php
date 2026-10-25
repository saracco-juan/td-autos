<?php

namespace App\Http\Controllers;

use App\Services\Matching\DiagnosisRecommendations;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class RecomendacionesController extends Controller
{
    public function index(Request $request, DiagnosisRecommendations $recommendations): JsonResponse
    {
        return response()->json($recommendations->forUser((int) $request->user()->id))
            ->header('Cache-Control', 'private, no-store');
    }
}
