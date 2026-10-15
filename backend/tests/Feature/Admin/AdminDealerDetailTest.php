<?php

namespace Tests\Feature\Admin;

use App\Models\ComprobantePago;
use App\Models\Concesionaria;
use App\Models\Suscripcion;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * UH27 (RF32, RF33, CU-25, TC-69): the administrator opens a dealer, reads all of its data,
 * subscription and receipts, and edits the data.
 */
class AdminDealerDetailTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->admin()->create();
    }

    private function dealer(): Concesionaria
    {
        $user = User::factory()->dealer()->create([
            'name' => 'Marta',
            'apellido' => 'Gómez',
            'email' => 'marta@autos.test',
            'password' => Hash::make('Secret-123!'),
        ]);

        return Concesionaria::factory()->active()->create([
            'usuario_id' => $user->id,
            'nombre' => 'Gómez Autos',
            'responsable_dni' => '30111222',
            'telefono_publico' => '351 400-1000',
            'telefono_responsable' => '351 155-123456',
            'direccion' => 'Av. Colón 100',
            'localidad' => 'Córdoba',
            'provincia' => 'Córdoba',
        ]);
    }

    private function url(Concesionaria|int $dealer): string
    {
        return '/api/admin/concesionarias/'.($dealer instanceof Concesionaria ? $dealer->id : $dealer);
    }

    /**
     * @return array<string, string>
     */
    private function validPayload(): array
    {
        return [
            'nombre' => 'Nuevo Nombre SA',
            'responsable_nombre' => 'Lucía',
            'responsable_apellido' => 'Pérez',
            'responsable_dni' => '28999888',
            'telefono_responsable' => '351 155-999999',
            'telefono_publico' => '351 422-2222',
            'email' => 'lucia@nuevo.test',
            'direccion' => 'Bv. San Juan 55',
            'localidad' => 'Rosario',
            'provincia' => 'Santa Fe',
        ];
    }

    public function test_tc69_detail_returns_all_data_subscription_and_receipts_newest_first(): void
    {
        $dealer = $this->dealer();
        $subscription = Suscripcion::factory()->create([
            'concesionaria_id' => $dealer->id,
            'estado' => Suscripcion::ESTADO_ACTIVA,
            'vigente_desde' => '2026-09-14',
            'vigente_hasta' => '2026-10-14',
        ]);
        $first = ComprobantePago::factory()->create([
            'suscripcion_id' => $subscription->id,
            'estado' => ComprobantePago::ESTADO_APROBADO,
            'periodo_desde' => '2026-09-14',
            'periodo_hasta' => '2026-10-14',
            'fecha_de_pago' => '2026-09-14 10:00:00',
            'fecha_revision' => '2026-09-15 09:00:00',
        ]);
        $second = ComprobantePago::factory()->create([
            'suscripcion_id' => $subscription->id,
            'estado' => ComprobantePago::ESTADO_PENDIENTE_REVISION,
            'periodo_desde' => '2026-10-14',
            'periodo_hasta' => '2026-11-14',
            'fecha_de_pago' => '2026-10-14 10:00:00',
        ]);

        $this->travelTo('2026-10-01 10:00:00');
        $response = $this->actingAs($this->admin())->getJson($this->url($dealer))->assertOk();

        $response->assertJsonPath('id', $dealer->id);
        $response->assertJsonPath('nombre', 'Gómez Autos');
        $response->assertJsonPath('responsable_nombre', 'Marta');
        $response->assertJsonPath('responsable_apellido', 'Gómez');
        $response->assertJsonPath('responsable_dni', '30111222');
        $response->assertJsonPath('telefono_responsable', '351 155-123456');
        $response->assertJsonPath('telefono_publico', '351 400-1000');
        $response->assertJsonPath('email', 'marta@autos.test');
        $response->assertJsonPath('direccion', 'Av. Colón 100');
        $response->assertJsonPath('localidad', 'Córdoba');
        $response->assertJsonPath('provincia', 'Córdoba');
        $response->assertJsonPath('estado_alta', Concesionaria::ESTADO_ACTIVA);
        $response->assertJsonPath('suscripcion', [
            'estado' => Suscripcion::ESTADO_ACTIVA,
            'vigente_desde' => '2026-09-14',
            'vigente_hasta' => '2026-10-14',
            'gracia_hasta' => '2026-10-17',
            'retencion_hasta' => null,
        ]);
        $this->assertSame([$second->id, $first->id], array_column($response->json('comprobantes'), 'id'));
        $response->assertJsonPath('comprobantes.0', [
            'id' => $second->id,
            'tipo' => 'renovacion',
            'estado' => ComprobantePago::ESTADO_PENDIENTE_REVISION,
            'periodo_desde' => '2026-10-14',
            'periodo_hasta' => '2026-11-14',
            'enviado_en' => $second->fecha_de_pago->toIso8601String(),
            'motivo_rechazo' => null,
            'fecha_revision' => null,
        ]);
        $response->assertJsonPath('comprobantes.1.tipo', 'alta');
        $response->assertJsonPath('comprobantes.1.fecha_revision', $first->fecha_revision->toIso8601String());
        $response->assertJsonMissingPath('password');
    }

    public function test_tc69_detail_of_a_dealer_without_subscription_has_null_subscription_and_no_receipts(): void
    {
        $dealer = $this->dealer();

        $this->actingAs($this->admin())->getJson($this->url($dealer))
            ->assertOk()
            ->assertJsonPath('suscripcion', null)
            ->assertJsonPath('comprobantes', []);
    }

    public function test_unknown_dealer_answers_404_with_a_spanish_message_on_both_endpoints(): void
    {
        $admin = $this->admin();

        $this->actingAs($admin)->getJson($this->url(9999))
            ->assertNotFound()
            ->assertJsonPath('message', 'No encontramos la concesionaria.');
        $this->actingAs($admin)->putJson($this->url(9999), $this->validPayload())
            ->assertNotFound()
            ->assertJsonPath('message', 'No encontramos la concesionaria.');
    }

    /**
     * @return array<string, array{string}>
     */
    public static function methods(): array
    {
        return ['show' => ['getJson'], 'update' => ['putJson']];
    }

    #[DataProvider('methods')]
    public function test_guests_are_unauthenticated(string $method): void
    {
        $this->{$method}($this->url($this->dealer()), $this->validPayload())->assertUnauthorized();
    }

    #[DataProvider('methods')]
    public function test_buyers_and_dealers_are_forbidden_even_for_unknown_ids(string $method): void
    {
        $dealer = $this->dealer();
        $buyer = User::factory()->create();

        foreach ([$this->url($dealer), $this->url(9999)] as $url) {
            $this->actingAs($buyer)->{$method}($url, $this->validPayload())->assertForbidden();
            $this->actingAs($dealer->usuario)->{$method}($url, $this->validPayload())->assertForbidden();
        }
    }

    public function test_tc69_update_persists_dealer_and_user_data_and_returns_the_detail(): void
    {
        $dealer = $this->dealer();
        $user = $dealer->usuario;
        $passwordHash = $user->password;
        $admin = $this->admin();

        $response = $this->actingAs($admin)->putJson($this->url($dealer), $this->validPayload())
            ->assertOk();

        $dealer->refresh();
        $user->refresh();
        $this->assertSame('Nuevo Nombre SA', $dealer->nombre);
        $this->assertSame('28999888', $dealer->responsable_dni);
        $this->assertSame('351 155-999999', $dealer->telefono_responsable);
        $this->assertSame('351 422-2222', $dealer->telefono_publico);
        $this->assertSame('Bv. San Juan 55', $dealer->direccion);
        $this->assertSame('Rosario', $dealer->localidad);
        $this->assertSame('Santa Fe', $dealer->provincia);
        $this->assertSame('Lucía', $user->name);
        $this->assertSame('Pérez', $user->apellido);
        $this->assertSame('lucia@nuevo.test', $user->email);

        $this->assertSame($passwordHash, $user->password);
        $this->assertSame(User::ROL_CONCESIONARIA, $user->rol);
        $this->assertSame(Concesionaria::ESTADO_ACTIVA, $dealer->estado_alta);

        $response->assertJsonPath('nombre', 'Nuevo Nombre SA');
        $response->assertJsonPath('responsable_nombre', 'Lucía');
        $response->assertJsonPath('email', 'lucia@nuevo.test');
        $response->assertJsonPath('estado_alta', Concesionaria::ESTADO_ACTIVA);
        $response->assertJsonPath('suscripcion', null);
        $response->assertJsonPath('comprobantes', []);
        $this->assertSame($this->actingAs($admin)->getJson($this->url($dealer))->json(), $response->json());
    }

    public function test_update_accepts_the_dealers_own_email_and_normalizes_it(): void
    {
        $dealer = $this->dealer();

        $this->actingAs($this->admin())
            ->putJson($this->url($dealer), [...$this->validPayload(), 'email' => '  MARTA@autos.test '])
            ->assertOk()
            ->assertJsonPath('email', 'marta@autos.test');
    }

    /**
     * @return array<string, array{array<string, string>, string, string}>
     */
    public static function invalidPayloads(): array
    {
        return [
            'missing nombre' => [['nombre' => ''], 'nombre', 'El nombre de la concesionaria es obligatorio.'],
            'nombre too long' => [['nombre' => str_repeat('a', 151)], 'nombre', 'El nombre de la concesionaria no puede superar los 150 caracteres.'],
            'missing responsable_nombre' => [['responsable_nombre' => ''], 'responsable_nombre', 'El nombre del responsable es obligatorio.'],
            'responsable_nombre too long' => [['responsable_nombre' => str_repeat('a', 256)], 'responsable_nombre', 'El nombre del responsable no puede superar los 255 caracteres.'],
            'missing responsable_apellido' => [['responsable_apellido' => ''], 'responsable_apellido', 'El apellido es obligatorio.'],
            'responsable_apellido too long' => [['responsable_apellido' => str_repeat('a', 101)], 'responsable_apellido', 'El apellido no puede superar los 100 caracteres.'],
            'missing dni' => [['responsable_dni' => ''], 'responsable_dni', 'El DNI es obligatorio.'],
            'dni too long' => [['responsable_dni' => str_repeat('1', 21)], 'responsable_dni', 'El DNI no puede superar los 20 caracteres.'],
            'missing telefono_publico' => [['telefono_publico' => ''], 'telefono_publico', 'El teléfono de la concesionaria es obligatorio.'],
            'telefono_responsable too long' => [['telefono_responsable' => str_repeat('1', 31)], 'telefono_responsable', 'El teléfono del responsable no puede superar los 30 caracteres.'],
            'missing direccion' => [['direccion' => ''], 'direccion', 'La dirección es obligatoria.'],
            'direccion too long' => [['direccion' => str_repeat('a', 256)], 'direccion', 'La dirección no puede superar los 255 caracteres.'],
            'missing localidad' => [['localidad' => ''], 'localidad', 'La localidad es obligatoria.'],
            'provincia too long' => [['provincia' => str_repeat('a', 101)], 'provincia', 'La provincia no puede superar los 100 caracteres.'],
            'missing email' => [['email' => ''], 'email', 'El email es obligatorio.'],
            'invalid email' => [['email' => 'not-an-email'], 'email', 'El email no tiene un formato válido.'],
            'email too long' => [['email' => str_repeat('a', 250).'@x.test'], 'email', 'El email no puede superar los 255 caracteres.'],
            'taken email' => [['email' => 'taken@autos.test'], 'email', 'Ese email ya está en uso.'],
        ];
    }

    /**
     * @param  array<string, string>  $override
     */
    #[DataProvider('invalidPayloads')]
    public function test_tc69_invalid_data_is_rejected_and_nothing_is_saved(array $override, string $field, string $message): void
    {
        User::factory()->create(['email' => 'taken@autos.test']);
        $dealer = $this->dealer();

        $this->actingAs($this->admin())
            ->putJson($this->url($dealer), [...$this->validPayload(), ...$override])
            ->assertUnprocessable()
            ->assertJsonPath("errors.{$field}.0", $message);

        $dealer->refresh();
        $this->assertSame('Gómez Autos', $dealer->nombre);
        $this->assertSame('Córdoba', $dealer->localidad);
        $this->assertSame('marta@autos.test', $dealer->usuario->fresh()->email);
        $this->assertSame('Marta', $dealer->usuario->fresh()->name);
    }

    public function test_update_requires_every_field(): void
    {
        $dealer = $this->dealer();

        $this->actingAs($this->admin())->putJson($this->url($dealer), [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(array_keys($this->validPayload()));
    }
}
