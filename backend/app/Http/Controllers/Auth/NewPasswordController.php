<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\ResetPasswordRequest;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;

class NewPasswordController extends Controller
{
    public const STATUS_MESSAGE = 'Tu contraseña fue actualizada. Ingresá con tu nueva contraseña.';

    public const CODE_TOKEN_EXPIRED = 'token_expired';

    public const CODE_TOKEN_INVALID = 'token_invalid';

    public const MESSAGE_TOKEN_EXPIRED = 'El enlace para restablecer tu contraseña expiró. Solicitá uno nuevo.';

    public const MESSAGE_TOKEN_INVALID = 'El enlace para restablecer tu contraseña no es válido. Solicitá uno nuevo.';

    /**
     * Handle an incoming new password request.
     */
    public function store(ResetPasswordRequest $request): JsonResponse
    {
        $credentials = $request->only('email', 'password', 'password_confirmation', 'token');

        // Telling an expired link from an invalid one needs the stored token row,
        // which the broker collapses into a single "invalid token" status.
        $failure = $this->tokenFailure($credentials['email'], $credentials['token']);

        if ($failure !== null) {
            return $this->tokenFailureResponse($failure);
        }

        $status = Password::reset(
            $credentials,
            function ($user) use ($request) {
                $user->forceFill([
                    'password' => Hash::make($request->string('password')),
                    'remember_token' => Str::random(60),
                ])->save();

                event(new PasswordReset($user));
            }
        );

        if ($status !== Password::PASSWORD_RESET) {
            return $this->tokenFailureResponse(self::CODE_TOKEN_INVALID);
        }

        return response()->json(['status' => self::STATUS_MESSAGE]);
    }

    /**
     * Returns the failure code for a link that cannot be used, or null when it is usable.
     * Unknown email, missing row and mismatched token are deliberately indistinguishable.
     */
    private function tokenFailure(string $email, string $token): ?string
    {
        $broker = config('auth.defaults.passwords');

        $record = DB::table(config("auth.passwords.{$broker}.table"))
            ->where('email', $email)
            ->first();

        if ($record === null || ! Hash::check($token, $record->token)) {
            return self::CODE_TOKEN_INVALID;
        }

        $expiresAt = Carbon::parse($record->created_at)
            ->addMinutes((int) config("auth.passwords.{$broker}.expire"));

        return $expiresAt->isPast() ? self::CODE_TOKEN_EXPIRED : null;
    }

    private function tokenFailureResponse(string $code): JsonResponse
    {
        $message = $code === self::CODE_TOKEN_EXPIRED
            ? self::MESSAGE_TOKEN_EXPIRED
            : self::MESSAGE_TOKEN_INVALID;

        return response()->json([
            'code' => $code,
            'message' => $message,
            'errors' => ['token' => [$message]],
        ], 422);
    }
}
