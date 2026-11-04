<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreVehiculoRequest;
use App\Http\Requests\UpdateVehiculoRequest;
use App\Models\FotoVehiculo;
use App\Models\Vehiculo;
use App\Services\Inventario\VehiculoDestroyer;
use App\Support\VehiculoFotos;
use App\Support\VehiculoOptions;
use App\Support\VehiculoPresenter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

/**
 * Inventory of the signed-in dealer. Every query goes through the dealer's own
 * ownership rows; the route group already guarantees an active dealer.
 */
class ConcesionariaVehiculoController extends Controller
{
    public function __construct(private readonly VehiculoDestroyer $destroyer) {}

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
     * One of the dealer's vehicles. A vehicle of another dealer answers 404 like a missing one.
     */
    public function show(Request $request, string $id): JsonResponse
    {
        $vehiculo = $request->user()->concesionaria->vehiculos()->findOrFail($id);

        return response()->json(['vehiculo' => VehiculoPresenter::present($vehiculo)]);
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

    /**
     * Edit one of the dealer's vehicles: its data and its photos. Removed files are deleted only
     * once the change is committed; if it fails, the files stored for the new photos are deleted.
     */
    public function update(UpdateVehiculoRequest $request, string $id): JsonResponse
    {
        $vehiculo = $request->vehiculo();
        $removed = $vehiculo->fotos->whereIn('id', $request->fotosAEliminar());
        $stored = [];

        try {
            DB::transaction(function () use ($request, $vehiculo, $removed, &$stored) {
                $vehiculo->update($request->vehiculoAttributes());
                $vehiculo->propiedad()->update(['patente_normalizada' => $request->validated('patente')]);

                FotoVehiculo::query()->whereIn('id', $removed->modelKeys())->delete();

                $next = (int) $vehiculo->fotos()->reorder()->max('orden') + 1;
                $stored = VehiculoFotos::store($vehiculo, $request->fotosNuevas(), $next);

                foreach ($vehiculo->fotos()->get() as $position => $foto) {
                    $foto->update(['orden' => $position + 1]);
                }
            });
        } catch (\Throwable $e) {
            VehiculoFotos::forget($stored);

            throw $e;
        }

        VehiculoFotos::forget($removed->pluck('ubicacion_archivo')->all());

        return response()->json(['vehiculo' => VehiculoPresenter::present($vehiculo->fresh())]);
    }

    /**
     * Permanently delete one of the dealer's vehicles with its photos and the buyer data that
     * points to it, children first so no foreign key is violated. The stored files go only
     * after the rows are gone.
     */
    public function destroy(Request $request, string $id): Response
    {
        $this->destroyer->destroy($request->user()->concesionaria->vehiculos()->findOrFail($id));

        return response()->noContent();
    }
}
