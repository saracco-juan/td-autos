<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\RegisterRequest;
use App\Models\User;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;

class RegisteredUserController extends Controller
{
    /**
     * Handle an incoming registration request.
     */
    public function store(RegisterRequest $request): JsonResponse
    {
        $user = new User($request->safe()->only(['name', 'apellido', 'email', 'password']));
        $user->forceFill(['rol' => User::ROL_COMPRADOR])->save();

        event(new Registered($user));

        Auth::login($user);
        $request->session()->regenerate();

        return response()->json($user->fresh(), 201);
    }
}
