<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\RegisterDealerRequest;
use App\Models\Concesionaria;
use App\Models\User;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class RegisteredDealerController extends Controller
{
    /**
     * Handle an incoming dealer registration request: the account and its
     * dealer are created together, and the dealer waits for admin approval.
     */
    public function store(RegisterDealerRequest $request): JsonResponse
    {
        $user = DB::transaction(function () use ($request) {
            $user = new User($request->safe()->only(['name', 'apellido', 'email', 'password']));
            $user->forceFill(['rol' => User::ROL_CONCESIONARIA])->save();

            $dealer = new Concesionaria($request->safe()->only([
                'responsable_dni',
                'telefono_publico',
                'telefono_responsable',
                'direccion',
                'localidad',
                'provincia',
            ]));
            $dealer->forceFill([
                'usuario_id' => $user->id,
                'nombre' => $request->validated('nombre_concesionaria'),
                'estado_alta' => Concesionaria::ESTADO_PENDIENTE,
                'creada_en' => now(),
            ])->save();

            return $user;
        });

        event(new Registered($user));

        Auth::login($user);
        $request->session()->regenerate();

        return response()->json($user->fresh(), 201);
    }
}
