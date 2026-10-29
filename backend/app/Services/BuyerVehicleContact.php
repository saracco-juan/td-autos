<?php

namespace App\Services;

use App\Models\Concesionaria;
use App\Models\User;
use App\Models\Vehiculo;
use App\Services\Subscription\SubscriptionLifecycle;
use App\Support\VehiculoOptions;
use Illuminate\Support\Facades\DB;

final class BuyerVehicleContact
{
    public function __construct(private readonly SubscriptionLifecycle $lifecycle) {}

    public function number(Concesionaria $dealer): ?string
    {
        $number = preg_replace('/[\s()+-]/u', '', $dealer->telefono_publico ?? '');

        return preg_match('/^[1-9][0-9]{7,14}$/D', $number) === 1
            && in_array($number, config('whatsapp.confirmed_numbers', []), true) ? $number : null;
    }

    public function create(User $buyer, int $vehicleId, ?string $attemptId = null): string
    {
        $vehicle = Vehiculo::query()->whereKey($vehicleId)
            ->where('origen', VehiculoOptions::ORIGEN_CONCESIONARIA)
            ->whereHas('propiedad', fn ($query) => $query->where('visible', true)
                ->whereIn('concesionaria_id', $this->lifecycle->operativeDealerIds(now())))
            ->with('propiedad.concesionaria')->first();
        abort_if($vehicle === null, 404, 'Esta publicación ya no está disponible.');
        $dealer = $vehicle->propiedad->concesionaria;
        $number = $this->number($dealer);
        abort_if($number === null, 409, 'WhatsApp no disponible');

        $name = trim($buyer->name.' '.$buyer->apellido);
        $title = implode(' ', array_filter([$vehicle->marca, $vehicle->modelo, $vehicle->version, $vehicle->anio]));
        $details = [];
        if ($vehicle->kilometraje !== null) {
            $details[] = number_format($vehicle->kilometraje, 0, ',', '.').' km';
        }
        if ($vehicle->propiedad->patente_normalizada) {
            $details[] = 'patente '.$vehicle->propiedad->patente_normalizada;
        }
        $facts = $details === [] ? '' : ', con '.implode(' y ', $details);
        $message = "¿Qué tal? Mi nombre es {$name}. Me interesa el {$title}{$facts}. Quisiera recibir más información.";

        // RF30 / TC66: persist before returning the link; sending in WhatsApp is independent.
        DB::transaction(function () use ($buyer, $vehicle, $attemptId) {
            // The unique marker and lead commit together, even with concurrent retries.
            if ($attemptId !== null && ! DB::table('cache')->insertOrIgnore([
                'key' => 'whatsapp-contact:'.hash('sha256', $buyer->id.':'.$vehicle->id.':'.strtolower($attemptId)),
                'value' => serialize(true),
                'expiration' => now()->addDay()->getTimestamp(),
            ])) {
                return;
            }
            DB::table('lead')->insert([
                'comprador_usuario_id' => $buyer->id,
                'vehiculo_concesionaria_id' => $vehicle->id,
                'generado_en' => now(),
            ]);
        });

        return 'https://wa.me/'.$number.'?text='.rawurlencode($message);
    }
}
