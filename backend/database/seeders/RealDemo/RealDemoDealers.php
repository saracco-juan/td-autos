<?php

namespace Database\Seeders\RealDemo;

use App\Models\Concesionaria;
use App\Models\Suscripcion;
use App\Models\User;
use Database\Seeders\DemoDealersSeeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * Creates the ten demo dealers of the real demo data (UH-05) in the current database connection:
 * an account, an active dealer and an active one-year subscription each. Query Builder only, so it
 * runs the same on SQLite and PostgreSQL.
 */
final class RealDemoDealers
{
    public const EMAIL_DOMAIN = 'reales.tdautos.test';

    public static function email(string $slug): string
    {
        return $slug.'@'.self::EMAIL_DOMAIN;
    }

    /**
     * Whether a dealer's account already exists.
     */
    public function exists(string $slug): bool
    {
        return DB::table('users')->where('email', self::email($slug))->exists();
    }

    /**
     * Creates every dealer, in one transaction. With $skipExisting a dealer whose email is taken is left
     * untouched; without it the unique email makes the whole call fail.
     *
     * @return array<string, array{id: int|null, created: bool}> by slug
     */
    public function create(bool $skipExisting = false): array
    {
        // One hash for every account: hashing ten times would only slow the load down.
        $password = Hash::make(DemoDealersSeeder::DEMO_PASSWORD);
        $now = now();
        $result = [];

        DB::transaction(function () use (&$result, $password, $now, $skipExisting) {
            foreach (RealDemoInventory::DEALERS as $index => $dealer) {
                if ($skipExisting && $this->exists($dealer['slug'])) {
                    $result[$dealer['slug']] = ['id' => null, 'created' => false];

                    continue;
                }

                $userId = DB::table('users')->insertGetId([
                    'name' => 'Responsable',
                    'apellido' => $dealer['nombre'],
                    'email' => self::email($dealer['slug']),
                    'email_verified_at' => $now,
                    'password' => $password,
                    'rol' => User::ROL_CONCESIONARIA,
                    'activo' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);

                $dealerId = DB::table('concesionaria')->insertGetId([
                    'usuario_id' => $userId,
                    'nombre' => $dealer['nombre'],
                    'responsable_dni' => (string) (30000000 + 111111 * ($index + 1)),
                    'telefono_publico' => $dealer['telefono'],
                    'telefono_responsable' => $dealer['telefono'],
                    'direccion' => $dealer['direccion'],
                    'localidad' => $dealer['localidad'],
                    'provincia' => $dealer['provincia'],
                    'estado_alta' => Concesionaria::ESTADO_ACTIVA,
                    'creada_en' => $now,
                ]);

                DB::table('suscripcion')->insert([
                    'concesionaria_id' => $dealerId,
                    'estado' => Suscripcion::ESTADO_ACTIVA,
                    'vigente_desde' => $now->toDateString(),
                    'vigente_hasta' => $now->copy()->addYear()->toDateString(),
                ]);

                $result[$dealer['slug']] = ['id' => $dealerId, 'created' => true];
            }
        });

        return $result;
    }
}
