<?php

namespace Tests\Feature;

use App\Models\Concesionaria;
use App\Models\User;
use App\Models\Vehiculo;
use App\Models\VehiculoConcesionaria;
use Database\Seeders\ResaleDemoRepairSeeder;
use Database\Seeders\Support\DemoVehicleFacts;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Tests\TestCase;

class ResaleDemoRepairTest extends TestCase
{
    use RefreshDatabase;

    private function car(string $model = 'C4 Cactus', bool $synthetic = true): Vehiculo
    {
        $user = User::factory()->create(['email' => fake()->unique()->userName().'@demo.tdautos.test']);
        $dealer = Concesionaria::factory()->active()->create(['usuario_id' => $user->id]);
        $cactus = $model === 'C4 Cactus';
        $car = Vehiculo::factory()->create([
            ...DemoVehicleFacts::profile(1, 'nafta'),
            'marca' => $cactus ? 'Citroën' : 'Volkswagen', 'modelo' => $model,
            'version' => $cactus ? 'Feel 1.6' : 'Highline 1.6 AT',
            'anio' => $cactus ? 2021 : 2022, 'kilometraje' => $cactus ? 62200 : 66700,
            'ubicacion' => $cactus ? 'San Rafael' : 'Salta',
            'combustible' => 'nafta', 'transmision' => 'automatica',
            'descripcion' => $synthetic ? DemoVehicleFacts::NOTICE : 'Real dealer listing',
        ]);
        VehiculoConcesionaria::factory()->create(['vehiculo_id' => $car->id, 'concesionaria_id' => $dealer->id]);
        $car->fotos()->create(['ubicacion_archivo' => 'https://example.test/preserved.jpg', 'orden' => 1]);

        return $car->refresh();
    }

    public function test_hu05_repairs_only_explicit_demo_facts_and_is_idempotent(): void
    {
        $car = $this->car();
        $other = Vehiculo::factory()->create();
        $before = $car->getRawOriginal();
        $otherBefore = $other->refresh()->getRawOriginal();
        $ownership = DB::table('vehiculo_concesionaria')->get()->toJson();
        $photos = DB::table('foto_vehiculo')->get()->toJson();
        $this->seed(ResaleDemoRepairSeeder::class);
        $car->refresh();
        $this->assertSame('Feel Pack 1.6 AT', $car->version);
        $this->assertSame('1.6', $car->motor);
        $this->assertEquals(115, $car->potencia);
        $this->assertFalse($car->turbo);
        $changed = ['version', 'motor', 'potencia', 'potencia_unidad', 'turbo', 'descripcion', 'updated_at'];
        $this->assertSame(array_diff_key($before, array_flip($changed)), array_diff_key($car->getRawOriginal(), array_flip($changed)));
        $this->assertSame($otherBefore, $other->fresh()->getRawOriginal());
        $this->assertSame($ownership, DB::table('vehiculo_concesionaria')->get()->toJson());
        $this->assertSame($photos, DB::table('foto_vehiculo')->get()->toJson());
        $this->assertDatabaseCount('vehiculo', 2);
        $once = DB::table('vehiculo')->orderBy('id')->get()->toJson();
        $this->seed(ResaleDemoRepairSeeder::class);
        $this->assertSame($once, DB::table('vehiculo')->orderBy('id')->get()->toJson());
    }

    public function test_hu05_refuses_non_demo_matches_and_rolls_back_the_whole_repair(): void
    {
        $this->car();
        $this->car('Virtus', false);
        $before = DB::table('vehiculo')->orderBy('id')->get()->toJson();
        try {
            $this->seed(ResaleDemoRepairSeeder::class);
            $this->fail('A real listing must never be repaired.');
        } catch (RuntimeException $error) {
            $this->assertStringContainsString('synthetic', $error->getMessage());
        }
        $this->assertSame($before, DB::table('vehiculo')->orderBy('id')->get()->toJson());
    }

    public function test_hu05_refuses_production_even_with_demo_markers(): void
    {
        $car = $this->car();
        $before = $car->getRawOriginal();
        $this->app->instance('env', 'production');
        try {
            Artisan::call('db:seed', ['--class' => ResaleDemoRepairSeeder::class, '--force' => true]);
            $this->fail('Production must never be repaired.');
        } catch (RuntimeException $error) {
            $this->assertStringContainsString('local SQLite', $error->getMessage());
        }
        $this->assertSame($before, $car->fresh()->getRawOriginal());
    }

    public function test_hu05_all_ten_repairs_preserve_identity_and_reject_unknown_owners(): void
    {
        $user = User::factory()->create(['email' => 'fixture@demo.tdautos.test']);
        $dealer = Concesionaria::factory()->active()->create(['usuario_id' => $user->id]);
        foreach (ResaleDemoRepairSeeder::FIXTURES as [$make, $model, $year, $km, $town, $old]) {
            $car = Vehiculo::factory()->create([
                ...DemoVehicleFacts::profile(1, 'nafta'), 'marca' => $make, 'modelo' => $model,
                'anio' => $year, 'kilometraje' => $km, 'ubicacion' => $town, 'version' => $old,
                'combustible' => 'nafta', 'transmision' => 'automatica',
                'descripcion' => "$make $model $old $year. ".DemoVehicleFacts::NOTICE,
            ]);
            VehiculoConcesionaria::factory()->create(['vehiculo_id' => $car->id, 'concesionaria_id' => $dealer->id]);
        }
        $before = DB::table('vehiculo')->orderBy('id')->get()->toJson();
        $user->update(['email' => 'real@example.test']);
        try {
            $this->seed(ResaleDemoRepairSeeder::class);
            $this->fail('Synthetic text alone is not a demo owner.');
        } catch (RuntimeException) {
            $this->assertSame($before, DB::table('vehiculo')->orderBy('id')->get()->toJson());
        }
        $user->update(['email' => 'fixture@demo.tdautos.test']);
        $this->seed(ResaleDemoRepairSeeder::class);
        $this->assertDatabaseCount('vehiculo', 10);
        foreach (ResaleDemoRepairSeeder::FIXTURES as [$make, $model, $year, $km, $town, $old, $version, $engine, $power, $turbo]) {
            $this->assertDatabaseHas('vehiculo', ['marca' => $make, 'modelo' => $model, 'anio' => $year,
                'kilometraje' => $km, 'ubicacion' => $town, 'version' => $version,
                'motor' => $engine, 'potencia' => $power, 'turbo' => $turbo]);
        }
    }
}
