<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UpdateDealerRequest;
use App\Models\Concesionaria;
use App\Services\Admin\DealerDetail;
use App\Services\Admin\DealerDirectory;
use App\Services\Admin\DealerHasCurrentSubscriptionException;
use App\Services\Admin\DealerRemoval;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;

/**
 * Dealers as the administrator sees them (RF19, RF32) and their deletion (RF34, RF35).
 */
class ConcesionariaController extends Controller
{
    public const MESSAGE_CURRENT_SUBSCRIPTION = 'No podés eliminar una concesionaria con la suscripción vigente.';

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

    public function destroy(DealerRemoval $removal, int $id): JsonResponse|Response
    {
        $dealer = Concesionaria::query()->find($id);

        if ($dealer === null) {
            return response()->json(['message' => UpdateDealerRequest::NOT_FOUND_MESSAGE], 404);
        }

        try {
            $removal->remove($dealer);
        } catch (DealerHasCurrentSubscriptionException) {
            return response()->json(['message' => self::MESSAGE_CURRENT_SUBSCRIPTION], 409);
        }

        return response()->noContent();
    }
}
