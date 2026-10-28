<?php

namespace App\Services\Portales;

use App\Models\ModeloReferencia;

/**
 * How well a curated model matches the buyer: one point for the use plus up to two for the priority. Pure.
 *
 * Maintenance and resale have no data per model, so they are neutral (one point) for everyone.
 */
final class ModelScorer
{
    private const NEUTRAL = 1.0;

    private const CONSUMPTION = ['bajo' => 2.0, 'medio' => 1.0, 'alto' => 0.0];

    public function score(ModeloReferencia $model, string $use, string $priority): float
    {
        return ($this->matchesUse($model, $use) ? 1.0 : 0.0) + match ($priority) {
            'consumo' => self::CONSUMPTION[$model->consumo] ?? 0.0,
            'seguridad' => $model->seguridad_estrellas === null ? self::NEUTRAL : $model->seguridad_estrellas / 5 * 2,
            default => self::NEUTRAL,
        };
    }

    /** `mixto` matches a model that is good for both the city and the highway. */
    public function matchesUse(ModeloReferencia $model, string $use): bool
    {
        $uses = $model->usos ?? [];

        return $use === 'mixto' ? in_array('ciudad', $uses, true) && in_array('ruta', $uses, true) : in_array($use, $uses, true);
    }
}
