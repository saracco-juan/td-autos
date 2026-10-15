<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UpdateDealerRequest;
use App\Models\Concesionaria;
use App\Services\Admin\DealerDetail;
use App\Services\Admin\DealerDirectory;
use Illuminate\Http\JsonResponse;

/**
 * Dealers as the administrator sees them (RF19, RF32).
 */
class ConcesionariaController extends Controller
{
    public function index(DealerDirectory $directory): JsonResponse
    {
        return response()->json($directory->summary());
    }

    public function show(DealerDetail $detail, int $id): JsonResponse
    {
        $dealer = Concesionaria::query()->find($id);

        if ($dealer === null) {
            return response()->json(['message' => UpdateDealerRequest::NOT_FOUND_MESSAGE], 404);
        }

        return response()->json($detail->show($dealer));
    }

    public function update(UpdateDealerRequest $request, DealerDetail $detail): JsonResponse
    {
        $dealer = $request->dealer();
        $detail->update($dealer, $request->validated());

        return response()->json($detail->show($dealer->refresh()));
    }
}
