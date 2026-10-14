<?php

namespace App\Models;

use Database\Factories\ComprobantePagoFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A payment receipt (bank transfer proof) a dealer uploads for an administrator to review.
 */
class ComprobantePago extends Model
{
    /** @use HasFactory<ComprobantePagoFactory> */
    use HasFactory;

    public const ESTADO_PENDIENTE_REVISION = 'pendiente de revisión';

    protected $table = 'comprobante_pago';

    public $timestamps = false;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'suscripcion_id',
        'periodo_desde',
        'periodo_hasta',
        'archivo_url',
        'estado',
        'fecha_de_pago',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'periodo_desde' => 'date',
            'periodo_hasta' => 'date',
            'fecha_de_pago' => 'datetime',
            'fecha_revision' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Suscripcion, $this>
     */
    public function suscripcion(): BelongsTo
    {
        return $this->belongsTo(Suscripcion::class, 'suscripcion_id');
    }

    /**
     * Receipts still waiting for an administrator decision.
     *
     * @param  Builder<ComprobantePago>  $query
     * @return Builder<ComprobantePago>
     */
    public function scopePendientes(Builder $query): Builder
    {
        return $query->where('estado', self::ESTADO_PENDIENTE_REVISION);
    }
}
