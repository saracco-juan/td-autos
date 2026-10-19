<?php

namespace App\Http\Controllers\Mobile;

use App\Http\Controllers\Controller;
use App\Http\Requests\Mobile\MobileLoginRequest;
use App\Http\Requests\Mobile\MobileRegisterRequest;
use App\Models\User;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * Token (Sanctum) authentication for the mobile app: stateless, no web session or CSRF.
 */
class MobileAuthController extends Controller
{
    public const CODE_NOT_BUYER = 'not_buyer';

    public const MESSAGE_NOT_BUYER = 'La app es solo para compradores. Si tenés una concesionaria, ingresá desde la web.';

    public function register(MobileRegisterRequest $request): JsonResponse
    {
        $user = new User($request->safe()->only(['name', 'apellido', 'email', 'password']));
        $user->forceFill(['rol' => User::ROL_COMPRADOR])->save();

        event(new Registered($user));

        return $this->tokenResponse($user->fresh(), $request->string('device_name')->toString(), 201);
    }

    public function login(MobileLoginRequest $request): JsonResponse
    {
        $user = $request->authenticateWithoutSession();

        if ($user->rol !== User::ROL_COMPRADOR) {
            return response()->json([
                'code' => self::CODE_NOT_BUYER,
                'message' => self::MESSAGE_NOT_BUYER,
            ], 403);
        }

        return $this->tokenResponse($user, $request->string('device_name')->toString());
    }

    public function logout(Request $request): Response
    {
        $request->user()->currentAccessToken()->delete();

        return response()->noContent();
    }

    private function tokenResponse(User $user, string $deviceName, int $status = 200): JsonResponse
    {
        return response()->json([
            'token' => $user->createToken($deviceName)->plainTextToken,
            'user' => $user,
        ], $status);
    }
}
