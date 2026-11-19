<?php

namespace Tests\Feature\Concesionaria;

use App\Models\Concesionaria;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DealerProfileTest extends TestCase
{
    use RefreshDatabase;

    private const ENDPOINT = '/api/concesionaria/perfil';

    private function values(): array
    {
        return [
            'telefono_publico' => '+54 (9) 11 5555-0101',
            'direccion' => 'Av. Libertador 2450',
            'localidad' => 'Vicente López',
            'provincia' => 'Buenos Aires',
            'responsable_nombre' => 'Ana',
            'responsable_apellido' => 'Pérez',
            'responsable_dni' => '30123456',
            'telefono_responsable' => '11 5555-0202',
        ];
    }

    public function test_owner_can_read_and_update_all_editable_fields_even_while_pending(): void
    {
        $dealer = Concesionaria::factory()->create()->fresh();
        $other = Concesionaria::factory()->create()->fresh();
        $otherData = $other->getAttributes();
        $owner = $dealer->usuario;
        $protected = $owner->only(['email', 'password', 'rol']);
        $this->actingAs($owner)->getJson(self::ENDPOINT)->assertOk()
            ->assertJsonPath('nombre', $dealer->nombre)->assertJsonPath('email', $owner->email)
            ->assertJsonPath('responsable_nombre', $owner->name)
            ->assertJsonMissingPath('password');

        $this->putJson(self::ENDPOINT, [...$this->values(), 'usuario_id' => $other->usuario_id,
            'concesionaria_id' => $other->id, 'rol' => 'administrador', 'password' => 'changed'])
            ->assertOk()->assertJsonPath('telefono_publico', '5491155550101')
            ->assertJsonPath('responsable_nombre', 'Ana')->assertJsonPath('nombre', $dealer->nombre);

        $saved = $dealer->fresh();
        foreach (['direccion', 'localidad', 'provincia', 'responsable_dni', 'telefono_responsable'] as $field) {
            $this->assertSame($this->values()[$field], $saved->$field);
        }
        $this->assertSame('5491155550101', $saved->telefono_publico);
        $this->assertSame($dealer->usuario_id, $saved->usuario_id);
        $this->assertSame($dealer->estado_alta, $saved->estado_alta);
        $this->assertSame('Ana', $owner->fresh()->name);
        $this->assertSame('Pérez', $owner->fresh()->apellido);
        $this->assertSame($protected, $owner->fresh()->only(array_keys($protected)));
        $this->assertSame($otherData, $other->fresh()->getAttributes());
        $this->actingAs($owner)->getJson(self::ENDPOINT)->assertJsonPath('localidad', 'Vicente López');
    }

    public function test_locked_identity_and_invalid_fields_are_rejected_without_partial_writes(): void
    {
        $dealer = Concesionaria::factory()->create()->fresh();
        $owner = $dealer->usuario;
        $this->actingAs($owner);
        foreach (['nombre' => 'Another dealer', 'email' => 'another@example.com',
            'direccion' => '', 'localidad' => '', 'provincia' => '', 'responsable_nombre' => '',
            'responsable_apellido' => '', 'responsable_dni' => '', 'telefono_responsable' => '',
            'telefono_publico' => '123'] as $field => $invalid) {
            $this->putJson(self::ENDPOINT, [...$this->values(), $field => $invalid])
                ->assertUnprocessable()->assertJsonValidationErrors($field);
            $this->assertSame($dealer->getAttributes(), $dealer->fresh()->getAttributes());
            $this->assertSame($owner->getAttributes(), $owner->fresh()->getAttributes());
        }
    }

    public function test_public_phone_can_be_cleared_without_affecting_responsible_phone(): void
    {
        $dealer = Concesionaria::factory()->create()->fresh();
        $this->actingAs($dealer->usuario)->putJson(self::ENDPOINT, [...$this->values(), 'telefono_publico' => ''])
            ->assertOk()->assertJsonPath('telefono_publico', null);
        $this->assertNull($dealer->fresh()->telefono_publico);
        $this->assertSame('11 5555-0202', $dealer->fresh()->telefono_responsable);
    }

    public function test_profile_requires_an_authenticated_owner(): void
    {
        $dealer = Concesionaria::factory()->create()->fresh();
        $this->getJson(self::ENDPOINT)->assertUnauthorized();
        $this->putJson(self::ENDPOINT, $this->values())->assertUnauthorized();
        foreach (['comprador', 'administrador', 'concesionaria'] as $role) {
            $this->actingAs(User::factory()->create(['rol' => $role]));
            $this->getJson(self::ENDPOINT)->assertForbidden();
            $this->putJson(self::ENDPOINT, [...$this->values(), 'concesionaria_id' => $dealer->id])->assertForbidden();
        }
        $this->assertSame($dealer->getAttributes(), $dealer->fresh()->getAttributes());
    }

    public function test_failed_responsible_update_rolls_back_the_dealership_changes(): void
    {
        $dealer = Concesionaria::factory()->create()->fresh();
        $owner = $dealer->usuario;
        $originalOwner = $owner->getAttributes();
        $this->actingAs($owner);
        User::saving(function () {
            throw new \RuntimeException('Injected persistence failure');
        });

        $this->putJson(self::ENDPOINT, $this->values())->assertStatus(500);

        $this->assertSame($dealer->getAttributes(), $dealer->fresh()->getAttributes());
        $this->assertSame($originalOwner, $owner->fresh()->getAttributes());
    }
}
