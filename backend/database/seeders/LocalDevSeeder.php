<?php

namespace Database\Seeders;

use App\Models\Concesionaria;
use App\Models\FotoVehiculo;
use App\Models\User;
use App\Models\Vehiculo;
use App\Models\VehiculoConcesionaria;
use App\Support\VehiculoOptions;
use Illuminate\Database\Seeder;

/**
 * Everything a developer needs in a fresh local database: the regular seed data, an admin, a buyer,
 * the demo dealers and a few vehicles for the active ones. Meant for an empty database (see `db:local`).
 */
class LocalDevSeeder extends Seeder
{
    public const ADMIN_EMAIL = 'admin@demo.tdautos.test';

    public const BUYER_EMAIL = 'comprador@demo.tdautos.test';

    private const VEHICLES_PER_DEALER = 2;

    public function run(): void
    {
        $this->call(DatabaseSeeder::class);

        // The admin goes first so DemoDealersSeeder can set the reviewer of decided receipts.
        User::factory()->admin()->create([
            'name' => 'Admin',
            'apellido' => 'Demo',
            'email' => self::ADMIN_EMAIL,
            'password' => DemoDealersSeeder::DEMO_PASSWORD,
        ]);

        User::factory()->create([
            'name' => 'Comprador',
            'apellido' => 'Demo',
            'email' => self::BUYER_EMAIL,
            'password' => DemoDealersSeeder::DEMO_PASSWORD,
        ]);

        $this->call(DemoDealersSeeder::class);

        Concesionaria::where('estado_alta', Concesionaria::ESTADO_ACTIVA)->each(
            fn (Concesionaria $dealer) => $this->seedInventory($dealer),
        );
    }

    /**
     * Photo rows only point at paths: no image files exist, so the pictures show as broken links.
     */
    private function seedInventory(Concesionaria $dealer): void
    {
        for ($i = 0; $i < self::VEHICLES_PER_DEALER; $i++) {
            $vehicle = Vehiculo::factory()->create(['ubicacion' => $dealer->localidad]);

            VehiculoConcesionaria::factory()->create([
                'vehiculo_id' => $vehicle->id,
                'concesionaria_id' => $dealer->id,
            ]);

            for ($order = 1; $order <= VehiculoOptions::FOTOS_MINIMO; $order++) {
                FotoVehiculo::factory()->create(['vehiculo_id' => $vehicle->id, 'orden' => $order]);
            }
        }
    }
}
