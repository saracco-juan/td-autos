<?php

namespace Tests\Feature\VehicleDetail;

use App\Models\Concesionaria;
use App\Models\Suscripcion;
use App\Models\TipoCarroceria;
use App\Models\User;
use App\Models\Vehiculo;
use App\Models\VehiculoConcesionaria;
use App\Services\Catalog\FixedAcaraCatalog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class CruzeDepreciationTest extends TestCase
{
    use RefreshDatabase;

    public function test_tc40_projects_an_unlinked_cruze_using_its_body_style(): void
    {
        Http::preventStrayRequests();
        $dealer = Concesionaria::factory()->active()->create();
        Suscripcion::factory()->create(['concesionaria_id' => $dealer->id, 'estado' => 'activa',
            'vigente_hasta' => now()->addMonth()->toDateString()]);
        $vehicle = Vehiculo::factory()->create([
            'marca' => 'Chevrolet', 'modelo' => 'Cruze', 'version' => 'LT 1.4 Turbo MT',
            'anio' => 2018, 'acara_version_id' => null, 'precio' => 20000, 'moneda' => 'USD',
            'tipo_carroceria_id' => TipoCarroceria::where('nombre', 'Sedán')->firstOrFail()->id,
            'motor' => '1.4', 'potencia' => 153, 'potencia_unidad' => 'CV',
            'transmision' => 'manual', 'combustible' => 'nafta', 'turbo' => true,
        ]);
        VehiculoConcesionaria::factory()->create(['vehiculo_id' => $vehicle->id,
            'concesionaria_id' => $dealer->id]);
        Cache::store('catalog')->forever(FixedAcaraCatalog::cacheKey(), [
            'snapshot_id' => 'acara:2026-10-19', 'source_date' => '2026-10-19',
            'fetched_at' => now()->toIso8601String(), 'rows' => [[
                'make' => 'Chevrolet', 'model' => 'Cruze II', 'version' => '1.4T MT LT (153cv) 4Ptas.',
                'version_id' => 'chevrolet/cruze-ii/lt-mt', 'currency' => 'ARS',
                'values' => [2017 => 9216, 2018 => 9600, 2019 => 10000],
            ]],
        ]);
        $before = $vehicle->fresh()->getAttributes();

        $this->actingAs(User::factory()->create(['rol' => User::ROL_COMPRADOR]))
            ->getJson("/api/vehiculos/{$vehicle->id}/depreciacion")->assertOk()
            ->assertJsonPath('projection.current_value', 20000)
            ->assertJsonPath('projection.currency', 'USD')
            ->assertJsonPath('projection.points.0.value', 19200)
            ->assertJsonPath('projection.points.1.value', 17694.72)
            ->assertJsonPath('projection.points.2.value', 16307.45)
            ->assertJsonPath('reference.approximate_model', 'Cruze II')
            ->assertJsonPath('reference.years_used', [2017, 2018, 2019]);

        $this->assertSame($before, $vehicle->fresh()->getAttributes());
        Http::assertNothingSent();
    }
}
