<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Curated model the recommendations point to (HU06). `marca` and `modelo` are the exact ACARA catalog names; `nombres_inventario` lists the other model names the dealers' inventory uses for the same car.
 */
class ModeloReferencia extends Model
{
    protected $table = 'modelo_referencia';

    public $timestamps = false;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'marca', 'modelo', 'tipo_carroceria_id', 'plazas', 'tiene_manual', 'tiene_automatica', 'combustibles',
        'consumo', 'seguridad_estrellas', 'usos', 'ruta_mercadolibre', 'ruta_kavak', 'nombres_inventario',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'plazas' => 'integer',
            'tiene_manual' => 'boolean',
            'tiene_automatica' => 'boolean',
            'combustibles' => 'array',
            'seguridad_estrellas' => 'integer',
            'usos' => 'array',
            'nombres_inventario' => 'array',
        ];
    }

    /**
     * @return BelongsTo<TipoCarroceria, $this>
     */
    public function tipoCarroceria(): BelongsTo
    {
        return $this->belongsTo(TipoCarroceria::class, 'tipo_carroceria_id');
    }
}
