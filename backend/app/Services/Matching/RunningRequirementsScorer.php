<?php

namespace App\Services\Matching;

use App\Models\Vehiculo;
use App\Support\DiagnosticoOptions;
use App\Support\VehiculoOptions;

/** Relative rubric scores, not money or predictions of mechanical failures. */
final class RunningRequirementsScorer
{
    private const SUPPORTED_FUELS = ['nafta', 'diesel', 'gnc'];

    /** Null means unavailable; zero must never stand in for an unknown fact. */
    public function consumptionScore(Vehiculo $vehicle, string $use): ?int
    {
        if (! in_array($vehicle->combustible, self::SUPPORTED_FUELS, true)
            || ! in_array($use, DiagnosticoOptions::USO_PRINCIPAL, true)) {
            return null;
        }

        // GNC is a cost-of-use product rule, not a physical L/100 km comparison.
        if ($vehicle->combustible === 'gnc') {
            return 100;
        }

        $readings = match ($use) {
            'ciudad' => [$vehicle->consumo_urbano],
            'ruta' => [$vehicle->consumo_ruta],
            default => [$vehicle->consumo_urbano, $vehicle->consumo_ruta],
        };
        foreach ($readings as $reading) {
            if (! is_numeric($reading) || ! is_finite((float) $reading) || $reading <= 0) {
                return null;
            }
        }

        // Average physical readings before scoring; do not average band scores.
        $litres = array_sum($readings) / count($readings);

        return match (true) {
            $litres <= 6 => 100,
            $litres <= 8 => 80,
            $litres <= 10 => 60,
            $litres <= 12 => 40,
            default => 20,
        };
    }

    /** Uses normalized publication facts and a caller-supplied calendar year; no I/O or clock reads. */
    public function maintenanceScore(Vehiculo $vehicle, int $currentYear): ?float
    {
        if (! in_array($vehicle->combustible, self::SUPPORTED_FUELS, true)
            || ! in_array($vehicle->transmision, VehiculoOptions::TRANSMISION, true)
            || $vehicle->turbo === null
            || ! is_numeric($vehicle->anio)
            || ! is_numeric($vehicle->kilometraje)
            || $vehicle->kilometraje < 0) {
            return null;
        }

        // Publication accepts next-year models; they belong to the youngest band.
        $age = max(0, $currentYear - (int) $vehicle->anio);
        $ageScore = match (true) {
            $age <= 3 => 100,
            $age <= 7 => 75,
            $age <= 12 => 50,
            $age <= 20 => 25,
            default => 0,
        };
        $odometerScore = match (true) {
            $vehicle->kilometraje <= 40000 => 100,
            $vehicle->kilometraje <= 80000 => 75,
            $vehicle->kilometraje <= 140000 => 50,
            $vehicle->kilometraje <= 200000 => 25,
            default => 0,
        };
        $engineScore = match ($vehicle->combustible) {
            'diesel' => 75,
            'gnc' => 90,
            default => 100,
        };
        $engineScore -= $vehicle->turbo ? 25 : 0;
        $transmissionScore = $vehicle->transmision === 'manual' ? 100 : 75;

        // Keep fractional points for later composition; power deliberately does not participate.
        return 0.375 * $ageScore + 0.375 * $odometerScore + 0.15 * $engineScore + 0.10 * $transmissionScore;
    }
}
