<?php

namespace Database\Seeders;

use App\Models\ComprobantePago;
use App\Models\Concesionaria;
use App\Models\Suscripcion;
use App\Models\User;
use App\Support\PaymentReceipts;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Local demo data for the admin screens (UH19): dealers in every state that exists today.
 * Run with `php artisan db:seed --class=DemoDealersSeeder`. Dealers sign in with DEMO_PASSWORD.
 * Re-running skips dealers whose email already exists.
 */
class DemoDealersSeeder extends Seeder
{
    public const DEMO_PASSWORD = 'TdAutos2026!';

    // 1x1 transparent PNG, enough for the receipt preview.
    private const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

    public function run(): void
    {
        $dealers = [
            ['Autos del Sur', 'sur', 'Córdoba', 'Córdoba', 'pending', 'pdf'],
            ['Rosario Motors', 'rosario', 'Rosario', 'Santa Fe', 'pending', 'png'],
            ['Cuyo Automotores', 'cuyo', 'Mendoza', 'Mendoza', 'pending', 'pdf'],
            ['Norte Usados', 'norte', 'Salta', 'Salta', 'no_receipt', null],
            ['Capital Cars', 'capital', 'CABA', 'Buenos Aires', 'rejected', 'pdf'],
            ['Pampa Autos', 'pampa', 'Santa Rosa', 'La Pampa', 'active', 'pdf'],
            ['Litoral Vehículos', 'litoral', 'Paraná', 'Entre Ríos', 'active', 'png'],
        ];

        $admin = User::where('rol', User::ROL_ADMINISTRADOR)->first();

        foreach ($dealers as [$name, $slug, $city, $province, $case, $format]) {
            $email = "{$slug}@demo.tdautos.test";

            if (User::where('email', $email)->exists()) {
                $this->command?->warn("Skipped {$email}: already exists.");

                continue;
            }

            $dealer = Concesionaria::factory()->create([
                'usuario_id' => User::factory()->dealer()->create([
                    'name' => 'Responsable',
                    'apellido' => $name,
                    'email' => $email,
                    'password' => self::DEMO_PASSWORD,
                ]),
                'nombre' => $name,
                'localidad' => $city,
                'provincia' => $province,
                'estado_alta' => $case === 'active' ? Concesionaria::ESTADO_ACTIVA : Concesionaria::ESTADO_PENDIENTE,
            ]);

            if ($case === 'no_receipt') {
                continue;
            }

            $from = now()->startOfDay();
            $to = $from->copy()->addMonth();

            $subscription = Suscripcion::factory()->create([
                'concesionaria_id' => $dealer->id,
                'estado' => $case === 'active' ? Suscripcion::ESTADO_ACTIVA : Suscripcion::ESTADO_PENDIENTE,
                'vigente_desde' => $from->toDateString(),
                'vigente_hasta' => $case === 'active' ? $to->toDateString() : null,
            ]);

            $decided = in_array($case, ['active', 'rejected'], true);

            ComprobantePago::factory()->create([
                'suscripcion_id' => $subscription->id,
                'periodo_desde' => $from->toDateString(),
                'periodo_hasta' => $to->toDateString(),
                'archivo_url' => $this->storeFile($dealer->id, $format),
                'estado' => match ($case) {
                    'active' => ComprobantePago::ESTADO_APROBADO,
                    'rejected' => ComprobantePago::ESTADO_RECHAZADO,
                    default => ComprobantePago::ESTADO_PENDIENTE_REVISION,
                },
                'motivo_rechazo' => $case === 'rejected' ? 'El monto transferido no coincide con el de la suscripción.' : null,
                'revisado_por_admin_id' => $decided ? $admin?->id : null,
                'fecha_revision' => $decided ? now() : null,
            ]);
        }

        $this->command?->info('Demo dealers ready. Password: '.self::DEMO_PASSWORD);
    }

    private function storeFile(int $dealerId, string $format): string
    {
        $path = "comprobantes/{$dealerId}/".Str::uuid()."/transferencia.{$format}";
        $contents = $format === 'png'
            ? base64_decode(self::PNG)
            : "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n";

        PaymentReceipts::disk()->put($path, $contents);

        return $path;
    }
}
