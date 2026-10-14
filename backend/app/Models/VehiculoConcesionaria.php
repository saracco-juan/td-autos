<?php

namespace App\Models;

use Database\Factories\VehiculoConcesionariaFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Ownership of a vehicle by a dealer: one row per dealer vehicle, keyed by the vehicle.
 */
class VehiculoConcesionaria extends Model
{
    /** @use HasFactory<VehiculoConcesionariaFactory> */
    use HasFactory;

    protected $table = 'vehiculo_concesionaria';

    protected $primaryKey = 'vehiculo_id';

    public $incrementing = false;

    public $timestamps = false;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'vehiculo_id',
        'concesionaria_id',
        'patente_normalizada',
        'visible',
        'ocultado_en',
        'eliminar_desde',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'visible' => 'boolean',
            'ocultado_en' => 'datetime',
            'eliminar_desde' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Vehiculo, $this>
     */
    public function vehiculo(): BelongsTo
    {
        return $this->belongsTo(Vehiculo::class, 'vehiculo_id');
    }

    /**
     * @return BelongsTo<Concesionaria, $this>
     */
    public function concesionaria(): BelongsTo
    {
        return $this->belongsTo(Concesionaria::class, 'concesionaria_id');
    }
}
