<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreVehiculoRequest;
use App\Models\Vehiculo;
use App\Support\VehiculoFotos;
use App\Support\VehiculoOptions;
use App\Support\VehiculoPresenter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Inventory of the signed-in dealer. Every query goes through the dealer's own
 * ownership rows; the route group already guarantees an active dealer.
 */
class ConcesionariaVehiculoController extends Controller
{
    /**
     * The dealer's vehicles, newest first.
     */
    public function index(Request $request): JsonResponse
    {
        $vehiculos = $request->user()->concesionaria->vehiculos()
            ->with(VehiculoPresenter::RELATIONS)
            ->orderByDesc('vehiculo.id')
            ->get();

        return response()->json([
            'vehiculos' => $vehiculos->map(VehiculoPresenter::present(...))->all(),
        ]);
    }

    /**
     * Load a new vehicle with its photos. If anything fails after the files were stored,
     * the files are deleted so no orphans remain.
     */
    public function store(StoreVehiculoRequest $request): JsonResponse
    {
        $dealer = $request->user()->concesionaria;
        $stored = [];

        try {
            $vehiculo = DB::transaction(function () use ($request, $dealer, &$stored) {
                $vehiculo = Vehiculo::create([
                    ...$request->vehiculoAttributes(),
                    'origen' => VehiculoOptions::ORIGEN_CONCESIONARIA,
                    'moneda' => VehiculoOptions::MONEDA,
                ]);

                $vehiculo->propiedad()->create([
                    'concesionaria_id' => $dealer->id,
                    'patente_normalizada' => $request->validated('patente'),
                    'visible' => true,
                ]);

                $stored = VehiculoFotos::store($vehiculo, $request->file('fotos'));

                return $vehiculo;
            });
        } catch (\Throwable $e) {
            VehiculoFotos::forget($stored);

            throw $e;
        }

        return response()->json(['vehiculo' => VehiculoPresenter::present($vehiculo)], 201);
    }
}
