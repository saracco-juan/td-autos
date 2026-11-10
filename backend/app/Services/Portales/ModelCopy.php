<?php

namespace App\Services\Portales;

use App\Models\ModeloReferencia;

/**
 * The Spanish short texts of a recommended model: why it was picked and what its links filter.
 */
final class ModelCopy
{
    private const USES = ['ciudad' => 'ciudad', 'ruta' => 'ruta', 'mixto' => 'ciudad y ruta', 'trabajo' => 'trabajo'];

    public function __construct(private readonly ModelScorer $scorer = new ModelScorer) {}

    /**
     * Two or three reasons: the priority, the use and the seats, with the body type to fill in.
     *
     * @return list<string>
     */
    public function reasons(ModeloReferencia $model, string $use, string $priority): array
    {
        $reasons = [];
        if ($priority === 'consumo' && $model->consumo !== 'alto') {
            $reasons[] = 'Consumo '.$model->consumo;
        }
        if ($priority === 'seguridad' && $model->seguridad_estrellas !== null) {
            $reasons[] = 'Seguridad '.$model->seguridad_estrellas.($model->seguridad_estrellas === 1 ? ' estrella' : ' estrellas');
        }
        if ($this->scorer->matchesUse($model, $use)) {
            $reasons[] = 'Apto para '.self::USES[$use];
        }
        $reasons[] = $model->plazas.' plazas';
        if (count($reasons) < 2) {
            $reasons[] = 'Carrocería '.$model->tipoCarroceria->nombre;
        }

        return $reasons;
    }

    /**
     * What the portal links filter by, as chips.
     *
     * @return list<string>
     */
    public function filters(PortalSearch $search, ?string $bodyName): array
    {
        $chips = [];
        if ($search->transmission !== null) {
            $chips[] = $search->transmission === 'automatica' ? 'Automática' : 'Manual';
        }
        if ($search->body !== null && $bodyName !== null) {
            $chips[] = $bodyName;
        }
        if ($search->yearFrom !== null && $search->yearTo !== null) {
            $chips[] = $search->yearFrom === $search->yearTo ? (string) $search->yearFrom : $search->yearFrom.'–'.$search->yearTo;
        }
        if ($search->maxPriceArs !== null) {
            $chips[] = 'Hasta $ '.number_format($search->maxPriceArs, 0, ',', '.');
        }

        return $chips;
    }
}
