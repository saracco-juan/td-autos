<?php

namespace App\Http\Controllers;

use App\Http\Requests\UpdateDealerProfileRequest;
use App\Services\DealerProfile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class DealerProfileController extends Controller
{
    public function show(Request $request, DealerProfile $profile): JsonResponse
    {
        return response()->json($profile->show($request->user()));
    }

    public function update(UpdateDealerProfileRequest $request, DealerProfile $profile): JsonResponse
    {
        return response()->json($profile->update($request->user(), $request->validated()));
    }
}
