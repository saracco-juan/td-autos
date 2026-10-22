<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\ForgotPasswordRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Password;

class PasswordResetLinkController extends Controller
{
    public const STATUS_MESSAGE = 'Si existe una cuenta asociada, recibirás instrucciones por email.';

    /**
     * Handle an incoming password reset link request.
     *
     * The response never depends on the broker status (sent, unknown user or throttled),
     * so it cannot be used to discover which emails have an account.
     */
    public function store(ForgotPasswordRequest $request): JsonResponse
    {
        Password::sendResetLink($request->only('email'));

        return response()->json(['status' => self::STATUS_MESSAGE]);
    }
}
