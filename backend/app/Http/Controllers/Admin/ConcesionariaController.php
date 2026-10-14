<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\Admin\DealerDirectory;
use Illuminate\Http\JsonResponse;

/**
 * Dealers as the administrator sees them (RF19).
 */
class ConcesionariaController extends Controller
{
    public function index(DealerDirectory $directory): JsonResponse
    {
        return response()->json($directory->summary());
    }
}
