<?php

namespace Database\Seeders;

use App\Models\Concesionaria;
use App\Models\TipoCarroceria;
use App\Models\User;
use App\Models\Vehiculo;
use App\Models\VehiculoConcesionaria;
use App\Support\VehiculoFotos;
use App\Support\VehiculoOptions;
use Database\Seeders\Support\DemoVehicleFacts;
use Illuminate\Database\Seeder;
use Illuminate\Http\UploadedFile;

/**
 * Everything a developer needs in a fresh local database: the regular seed data, an admin, a buyer,
 * the demo dealers and a few vehicles for the active ones. Meant for an empty database (see `db:local`).
 */
class LocalDevSeeder extends Seeder
{
    public const ADMIN_EMAIL = 'admin@demo.tdautos.test';

    public const BUYER_EMAIL = 'comprador@demo.tdautos.test';

    private const VEHICLES = [
        [
            'marca' => 'Chevrolet', 'modelo' => 'Onix', 'version' => 'LT', 'body' => 'Hatchback',
            'transmision' => 'manual', 'precio' => 18000000, 'gallery' => 'chevrolet-onix',
        ],
        [
            'marca' => 'Toyota', 'modelo' => 'Corolla', 'version' => 'XEi', 'body' => 'Sedán',
            'transmision' => 'automatica', 'precio' => 24000000, 'gallery' => 'toyota-corolla',
        ],
    ];

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

    private function seedInventory(Concesionaria $dealer): void
    {
        foreach (self::VEHICLES as $index => $sample) {
            $vehicle = Vehiculo::create([
                'origen' => VehiculoOptions::ORIGEN_CONCESIONARIA,
                'marca' => $sample['marca'],
                'modelo' => $sample['modelo'],
                'version' => $sample['version'],
                'anio' => 2019,
                'kilometraje' => 45000 + $dealer->id * 1000 + $index * 10000,
                'precio' => $sample['precio'],
                'moneda' => VehiculoOptions::MONEDA,
                'transmision' => $sample['transmision'],
                'combustible' => 'nafta',
                'tipo_carroceria_id' => TipoCarroceria::where('nombre', $sample['body'])->sole()->id,
                'ubicacion' => $dealer->localidad,
                'descripcion' => DemoVehicleFacts::NOTICE.' Imágenes sintéticas.',
                ...DemoVehicleFacts::profile($index, 'nafta'),
            ]);

            VehiculoConcesionaria::create([
                'vehiculo_id' => $vehicle->id,
                'concesionaria_id' => $dealer->id,
                'patente_normalizada' => sprintf('D%s%03dAA', chr(65 + $index), $dealer->id),
                'visible' => true,
            ]);

            $files = [];
            for ($order = 1; $order <= VehiculoOptions::FOTOS_MINIMO; $order++) {
                $path = database_path("seeders/assets/demo-vehicles/{$sample['gallery']}/{$order}.png");
                $files[] = new UploadedFile($path, "{$order}.png", 'image/png', null, true);
            }
            // Reuse upload storage so each car owns independent files, even for a shared gallery.
            VehiculoFotos::store($vehicle, $files);
        }
    }
}
