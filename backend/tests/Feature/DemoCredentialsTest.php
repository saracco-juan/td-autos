<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\DemoDealersSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class DemoCredentialsTest extends TestCase
{
    use RefreshDatabase;

    public function test_seeder_uses_configured_password_without_printing_it(): void
    {
        $password = bin2hex(random_bytes(24));
        config(['demo.password' => $password]);
        Storage::fake(config('filesystems.receipts_disk'));

        $this->assertSame(0, Artisan::call('db:seed', ['--class' => DemoDealersSeeder::class]));

        $this->assertCount(7, User::all());
        foreach (User::all() as $user) {
            $this->assertTrue(Hash::check($password, $user->password));
        }
        $this->assertStringNotContainsString($password, Artisan::output());
    }

    public function test_missing_password_preserves_existing_local_database(): void
    {
        config(['demo.password' => null]);
        $path = tempnam(sys_get_temp_dir(), 'td-demo-');
        file_put_contents($path, 'existing database');

        try {
            $this->artisan('db:local', ['--path' => $path])
                ->expectsOutputToContain('DEMO_PASSWORD')
                ->assertExitCode(1);
            $this->assertSame('existing database', file_get_contents($path));
            $this->assertDatabaseCount('users', 0);
        } finally {
            unlink($path);
        }
    }

    public function test_missing_password_prevents_confirmed_dealer_creation(): void
    {
        config(['demo.password' => '   ']);

        $this->artisan('demo:reales-concesionarias', ['--confirm' => true])
            ->expectsOutputToContain('DEMO_PASSWORD')
            ->assertExitCode(1);

        $this->assertDatabaseCount('users', 0);
        $this->assertDatabaseCount('concesionaria', 0);
    }

    public function test_dry_run_does_not_need_a_password(): void
    {
        config(['demo.password' => null]);

        $this->artisan('demo:reales-concesionarias')->assertExitCode(0);
        $this->assertDatabaseCount('users', 0);
    }
}
