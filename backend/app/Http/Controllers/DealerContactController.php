<?php

namespace App\Http\Controllers;

use App\Http\Requests\UpdateDealerContactRequest;
use App\Services\DealerContact;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class DealerContactController extends Controller
{
    public function show(Request $request, DealerContact $contact): JsonResponse
    {
        return response()->json($contact->show($request->user()));
    }

    public function update(UpdateDealerContactRequest $request, DealerContact $contact): JsonResponse
    {
        return response()->json($contact->update($request->user(), $request->validated('telefono_publico')));
    }
}
