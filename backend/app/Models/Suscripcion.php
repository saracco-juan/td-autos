<?php

namespace App\Models;

use Database\Factories\SuscripcionFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A dealer subscription: one row per dealer, created with its first payment receipt.
 */
class Suscripcion extends Model
{
    /** @use HasFactory<SuscripcionFactory> */
    use HasFactory;

    public const ESTADO_PENDIENTE = 'pendiente';

    // Set when an administrator approves a payment receipt.
    public const ESTADO_ACTIVA = 'activa';

    // Set once the grace period ends without an approved renewal (RF20).
    public const ESTADO_INACTIVA = 'inactiva';

    protected $table = 'suscripcion';

    public $timestamps = false;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'concesionaria_id',
        'estado',
        'vigente_desde',
        'vigente_hasta',
        'gracia_hasta',
        'inactiva_desde',
        'retencion_hasta',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'vigente_desde' => 'date',
            'vigente_hasta' => 'date',
            'gracia_hasta' => 'date',
            'inactiva_desde' => 'date',
            'retencion_hasta' => 'date',
        ];
    }

    /**
     * @return BelongsTo<Concesionaria, $this>
     */
    public function concesionaria(): BelongsTo
    {
        return $this->belongsTo(Concesionaria::class, 'concesionaria_id');
    }

    /**
     * @return HasMany<ComprobantePago, $this>
     */
    public function comprobantes(): HasMany
    {
        return $this->hasMany(ComprobantePago::class, 'suscripcion_id');
    }
}
