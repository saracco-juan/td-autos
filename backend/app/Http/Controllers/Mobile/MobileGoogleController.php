<?php

namespace App\Http\Controllers\Mobile;

use App\Http\Controllers\Controller;
use App\Http\Requests\Mobile\GoogleExchangeRequest;
use App\Models\User;
use App\Services\Auth\MobileGoogleCode;
use Illuminate\Http\JsonResponse;

/**
 * Last leg of "Continuar con Google" in the app: swaps the one-time code for an API token.
 */
class MobileGoogleController extends Controller
{
    public const CODE_INVALID = 'code_invalid';

    public const MESSAGE_CODE_INVALID = 'No se pudo completar el ingreso con Google. Intentá nuevamente.';

    public const MESSAGE_RETURN_TO_INVALID = 'La dirección de retorno no es válida.';

    public function exchange(GoogleExchangeRequest $request, MobileGoogleCode $codes): JsonResponse
    {
        $user = $codes->redeem($request->string('code')->toString());

        if ($user === null || $user->rol !== User::ROL_COMPRADOR) {
            return response()->json([
                'code' => self::CODE_INVALID,
                'message' => self::MESSAGE_CODE_INVALID,
            ], 422);
        }

        return response()->json([
            'token' => $user->createToken($request->string('device_name')->toString())->plainTextToken,
            'user' => $user,
        ]);
    }
}
