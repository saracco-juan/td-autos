<?php

namespace Tests\Feature\RealDemo;

use App\Models\Concesionaria;
use App\Models\User;
use Database\Seeders\DemoDealersSeeder;
use Database\Seeders\RealDemo\RealDemoInventory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * UH-05 demo data: `demo:reales-concesionarias` creates only the ten demo dealers in the current
 * database, so a deployed environment can receive the XLSX imports.
 */
class RealDemoDealersCommandTest extends TestCase
{
    use RefreshDatabase;

    private function reales(): Builder
    {
        return User::query()->where('email', 'like', '%@reales.tdautos.test');
    }

    public function test_without_confirm_it_only_lists_what_it_would_create(): void
    {
        $this->artisan('demo:reales-concesionarias')
            ->expectsOutputToContain('--confirm')
            ->expectsOutputToContain('sqlite')
            ->expectsOutputToContain('autos-del-plata')
            ->assertExitCode(0);

        $this->assertSame(0, $this->reales()->count());
        $this->assertSame(0, Concesionaria::query()->count());
    }

    public function test_confirm_creates_ten_active_dealers_that_can_log_in_with_an_active_subscription(): void
    {
        $this->artisan('demo:reales-concesionarias', ['--confirm' => true])
            ->expectsOutputToContain('contraseña de demo: la de DemoDealersSeeder')
            ->assertExitCode(0);

        $this->assertSame(10, $this->reales()->count());
        foreach (RealDemoInventory::DEALERS as $dealer) {
            $user = User::query()->where('email', $dealer['slug'].'@reales.tdautos.test')->firstOrFail();
            $this->assertSame(User::ROL_CONCESIONARIA, $user->rol);
            $this->assertNotNull($user->email_verified_at);
            $this->assertTrue(Hash::check(DemoDealersSeeder::DEMO_PASSWORD, $user->password));

            $row = Concesionaria::query()->where('usuario_id', $user->id)->firstOrFail();
            $this->assertSame(Concesionaria::ESTADO_ACTIVA, $row->estado_alta);
            $this->assertSame([$dealer['nombre'], $dealer['localidad'], $dealer['provincia'], $dealer['direccion']], [$row->nombre, $row->localidad, $row->provincia, $row->direccion]);
            $this->assertNotEmpty($row->telefono_publico);
            $this->assertNotEmpty($row->responsable_dni);
            $this->assertTrue(DB::table('suscripcion')->where('concesionaria_id', $row->id)->where('estado', 'activa')->where('vigente_hasta', '>=', now()->addMonths(11)->toDateString())->exists());
            $this->assertTrue(auth()->validate(['email' => $user->email, 'password' => DemoDealersSeeder::DEMO_PASSWORD]));
        }
        $this->assertSame(0, DB::table('vehiculo')->count());
    }

    public function test_running_it_twice_creates_nothing_new_and_never_updates_an_existing_dealer(): void
    {
        $this->artisan('demo:reales-concesionarias', ['--confirm' => true])->assertExitCode(0);
        $first = User::query()->where('email', 'sur-motors@reales.tdautos.test')->firstOrFail();
        Concesionaria::query()->where('usuario_id', $first->id)->update(['nombre' => 'Renombrada']);

        $this->artisan('demo:reales-concesionarias', ['--confirm' => true])
            ->expectsOutputToContain('skipped')
            ->assertExitCode(0);

        $this->assertSame(10, $this->reales()->count());
        $this->assertSame(10, Concesionaria::query()->count());
        $this->assertSame(10, DB::table('suscripcion')->count());
        $this->assertSame('Renombrada', Concesionaria::query()->where('usuario_id', $first->id)->value('nombre'));
    }

    public function test_it_creates_only_the_missing_dealers(): void
    {
        $this->artisan('demo:reales-concesionarias', ['--confirm' => true])->assertExitCode(0);
        $user = User::query()->where('email', 'cuyo-vehiculos@reales.tdautos.test')->firstOrFail();
        $id = Concesionaria::query()->where('usuario_id', $user->id)->value('id');
        DB::table('suscripcion')->where('concesionaria_id', $id)->delete();
        Concesionaria::query()->where('usuario_id', $user->id)->delete();
        $user->delete();

        $this->artisan('demo:reales-concesionarias', ['--confirm' => true])->assertExitCode(0);

        $this->assertSame(10, $this->reales()->count());
    }

    public function test_it_refuses_to_run_in_production(): void
    {
        $this->app->detectEnvironment(fn () => 'production');

        $this->artisan('demo:reales-concesionarias', ['--confirm' => true])
            ->expectsOutputToContain('disabled in production')
            ->assertExitCode(1);

        $this->assertSame(0, $this->reales()->count());
    }
}
