<?php

namespace App\Services\Matching;

use App\Models\Vehiculo;

/** Equipment and contextual-use rubrics; eligibility and final ranking belong to the caller. */
final class VehicleSuitabilityScorer
{
    private const SAFETY = [
        'control_estabilidad' => 25, 'frenos_abs' => 15, 'airbags_frontales' => 15,
        'airbags_laterales' => 5, 'airbags_cortina' => 5, 'isofix' => 5,
        'frenado_autonomo' => 15, 'asistencia_carril' => 5, 'punto_ciego' => 5,
        'recordatorio_cinturon' => 5, 'asistencia_velocidad' => 2, 'monitoreo_conductor' => 3,
    ];

    private const COMFORT = [
        'volante_regulable' => 20, 'climatizador_bizona' => 15, 'butacas_calefaccionadas' => 10,
        'android_auto_apple_carplay' => 15, 'sensores_estacionamiento' => 10,
        'velocidad_crucero' => 15, 'camara_retroceso' => 15,
    ];

    public function __construct(private readonly RunningRequirementsScorer $running) {}

    /** Extras compensate at most five missing base points; they are not NCAP ratings. */
    public function safetyScore(Vehiculo $vehicle): ?int
    {
        $score = $this->equipmentTotal($vehicle, self::SAFETY);

        return $score === null ? null : min(100, $score);
    }

    public function comfortScore(Vehiculo $vehicle): ?int
    {
        return $this->equipmentTotal($vehicle, self::COMFORT);
    }

    /** AC OR climate is a single group; a known true operand resolves an unknown one. */
    public function equipmentScore(Vehiculo $vehicle, string $use): ?int
    {
        $weights = match ($use) {
            'ciudad' => ['sensores_estacionamiento' => 20, 'camara_retroceso' => 20, 'android_auto_apple_carplay' => 20],
            'ruta' => ['velocidad_crucero' => 40, 'android_auto_apple_carplay' => 20],
            default => null,
        };
        if ($weights === null) {
            return null;
        }

        $climate = $vehicle->aire_acondicionado === true || $vehicle->climatizador_bizona === true;
        if (! $climate && ($vehicle->aire_acondicionado === null || $vehicle->climatizador_bizona === null)) {
            return null;
        }
        $score = $this->equipmentTotal($vehicle, $weights);

        return $score === null ? null : $score + ($climate ? 40 : 0);
    }

    /** Adjust the usage component only; keep fractions and the caller-supplied year. */
    public function usageScore(Vehiculo $vehicle, string $use, string $monthly, int $currentYear): ?float
    {
        $alpha = match ($monthly) {
            'menos_500', 'no_sabe' => 0.0,
            '500_1500' => 0.05,
            '1500_3000' => 0.10,
            'mas_3000' => 0.15,
            default => null,
        };
        if ($alpha === null) {
            return null;
        }
        $base = $this->baseUsageScore($vehicle, $use, $currentYear);
        if ($base === null || $alpha === 0.0 || $use === 'trabajo') {
            return $base;
        }
        $running = $this->weighted([
            [$this->running->consumptionScore($vehicle, $use), 0.5],
            [$this->running->maintenanceScore($vehicle, $currentYear), 0.5],
        ]);

        return $this->weighted([[$base, 1 - $alpha], [$running, $alpha]]);
    }

    private function baseUsageScore(Vehiculo $vehicle, string $use, int $currentYear): ?float
    {
        return match ($use) {
            'ciudad' => $this->weighted([
                [$this->running->consumptionScore($vehicle, 'ciudad'), 0.6],
                [$this->equipmentScore($vehicle, 'ciudad'), 0.4],
            ]),
            'ruta' => $this->weighted([
                [$this->running->consumptionScore($vehicle, 'ruta'), 0.4],
                [$this->safetyScore($vehicle), 0.4],
                [$this->equipmentScore($vehicle, 'ruta'), 0.2],
            ]),
            'mixto' => $this->weighted([
                [$this->baseUsageScore($vehicle, 'ciudad', $currentYear), 0.5],
                [$this->baseUsageScore($vehicle, 'ruta', $currentYear), 0.5],
            ]),
            'trabajo' => $this->weighted([
                [$this->running->maintenanceScore($vehicle, $currentYear), 0.5],
                [$this->running->consumptionScore($vehicle, 'trabajo'), 0.5],
            ]),
            default => null,
        };
    }

    /** Normalized boolean facts only; unknown is never treated as explicit absence. */
    private function equipmentTotal(Vehiculo $vehicle, array $weights): ?int
    {
        $total = 0;
        foreach ($weights as $field => $points) {
            if ($vehicle->$field === null) {
                return null;
            }
            $total += $vehicle->$field ? $points : 0;
        }

        return $total;
    }

    /** @param array<array{int|float|null, float}> $terms */
    private function weighted(array $terms): ?float
    {
        $total = 0.0;
        foreach ($terms as [$score, $weight]) {
            if ($score === null) {
                return null;
            }
            $total += $score * $weight;
        }

        return $total;
    }
}
