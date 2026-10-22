<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class GuestJsonTest extends TestCase
{
    use RefreshDatabase;

    private function payload(): array
    {
        return [
            'name' => 'Other User',
            'email' => 'other@example.com',
            'password' => 'Abcdef12',
            'password_confirmation' => 'Abcdef12',
        ];
    }

    public function test_authenticated_json_request_to_a_guest_route_gets_409(): void
    {
        $this->actingAs(User::factory()->create());

        $this->postJson('/register', $this->payload())
            ->assertStatus(409)
            ->assertExactJson(['message' => 'Ya existe una sesión iniciada.']);

        $this->assertSame(1, User::count());
    }

    public function test_authenticated_non_json_request_is_still_redirected(): void
    {
        $this->actingAs(User::factory()->create());

        $this->post('/register', $this->payload())->assertRedirect();

        $this->assertSame(1, User::count());
    }
}
