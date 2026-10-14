<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreVehiculoRequest;
use App\Http\Requests\UpdateVehiculoRequest;
use App\Models\FotoVehiculo;
use App\Models\Vehiculo;
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
    /**
     * Checklists of a vehicle: table => [table of its completed marks, column that points back].
     *
     * @var array<string, array{string, string}>
     */
    private const CHECKLISTS = [
        'checklist_inspeccion' => ['item_inspeccion_completado', 'checklist_id'],
        'checklist_transferencia' => ['etapa_transferencia_completada', 'seguimiento_id'],
    ];

    /**
     * Other tables with a `vehiculo_id` foreign key, emptied for a deleted vehicle.
     *
     * @var list<string>
     */
    private const VEHICLE_DEPENDENTS = ['favorito', 'recomendacion', 'publicacion_externa', 'foto_vehiculo'];

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
        $vehiculo = $request->user()->concesionaria->vehiculos()->with('fotos')->findOrFail($id);
        $paths = $vehiculo->fotos->pluck('ubicacion_archivo')->all();

        DB::transaction(function () use ($vehiculo) {
            foreach (self::CHECKLISTS as $table => [$marks, $foreignKey]) {
                $checklists = DB::table($table)->where('vehiculo_id', $vehiculo->id);
                DB::table($marks)->whereIn($foreignKey, (clone $checklists)->select('id'))->delete();
                $checklists->delete();
            }

            foreach (self::VEHICLE_DEPENDENTS as $table) {
                DB::table($table)->where('vehiculo_id', $vehiculo->id)->delete();
            }

            DB::table('lead')->where('vehiculo_concesionaria_id', $vehiculo->id)->delete();
            $vehiculo->propiedad()->delete();
            $vehiculo->delete();
        });

        VehiculoFotos::forget($paths);

        return response()->noContent();
    }
}
