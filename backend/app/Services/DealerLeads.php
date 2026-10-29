<?php

namespace App\Services;

use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Database\Query\JoinClause;
use Illuminate\Support\Facades\DB;

final class DealerLeads
{
    public function summary(User $owner, string $period): array
    {
        $end = now();
        $start = match ($period) {
            'week' => $end->copy()->startOfWeek(CarbonInterface::MONDAY),
            'month' => $end->copy()->startOfMonth(),
            default => null,
        };

        // Keep vehicles without contacts and hidden listings in the same ranking.
        $vehicles = DB::table('vehiculo_concesionaria as inventory')
            ->join('vehiculo as vehicle', 'vehicle.id', '=', 'inventory.vehiculo_id')
            ->leftJoin('lead', function (JoinClause $join) use ($start, $end) {
                // Inventory is keyed by vehiculo_id (there is no separate inventory.id).
                // lead.vehiculo_concesionaria_id references that primary key.
                $join->on('lead.vehiculo_concesionaria_id', '=', 'inventory.vehiculo_id')
                    ->where('lead.generado_en', '<=', $end);
                if ($start !== null) {
                    $join->where('lead.generado_en', '>=', $start);
                }
            })
            ->where('inventory.concesionaria_id', $owner->concesionaria->id)
            ->select('vehicle.id', 'vehicle.marca', 'vehicle.modelo', 'vehicle.version', 'vehicle.anio')
            ->selectRaw('COUNT(lead.id) as leads')
            ->groupBy('vehicle.id', 'vehicle.marca', 'vehicle.modelo', 'vehicle.version', 'vehicle.anio')
            ->orderByDesc('leads')->orderBy('vehicle.id')
            ->get()->map(fn ($vehicle) => [
                'id' => (int) $vehicle->id,
                'label' => implode(' ', array_filter([$vehicle->marca, $vehicle->modelo, $vehicle->version, $vehicle->anio])),
                'leads' => (int) $vehicle->leads,
            ]);

        return ['period' => $period, 'total' => $vehicles->sum('leads'), 'vehicles' => $vehicles->all()];
    }
}
